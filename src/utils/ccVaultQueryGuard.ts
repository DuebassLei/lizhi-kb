import type { CcMessageBlock } from "./ccMessageBlocks";
import { normalizeCcToolName } from "./ccToolGrouping";

/** vault 知识库查询应调用的 MCP 工具（normalize 后 key） */
const LIZHI_VAULT_QUERY_TOOL_KEYS = new Set([
  "lizhisearch",
  "lizhilistdocuments",
  "lizhireaddocument",
  "lizhireaddocuments",
  "lizhilisttags",
  "lizhigetfoldertree",
  "lizhilistfolders",
]);

/** 任意 lizhi-mcp 工具（含 status / backlinks 等） */
function lizhiToolKey(name: string): string | null {
  const raw = String(name ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (/^mcp__lizhi/i.test(lower) || /^lizhi/i.test(lower)) {
    const key = normalizeCcToolName(raw);
    return key.startsWith("lizhi") ? key : null;
  }
  const key = normalizeCcToolName(raw);
  return key.startsWith("lizhi") ? key : null;
}

/** 用户消息是否像在查询知识库 */
export function userMessageLooksLikeVaultReadFollowUp(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 12) return false;
  return /^(?:需要|好的|好|可以|行|读吧|帮我读|请读|继续|要的|嗯|是的|要|ok|yes|y)$/i.test(t);
}

type VaultHistoryMessage = {
  role: string;
  content?: string;
  blocks?: CcMessageBlock[];
};

/** 从近期对话（主要是助手回复）提取笔记 id */
export function extractVaultDocumentIdsFromMessages(
  messages: VaultHistoryMessage[],
  maxMessages = 6,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  const recent = messages.slice(-maxMessages).reverse();

  for (const msg of recent) {
    let blob = msg.content ?? "";
    for (const block of msg.blocks ?? []) {
      if (block.type === "tool" && block.output) {
        blob += `\n${block.output}`;
      }
    }
    for (const id of extractVaultDocumentIds(blob)) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

function lastAssistantOfferedVaultRead(messages: VaultHistoryMessage[]): boolean {
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  const text = last?.content?.trim() ?? "";
  if (!text) return false;
  return /(?:需要我帮|帮你读取|读取.*完整|读.*全文|进一步读取|读取上述|读取以上)/i.test(text);
}

/** 读全文跟进：只从上一条助手正文取 id，避免把预检索 JSON 里全部命中都读一遍 */
export function extractVaultDocumentIdsForReadFollowUp(
  messages: VaultHistoryMessage[],
): string[] {
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  if (!last?.content) return [];
  return extractVaultDocumentIds(last.content);
}

/** 用户消息是否像在查询知识库 */
export function userMessageLooksLikeVaultQuery(
  text: string,
  options?: { priorMessages?: VaultHistoryMessage[] },
): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /(?:搜索|查询|查找|找一?找|有哪些|笔记|文档|知识库|标签|双链|文件夹|vault)/i.test(t)
  ) {
    return true;
  }
  const prior = options?.priorMessages ?? [];
  if (userMessageLooksLikeVaultReadFollowUp(t)) {
    if (extractVaultDocumentIdsForReadFollowUp(prior).length > 0) return true;
    if (lastAssistantOfferedVaultRead(prior)) return true;
  }
  const docIds = extractVaultDocumentIds(t);
  if (docIds.length === 0) return false;
  if (docIds.length === 1 && t.replace(docIds[0], "").trim().length <= 24) {
    return true;
  }
  return /(?:查看|阅读|读取|全文|打开|这篇|该篇|内容|详情|详细)/i.test(t);
}

const VAULT_DOC_ID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

