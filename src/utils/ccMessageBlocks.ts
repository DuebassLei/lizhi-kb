export interface CcToolCallItem {
  name: string;
  input: string;
  output?: string;
  id?: string;
}

export type CcMessageBlock =
  | { type: "thinking"; content: string }
  | { type: "text"; content: string }
  | { type: "tool"; id?: string; name: string; input: string; output?: string };

export type CcRenderSegment =
  | { type: "thinking"; content: string; key: string; isLastThinking: boolean }
  | { type: "text"; content: string; key: string }
  | { type: "tools"; items: CcToolCallItem[]; key: string };

export interface CcMessageLike {
  content: string;
  thinking?: string;
  toolCalls?: CcToolCallItem[];
  blocks?: CcMessageBlock[];
}

const EMBEDDED_THINKING_PATTERNS: RegExp[] = [
  new RegExp("<" + "think" + ">([\\s\\S]*?)<\\/" + "think" + ">", "gi"),
  /<think>([\s\S]*?)<\/redacted_thinking>/gi,
];

const ORPHAN_THINKING_TAG = /<\/?think>|<\/?redacted_thinking>/gi;

let trailingStructuralBoundary: { signature: string; textLength: number } | null = null;

/** 新一轮流式开始时重置 post-tool 文本边界状态 */
export function resetStreamingBlockSyncState(): void {
  trailingStructuralBoundary = null;
}

export function stripThinkingTags(text: string): string {
  return text.replace(ORPHAN_THINKING_TAG, "");
}

/** 从 text token 中剥离 DeepSeek 等模型嵌入的 thinking 标签 */
export function splitEmbeddedThinking(raw: string): { text: string; thinking: string } {
  if (!raw) return { text: "", thinking: "" };

  let text = raw;
  let thinking = "";

  for (const pattern of EMBEDDED_THINKING_PATTERNS) {
    text = text.replace(pattern, (_match, inner?: string) => {
      if (typeof inner === "string" && inner.trim()) {
        thinking += inner;
      }
      return "";
    });
  }

  text = stripThinkingTags(text);
  thinking = stripThinkingTags(thinking);

  return { text, thinking };
}

function getThinkingContent(block: CcMessageBlock | undefined): string {
  return block?.type === "thinking" ? block.content : "";
}

function getTextContent(block: CcMessageBlock | undefined): string {
  return block?.type === "text" ? block.content : "";
}

function toolSignature(block: CcMessageBlock): string {
  if (block.type !== "tool") return "";
  return `tool:${block.id ?? ""}:${block.name}`;
}

export function syncLegacyFromBlocks(blocks: CcMessageBlock[]): {
  content: string;
  thinking?: string;
  toolCalls?: CcToolCallItem[];
} {
  let content = "";
  let thinking = "";
  const toolCalls: CcToolCallItem[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      content += block.content;
    } else if (block.type === "thinking") {
      thinking += block.content;
    } else {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input,
        output: block.output,
      });
    }
  }

  return {
    content,
    thinking: thinking || undefined,
    toolCalls: toolCalls.length ? toolCalls : undefined,
  };
}

export function resolveMessageBlocks(message: CcMessageLike): CcMessageBlock[] {
  if (message.blocks?.length) return message.blocks;

  const blocks: CcMessageBlock[] = [];
  if (message.thinking?.trim()) {
    blocks.push({ type: "thinking", content: stripThinkingTags(message.thinking) });
  }
  if (message.content?.trim()) {
    const split = splitEmbeddedThinking(message.content);
    if (split.thinking.trim()) {
      blocks.push({ type: "thinking", content: split.thinking.trim() });
    }
    if (split.text.trim()) {
      blocks.push({ type: "text", content: split.text });
    }
  }
  for (const tool of message.toolCalls ?? []) {
    blocks.push({
      type: "tool",
      id: tool.id,
      name: tool.name,
      input: tool.input,
      output: tool.output,
    });
  }
  return blocks;
}

/**
 * 将累积 text buffer 同步到最后一个 text block（对齐 CC GUI syncTextBlocksWithContent）
 */
