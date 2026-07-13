import { readDocument } from "./documentService";
import { searchKnowledgeBase } from "./knowledgeIndexService";
import type { CcMessageBlock } from "../utils/ccMessageBlocks";
import {
  extractVaultDocumentIds,
  extractVaultDocumentIdsForReadFollowUp,
  extractVaultDocumentIdsFromMessages,
  extractVaultSearchQuery,
  formatVaultPrefetchForPrompt,
  formatVaultReadPrefetchForPrompt,
  isWeakVaultToolModel,
  parsePseudoVaultToolCalls,
  stripPseudoLizhiToolMarkup,
  userMessageLooksLikeVaultQuery,
  userMessageLooksLikeVaultReadFollowUp,
} from "../utils/ccVaultQueryGuard";
import { isTauriRuntime } from "./vaultService";
import { syncLegacyFromBlocks } from "../utils/ccMessageBlocks";

const READ_BODY_LIMIT = 12_000;

function extractDocTitle(content: string, id: string): string {
  const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (h1) return h1.slice(0, 120);
  const first = content.split("\n").find((line) => line.trim());
  return first?.trim().slice(0, 120) || id;
}

function truncateBody(content: string): string {
  if (content.length <= READ_BODY_LIMIT) return content;
  return `${content.slice(0, READ_BODY_LIMIT)}\n…（正文已截断，完整内容见工具返回）`;
}

function buildReadToolBlock(
  docId: string,
  title: string,
  content: string,
  ts: number,
): CcMessageBlock {
  return {
    type: "tool",
    id: `prefetch-read-${docId}-${ts}`,
    name: "mcp__lizhi-kb__lizhi_read_document",
    input: JSON.stringify({ id: docId }),
    output: JSON.stringify({ id: docId, title, content: truncateBody(content) }),
    startedAt: ts,
    completedAt: ts,
  };
}

function buildSearchToolBlock(
  query: string,
  hits: Array<{ id: string; title: string; snippet: string; score?: number }>,
  ts: number,
): CcMessageBlock {
  return {
    type: "tool",
    id: `prefetch-search-${ts}`,
    name: "mcp__lizhi-kb__lizhi_search",
    input: JSON.stringify({ query, top_k: 10 }),
    output: JSON.stringify(
      hits.map((h) => ({
        id: h.id,
        title: h.title,
        snippet: h.snippet,
        score: h.score,
      })),
    ),
    startedAt: ts,
    completedAt: ts,
  };
}

function existingToolKeys(blocks: CcMessageBlock[]): Set<string> {
  const keys = new Set<string>();
  for (const block of blocks) {
    if (block.type !== "tool") continue;
    const input = block.input?.trim() ?? "";
    keys.add(`${block.name}:${input}`);
  }
  return keys;
}

/** 弱工具链模型在 vault 模式发送前：客户端代执行 search / read */
export async function runVaultClientPrefetchForWeakModel(options: {
  cwdMode: "vault" | "project";
  modelId: string;
  userText: string;
  priorMessages?: Array<{ role: string; content?: string; blocks?: CcMessageBlock[] }>;
}): Promise<{ promptPrefix: string; blocks: CcMessageBlock[] } | null> {
  if (options.cwdMode !== "vault") return null;
  if (!isTauriRuntime() || !isWeakVaultToolModel(options.modelId)) return null;
  if (!userMessageLooksLikeVaultQuery(options.userText, { priorMessages: options.priorMessages })) {
    return null;
  }

  const nowTs = Date.now();
  let docIds = extractVaultDocumentIds(options.userText);
  if (!docIds.length && options.priorMessages?.length) {
    if (userMessageLooksLikeVaultReadFollowUp(options.userText)) {
      docIds = extractVaultDocumentIdsForReadFollowUp(options.priorMessages);
    } else {
      docIds = extractVaultDocumentIdsFromMessages(options.priorMessages);
    }
  }

  if (docIds.length) {
    const blocks: CcMessageBlock[] = [];
    const docs: Array<{ id: string; title: string; content: string }> = [];
    for (const id of docIds.slice(0, 3)) {
      try {
        const { content } = await readDocument(id);
        const title = extractDocTitle(content, id);
        docs.push({ id, title, content });
        blocks.push(buildReadToolBlock(id, title, content, nowTs));
      } catch {
        /* 单篇失败继续 */
      }
    }
    if (!docs.length) return null;
    return {
      promptPrefix: formatVaultReadPrefetchForPrompt(docs),
      blocks,
    };
  }

  const query = extractVaultSearchQuery(options.userText);
  if (!query) return null;
  try {
    const hits = await searchKnowledgeBase([], {}, query, 10);
    return {
      promptPrefix: formatVaultPrefetchForPrompt(hits, query),
      blocks: [buildSearchToolBlock(query, hits, nowTs)],
    };
  } catch {
    return null;
  }
}

/** 流结束后：解析正文伪 tool_call，客户端补执行并剥离 XML */
export async function resolveAssistantPseudoVaultTools(options: {
  content: string;
  blocks: CcMessageBlock[];
}): Promise<{ content: string; blocks: CcMessageBlock[]; legacy: ReturnType<typeof syncLegacyFromBlocks> }> {
  let content = options.content;
  let blocks = [...options.blocks];
  const seen = existingToolKeys(blocks);

  if (isTauriRuntime()) {
    const parsed = parsePseudoVaultToolCalls(content);
    const nowTs = Date.now();

    for (const call of parsed) {
      const keyName = call.name.includes("mcp__") ? call.name : `mcp__lizhi-kb__${call.name}`;

      if (call.docId && /read/i.test(call.name)) {
        const input = JSON.stringify({ id: call.docId });
        const dedupe = `${keyName}:${input}`;
        if (seen.has(dedupe)) continue;
        try {
          const { content: body } = await readDocument(call.docId);
          const title = extractDocTitle(body, call.docId);
          blocks.push(buildReadToolBlock(call.docId, title, body, nowTs));
          seen.add(dedupe);
        } catch {
          /* ignore */
        }
        continue;
      }

      if (call.query && /search/i.test(call.name)) {
        const input = JSON.stringify({ query: call.query, top_k: 10 });
        const dedupe = `${keyName}:${input}`;
        if (seen.has(dedupe)) continue;
        try {
          const hits = await searchKnowledgeBase([], {}, call.query, 10);
          blocks.push(buildSearchToolBlock(call.query, hits, nowTs));
          seen.add(dedupe);
        } catch {
          /* ignore */
        }
      }
    }
  }

  content = stripPseudoLizhiToolMarkup(content);
  const legacy = syncLegacyFromBlocks(blocks);
  return { content, blocks, legacy: { ...legacy, content } };
}