/** 从用户消息提取文档 UUID（lizhi 笔记 id） */
export function extractVaultDocumentIds(text: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const match of text.matchAll(VAULT_DOC_ID_RE)) {
    const id = match[0].toLowerCase();
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export interface ParsedPseudoVaultTool {
  name: string;
  docId?: string;
  query?: string;
}

/** 从模型正文解析伪造的 lizhi 工具调用 */
export function parsePseudoVaultToolCalls(text: string): ParsedPseudoVaultTool[] {
  const results: ParsedPseudoVaultTool[] = [];
  const seen = new Set<string>();

  const push = (entry: ParsedPseudoVaultTool) => {
    const key = `${entry.name}:${entry.docId ?? ""}:${entry.query ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(entry);
  };

  for (const match of text.matchAll(/<tool_call>([\s\S]*?)<\/tool_call>/gi)) {
    parseToolCallInner(match[1] ?? "", push);
  }

  for (const match of text.matchAll(/\[tool_call\]([\s\S]*?)\[\/tool_call\]/gi)) {
    parseToolCallInner(match[1] ?? "", push);
  }

  for (const match of text.matchAll(
    /<tool\s+name=["'](mcp__lizhi[^"']+|lizhi[^"']+)["'][^>]*>([\s\S]*?)<\/tool>/gi,
  )) {
    const name = match[1]?.trim() ?? "";
    const inner = match[2] ?? "";
    if (!isLizhiMcpToolName(name)) continue;
    const docId =
      inner.match(/<arg\s+id=["']([^"']+)["']/i)?.[1]?.trim() ??
      extractVaultDocumentIds(inner)[0];
    const query = inner.match(/<parameter\s+name=["']query["']>\s*([^<]+)/i)?.[1]?.trim();
    push({ name, docId, query });
  }

  // <invoke name="lizhi_xxx"><parameter name="id">...</parameter></invoke>（顶层，不被 <tool_call> 包裹）
  for (const match of text.matchAll(
    /<invoke\s+name=["'](mcp__lizhi[^"']+|lizhi[^"']+)["'][^>]*>([\s\S]*?)<\/invoke>/gi,
  )) {
    const name = match[1]?.trim() ?? "";
    const inner = match[2] ?? "";
    if (!isLizhiMcpToolName(name)) continue;
    const docId =
      inner.match(/<parameter\s+name=["'](?:id|doc_id|document_id)["']>\s*([^<]+)/i)?.[1]?.trim() ??
      extractVaultDocumentIds(inner)[0];
    const query = inner.match(/<parameter\s+name=["']query["']>\s*([^<]+)/i)?.[1]?.trim();
    push({ name, docId, query });
  }

  // <function_calls><invoke name="lizhi_xxx">...</invoke></function_calls>
  for (const fcMatch of text.matchAll(/<function_calls>([\s\S]*?)<\/function_calls>/gi)) {
    parseToolCallInner(fcMatch[1] ?? "", push);
  }

  return results;
}

function parseToolCallInner(
  inner: string,
  push: (entry: ParsedPseudoVaultTool) => void,
): void {
  const xmlName = inner.match(/<tool\s+name=["']([^"']+)["']/i)?.[1]?.trim();
  const arrowName = inner.match(/tool\s*=>\s*["']([^"']+)["']/i)?.[1]?.trim();
  const invokeName = inner.match(/<invoke\s+name=["']([^"']+)["']/i)?.[1]?.trim();
  const name = xmlName ?? arrowName ?? invokeName ?? "";
  if (!name || !isLizhiMcpToolName(name)) return;

  const docId =
    inner.match(/<arg\s+id=["']([^"']+)["']/i)?.[1]?.trim() ??
    inner.match(/<parameter\s+name=["'](?:id|doc_id|document_id)["']>\s*([^<]+)/i)?.[1]?.trim() ??
    inner.match(/--id\s*["']([^"']+)["']/i)?.[1]?.trim() ??
    inner.match(/["']id["']\s*=>\s*["']([^"']+)["']/i)?.[1]?.trim() ??
    extractVaultDocumentIds(inner)[0];

  const query =
    inner.match(/<parameter\s+name=["']query["']>\s*([^<]+)/i)?.[1]?.trim() ??
    inner.match(/<query>\s*([^<]+)/i)?.[1]?.trim() ??
    inner.match(/["']query["']\s*=>\s*["']([^"']+)["']/i)?.[1]?.trim();

  push({ name, docId, query });
}

export function isLizhiMcpToolName(name: string): boolean {
  return lizhiToolKey(name) !== null;
}

export function isLizhiSearchOrReadTool(name: string): boolean {
  const key = lizhiToolKey(name);
  if (!key) return false;
  return LIZHI_VAULT_QUERY_TOOL_KEYS.has(key);
}

type ToolLike = { name: string; output?: string; id?: string };

/** 合并 legacy toolCalls 与 blocks，避免只读一侧导致漏判 */
function collectTools(
  toolCalls: ToolLike[] | undefined,
  blocks: CcMessageBlock[] | undefined,
): ToolLike[] {
  const byKey = new Map<string, ToolLike>();

  const merge = (tool: ToolLike) => {
    const name = String(tool.name ?? "").trim();
    if (!name) return;
    const key = `${tool.id ?? ""}:${name}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...tool, name });
      return;
    }
    byKey.set(key, {
      ...prev,
      ...tool,
      name,
      output: tool.output !== undefined ? tool.output : prev.output,
    });
  };

  for (const block of blocks ?? []) {
    if (block.type !== "tool") continue;
    merge({ id: block.id, name: block.name, output: block.output });
  }
  for (const tool of toolCalls ?? []) {
    merge(tool);
  }

  return [...byKey.values()];
}