export function syncTextBlocksWithContent(
  blocks: CcMessageBlock[],
  content: string,
): CcMessageBlock[] {
  const sanitized = stripThinkingTags(content);
  if (!sanitized) return blocks;

  const textIndices = blocks
    .map((block, index) => (block.type === "text" ? index : -1))
    .filter((index) => index >= 0);

  if (textIndices.length === 0) {
    return [...blocks, { type: "text", content: sanitized }];
  }

  const lastTextIdx = textIndices[textIndices.length - 1];
  const prefixText = textIndices
    .slice(0, -1)
    .map((index) => getTextContent(blocks[index]))
    .join("");
  const allText = textIndices.map((index) => getTextContent(blocks[index])).join("");
  const trailingStructuralBlocks = blocks
    .slice(lastTextIdx + 1)
    .filter((block) => block.type === "tool");
  const trailingStructuralSignature = trailingStructuralBlocks.map(toolSignature).join("|");

  if (trailingStructuralSignature && allText && sanitized.startsWith(allText)) {
    const previousBoundary = trailingStructuralBoundary;
    const canReuseBoundary =
      previousBoundary &&
      (trailingStructuralSignature === previousBoundary.signature ||
        trailingStructuralSignature.startsWith(`${previousBoundary.signature}|`));

    if (!canReuseBoundary) {
      trailingStructuralBoundary = {
        signature: trailingStructuralSignature,
        textLength: allText.length,
      };
    }

    const boundary = trailingStructuralBoundary;
    if (boundary && sanitized.length > boundary.textLength) {
      const textBeforeStructural = sanitized.slice(0, boundary.textLength);
      const textAfterStructural = sanitized.slice(boundary.textLength);
      const desiredLastPreToolText = textBeforeStructural.startsWith(prefixText)
        ? textBeforeStructural.slice(prefixText.length)
        : textBeforeStructural;
      const nextBlocks = [...blocks];
      nextBlocks[lastTextIdx] = { type: "text", content: desiredLastPreToolText };
      if (trailingStructuralSignature !== boundary.signature) {
        trailingStructuralBoundary = {
          signature: trailingStructuralSignature,
          textLength: boundary.textLength,
        };
      }
      return [...nextBlocks, { type: "text", content: textAfterStructural }];
    }
  } else if (!trailingStructuralSignature) {
    trailingStructuralBoundary = null;
  }

  if (!sanitized.startsWith(prefixText)) {
    return blocks;
  }

  if (lastTextIdx !== blocks.length - 1) {
    return blocks;
  }

  const desiredLastText = sanitized.slice(prefixText.length);
  if (!desiredLastText) return blocks;

  const currentLastText = getTextContent(blocks[lastTextIdx]);
  if (currentLastText === desiredLastText) return blocks;

  const nextBlocks = [...blocks];
  nextBlocks[lastTextIdx] = { type: "text", content: desiredLastText };
  return nextBlocks;
}

/**
 * 将累积 thinking buffer 同步到最后一个 thinking block（对齐 CC GUI syncThinkingBlocksWithContent）
 */
export function syncThinkingBlocksWithContent(
  blocks: CcMessageBlock[],
  thinking: string,
): CcMessageBlock[] {
  const sanitized = stripThinkingTags(thinking);
  if (!sanitized) return blocks;

  const thinkingIndices = blocks
    .map((block, index) => (block.type === "thinking" ? index : -1))
    .filter((index) => index >= 0);

  if (thinkingIndices.length === 0) {
    return [{ type: "thinking", content: sanitized }, ...blocks];
  }

  const lastThinkingIdx = thinkingIndices[thinkingIndices.length - 1];
  const prefixThinking = thinkingIndices
    .slice(0, -1)
    .map((index) => getThinkingContent(blocks[index]))
    .join("");

  if (!sanitized.startsWith(prefixThinking)) {
    return blocks;
  }

  if (lastThinkingIdx !== blocks.length - 1) {
    return blocks;
  }

  const desiredLastThinking = sanitized.slice(prefixThinking.length);
  if (!desiredLastThinking) return blocks;

  const currentLastThinking = getThinkingContent(blocks[lastThinkingIdx]);
  if (currentLastThinking === desiredLastThinking) return blocks;

  const nextBlocks = [...blocks];
  nextBlocks[lastThinkingIdx] = { type: "thinking", content: desiredLastThinking };
  return nextBlocks;
}

