export interface CcSubagentSegment {
  type: "thinking" | "text";
  content: string;
}

function parseJsonSafe(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 从文本中拆分 `` / `<thinking>` 块 */
export function splitThinkingFromText(text: string): CcSubagentSegment[] {
  const segments: CcSubagentSegment[] = [];
  const thinkRegex = /<\s*(?:think|thinking)\s*>([\s\S]*?)<\s*\/\s*(?:think|thinking)\s*>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = thinkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index).trim();
      if (before) segments.push({ type: "text", content: before });
    }
    const thinking = match[1]?.trim();
    if (thinking) segments.push({ type: "thinking", content: thinking });
    lastIndex = match.index + match[0].length;
  }

  const tail = text.slice(lastIndex).trim();
  if (tail) segments.push({ type: "text", content: tail });

  if (!segments.length && text.trim()) {
    segments.push({ type: "text", content: text.trim() });
  }

  return segments;
}

/** 解析 SDK 子代理 tool_result 为结构化片段（对齐 CC GUI） */
export function parseSubagentOutputRaw(raw: string | undefined): CcSubagentSegment[] {
  if (!raw?.trim()) return [];

  const trimmed = raw.trim();
  const parsed = parseJsonSafe(trimmed);

  if (Array.isArray(parsed)) {
    const segments: CcSubagentSegment[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const blockType = String(obj.type ?? "").toLowerCase();
      if (blockType === "text" && typeof obj.text === "string") {
        segments.push(...splitThinkingFromText(obj.text));
      } else if (blockType === "thinking" && typeof obj.thinking === "string") {
        segments.push({ type: "thinking", content: obj.thinking.trim() });
      }
    }
    if (segments.length) return segments;
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    for (const key of ["result", "output", "content", "response", "text", "message", "summary"]) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) {
        return splitThinkingFromText(value.trim());
      }
    }
  }

  return splitThinkingFromText(trimmed);
}

/** 提取纯文本输出（供状态栏摘要等） */
export function formatSubagentOutputPlain(raw: string | undefined): string | undefined {
  const segments = parseSubagentOutputRaw(raw);
  if (!segments.length) return undefined;
  const textParts = segments.filter((s) => s.type === "text").map((s) => s.content);
  if (textParts.length) return textParts.join("\n\n").trim();
  return segments.map((s) => s.content).join("\n\n").trim();
}