export function messageHasLizhiMcpToolCall(
  toolCalls: ToolLike[] | undefined,
  blocks: CcMessageBlock[] | undefined,
): boolean {
  return collectTools(toolCalls, blocks).some((t) => isLizhiMcpToolName(t.name));
}

export function messageHasLizhiSearchOrRead(
  toolCalls: ToolLike[] | undefined,
  blocks: CcMessageBlock[] | undefined,
): boolean {
  return collectTools(toolCalls, blocks).some((t) => isLizhiSearchOrReadTool(t.name));
}

export function messageHasPendingLizhiTools(
  toolCalls: ToolLike[] | undefined,
  blocks: CcMessageBlock[] | undefined,
): boolean {
  return collectTools(toolCalls, blocks).some(
    (t) => isLizhiMcpToolName(t.name) && t.output === undefined,
  );
}

export function messageHasSuccessfulLizhiQueryTool(
  toolCalls: ToolLike[] | undefined,
  blocks: CcMessageBlock[] | undefined,
): boolean {
  return collectTools(toolCalls, blocks).some((t) => {
    if (!isLizhiSearchOrReadTool(t.name)) return false;
    const out = t.output?.trim();
    return Boolean(out && out !== "（已取消）");
  });
}

/** 助手正文是否像未引用 tool 的 vault 文档编造 */
export function looksLikeUncitedVaultDocumentAnswer(text: string): boolean {
  const t = text.trim();
  if (t.length < 60) return false;

  const signals = [
    /(?:标题|文档名)[:：]/,
    /#[\w\u4e00-\u9fff-]+/,
    /(?:创建|更新)[:：]\s*\d{4}-\d{2}-\d{2}/,
    /(?:路径|文件夹)[:：]/,
    /(?:产品\s*ID|逻辑\s*ID)[:：]/,
    /(?:附件|\.pdf|\.vsdx|\.docx)/i,
    /「[^」]{6,}」/,
  ];
  let hits = 0;
  for (const re of signals) {
    if (re.test(t)) hits += 1;
  }
  return hits >= 2;
}

export const VAULT_QUERY_USER_PREFIX =
  "【vault 知识库约束】本模式仅能经 lizhi-mcp 访问加密笔记。回答前必须先调用 lizhi_search（或 lizhi_list_documents / lizhi_read_document）；禁止编造标题、标签、日期、路径或正文。若无 tool 返回结果，请明确回复「未找到相关笔记」。\n\n";

export const VAULT_UNCITED_REPLY_ERROR =
  "此回复未调用 lizhi-mcp 检索/读文档，内容可能并非知识库真实数据。请重试，或换用更支持工具调用的模型。";

export const VAULT_PSEUDO_TOOL_MARKUP_ERROR =
  "检测到模型在正文中输出了 <lizhi_search> 等伪工具标签，并未真正调用 MCP。请换 Claude Sonnet 等支持 tool_use 的模型后重试。";