export function applyTokenToBlocks(blocks: CcMessageBlock[], content: string): CcMessageBlock[] {
  if (!content) return blocks;
  const split = splitEmbeddedThinking(content);
  let next = blocks;
  if (split.thinking) {
    const legacy = syncLegacyFromBlocks(blocks);
    const mergedThinking = (legacy.thinking ?? "") + split.thinking;
    next = syncThinkingBlocksWithContent(next, mergedThinking);
  }
  if (!split.text) return next;
  const legacy = syncLegacyFromBlocks(next);
  const mergedText = legacy.content + split.text;
  return syncTextBlocksWithContent(next, mergedText);
}

export function applyThinkingToBlocks(blocks: CcMessageBlock[], content: string): CcMessageBlock[] {
  if (!content) return blocks;
  const legacy = syncLegacyFromBlocks(blocks);
  const mergedThinking = (legacy.thinking ?? "") + stripThinkingTags(content);
  return syncThinkingBlocksWithContent(blocks, mergedThinking);
}

export function applyToolCallToBlocks(
  blocks: CcMessageBlock[],
  tool: { id?: string; name: string; input: string },
): CcMessageBlock[] {
  const id = tool.id?.trim() || undefined;
  if (id && blocks.some((b) => b.type === "tool" && b.id === id)) {
    return blocks;
  }
  return [
    ...blocks,
    {
      type: "tool",
      id,
      name: tool.name,
      input: tool.input,
    },
  ];
}

export function applyToolResultToBlocks(
  blocks: CcMessageBlock[],
  match: { toolUseId?: string; name: string; output: string },
): CcMessageBlock[] {
  const next = blocks.map((block) =>
    block.type === "tool" ? { ...block } : block,
  ) as CcMessageBlock[];

  let target: Extract<CcMessageBlock, { type: "tool" }> | undefined;
  const toolUseId = match.toolUseId?.trim();
  if (toolUseId) {
    const found = next.find((b) => b.type === "tool" && b.id === toolUseId);
    if (found?.type === "tool") target = found;
  }
  if (!target) {
    for (let i = next.length - 1; i >= 0; i -= 1) {
      const block = next[i];
      if (block.type === "tool" && block.name === match.name && !block.output) {
        target = block;
        break;
      }
    }
  }
  if (target) target.output = match.output;
  return next;
}

export function blocksToRenderSegments(blocks: CcMessageBlock[]): CcRenderSegment[] {
  const segments: CcRenderSegment[] = [];
  let toolBuffer: CcToolCallItem[] = [];
  let segIndex = 0;

  const flushTools = () => {
    if (!toolBuffer.length) return;
    segments.push({
      type: "tools",
      items: [...toolBuffer],
      key: `tools-${segIndex++}`,
    });
    toolBuffer = [];
  };

  for (const block of blocks) {
    if (block.type === "tool") {
      toolBuffer.push({
        id: block.id,
        name: block.name,
        input: block.input,
        output: block.output,
      });
      continue;
    }

    flushTools();

    if (block.type === "thinking" && block.content.trim()) {
      segments.push({
        type: "thinking",
        content: block.content,
        key: `thinking-${segIndex++}`,
        isLastThinking: false,
      });
    } else if (block.type === "text" && block.content.trim()) {
      segments.push({
        type: "text",
        content: block.content,
        key: `text-${segIndex++}`,
      });
    }
  }

  flushTools();

  let lastThinkingIdx = -1;
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (segments[i]?.type === "thinking") {
      lastThinkingIdx = i;
      break;
    }
  }
  if (lastThinkingIdx >= 0) {
    const seg = segments[lastThinkingIdx];
    if (seg.type === "thinking") {
      segments[lastThinkingIdx] = { ...seg, isLastThinking: true };
    }
  }

  return segments;
}

export function copyTextFromBlocks(blocks: CcMessageBlock[]): string {
  return blocks
    .filter((b) => b.type === "text")
    .map((b) => b.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function messageHasVisibleBlocks(blocks: CcMessageBlock[]): boolean {
  return blocks.some(
    (b) =>
      (b.type === "text" && b.content.trim()) ||
      (b.type === "thinking" && b.content.trim()) ||
      b.type === "tool",
  );
}