/** 模型在正文里伪造 XML 工具调用（无真实 tool_use） */
export function containsPseudoLizhiToolMarkup(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /<tool_call>/i.test(t) ||
    /\[tool_call\]/i.test(t) ||
    /\{tool\s*=>\s*["'](?:mcp__lizhi|lizhi)/i.test(t) ||
    /--id\s*["'][0-9a-f-]{36}["']/i.test(t) ||
    /<tool\s+name=["'](?:mcp__lizhi|lizhi)/i.test(t) ||
    /<arg\s+id=["'][0-9a-f-]{36}["']/i.test(t) ||
    /<(?:lizhi[_-][\w-]*|mcp__lizhi[\w-]*)(?:\s[^>]*)?\s*(?:\/>|>)/i.test(t) ||
    /<\/(?:lizhi[_-][\w-]*|mcp__lizhi[\w-]*)>/i.test(t) ||
    /<(query|top_k|doc_id|document_id)>\s*[^<]+<\/\1>/i.test(t) ||
    /<function_calls>/i.test(t) ||
    /<invoke\s+name=["'](?:mcp__lizhi|lizhi)/i.test(t) ||
    /<parameter\s+name=["'](?:query|top_k|doc_id|document_id|id)["']/i.test(t) ||
    /<result>/i.test(t) ||
    /<thinking>/i.test(t) ||
    /\{\s*["']name["']\s*:\s*["'](?:mcp__lizhi|lizhi)/i.test(t)
  );
}

/** 从正文移除模型伪造的 lizhi 工具 XML */
export function stripPseudoLizhiToolMarkup(text: string): string {
  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/\[tool_call\][\s\S]*?\[\/tool_call\]/gi, "")
    .replace(/<tool\s+name=["'](?:mcp__lizhi|lizhi)[^"']*["'][^>]*>[\s\S]*?<\/tool>/gi, "")
    .replace(
      /<(?:lizhi[_-][\w-]*|mcp__lizhi[\w-]*)[^>]*>[\s\S]*?<\/(?:lizhi[_-][\w-]*|mcp__lizhi[\w-]*)>/gi,
      "",
    )
    .replace(/<(?:lizhi[_-][\w-]*|mcp__lizhi[\w-]*)[^>]*\/>/gi, "")
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, "")
    .replace(/<invoke\s+name=["']lizhi[^"']*["'][^>]*>[\s\S]*?<\/invoke>/gi, "")
    .replace(/<result>[\s\S]*?<\/result>/gi, "")
    .replace(/<result>\s*<function_calls>[\s\S]*?<\/function_calls>\s*<\/result>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** DeepSeek / MiniMax 等常输出伪 XML 而非 tool_use */
export function isWeakVaultToolModel(modelId: string): boolean {
  const m = modelId.trim().toLowerCase();
  if (!m) return false;
  return /(?:deepseek|minimax|doubao|moonshot|kimi)/.test(m) || /(?:^|[-_/])flash(?:$|[-_/])/.test(m);
}

/** 从用户自然语言提取检索关键词 */
export function normalizeVaultSearchQuery(query: string): string {
  let q = query.trim();
  if (!q) return q;
  q = q.replace(
    /(?:的)?(?:详细(?:信息|内容|资料|说明|情况|介绍)?|相关信息|具体内容|更多信息|相关笔记|相关文档)$/u,
    "",
  ).trim();
  q = q.replace(/^(?:有关|关于)\s*/u, "").trim();
  return q || query.trim();
}

/** 从用户自然语言提取检索关键词 */
export function extractVaultSearchQuery(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const quoted = t.match(/[「"']([^「」"']+)[」"']/);
  if (quoted?.[1]?.trim()) return normalizeVaultSearchQuery(quoted[1].trim());
  const about = t.match(/(?:关于|有关|包含|搜索|查找|查询|找)\s*[：:]?\s*([^\s，。！？,!?]{2,48})/i);
  if (about?.[1]?.trim()) return normalizeVaultSearchQuery(about[1].trim());
  const stripped = t
    .replace(
      /^(?:请|帮我|帮忙)?(?:在)?(?:知识库|笔记库|vault)?(?:中|里)?(?:搜索|查找|查询|找一?找|看看)?/i,
      "",
    )
    .replace(/(?:相关)?(?:的)?(?:笔记|文档|内容|资料|信息).*[。！？!?.]?$/i, "")
    .trim();
  const core = stripped.length >= 2 ? stripped : t;
  return normalizeVaultSearchQuery(core);
}

export function formatVaultReadPrefetchForPrompt(
  docs: Array<{ id: string; title: string; content: string }>,
): string {
  if (!docs.length) {
    return "【知识库预读取】未能读取请求的文档 id，请如实告知用户。\n\n";
  }
  const bodyLimit = 10_000;
  const parts = docs.map((doc) => {
    const body =
      doc.content.length > bodyLimit
        ? `${doc.content.slice(0, bodyLimit)}\n…（正文已截断）`
        : doc.content;
    return `### 《${doc.title}》（id: ${doc.id}）\n${body}`;
  });
  return (
    `【知识库预读取】客户端已执行 lizhi_read_document（${docs.length} 篇）。请直接根据下列正文回答；禁止输出 tool_call / function_calls / lizhi_search 等伪 XML，无需再次调用工具。\n\n` +
    `${parts.join("\n\n")}\n\n`
  );
}

export function formatVaultPrefetchForPrompt(
  hits: Array<{ id: string; title: string; snippet: string }>,
  query: string,
): string {
  if (!hits.length) {
    return `【知识库预检索】关键词「${query}」：未找到匹配笔记。请如实告知用户，勿输出 <lizhi_search> 等伪标签。\n\n`;
  }
  const lines = hits.slice(0, 10).map(
    (h, i) => `${i + 1}. 《${h.title}》（id: ${h.id}）\n   ${h.snippet}`,
  );
  return (
    `【知识库预检索】关键词「${query}」，${hits.length} 条命中（客户端已执行 lizhi_search，请直接据此回答；禁止输出 <lizhi_search>、<function_calls>、<invoke> 等伪工具 XML，无需再次调用工具）：\n` +
    `${lines.join("\n")}\n\n`
  );
}

export function checkVaultKnowledgeReply(options: {
  cwdMode: "vault" | "project";
  userText: string;
  assistantText: string;
  toolCalls?: ToolLike[];
  blocks?: CcMessageBlock[];
  /** 流式进行中时不评估 guard */
  streaming?: boolean;
  /** 整轮是否已结束（含 tool result）；默认 true */
  turnComplete?: boolean;
}): { violation: boolean; message?: string } {
  if (options.cwdMode !== "vault") return { violation: false };
  if (!userMessageLooksLikeVaultQuery(options.userText)) return { violation: false };
  if (options.streaming) return { violation: false };

  const turnComplete = options.turnComplete !== false;

  // 已发起 lizhi-mcp 工具：不显示「未调用 MCP」幻觉警告（失败/无结果由工具块 UI 承担）
  if (messageHasLizhiMcpToolCall(options.toolCalls, options.blocks)) {
    return { violation: false };
  }

  // 工具仍在执行：等整轮结束后再评估
  if (!turnComplete || messageHasPendingLizhiTools(options.toolCalls, options.blocks)) {
    return { violation: false };
  }

  const text = options.assistantText.trim();
  if (!text) return { violation: false };

  if (containsPseudoLizhiToolMarkup(text)) {
    return { violation: true, message: VAULT_PSEUDO_TOOL_MARKUP_ERROR };
  }

  if (looksLikeUncitedVaultDocumentAnswer(text) || text.length >= 120) {
    return { violation: true, message: VAULT_UNCITED_REPLY_ERROR };
  }

  return { violation: false };
}

/** MiniMax 等模型在 vault 知识库查询场景的轻量提示 */
export function vaultKbQueryModelHint(options: {
  cwdMode: "vault" | "project";
  modelId: string;
  inputText: string;
  historyHasLizhiMcpResult: boolean;
}): string | null {
  if (options.cwdMode !== "vault") return null;
  if (options.historyHasLizhiMcpResult) return null;
  if (!userMessageLooksLikeVaultQuery(options.inputText)) return null;
  if (!isWeakVaultToolModel(options.modelId)) return null;
  return "当前模型工具链较弱，发送知识库问题时会自动预检索笔记；仍建议换 Claude Sonnet 获得更稳定体验。";
}
