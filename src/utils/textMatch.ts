import { pinyin } from "pinyin-pro";

/** 子串 + 拼音全拼 + 拼音首字母 + 英文缩写 */
export function matchesTextQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const lower = text.toLowerCase();
  if (lower.includes(q)) return true;

  try {
    const fullPy = pinyin(text, { toneType: "none", type: "array" }).join("").toLowerCase();
    if (fullPy.includes(q)) return true;

    const initials = pinyin(text, { pattern: "first", toneType: "none", type: "array" })
      .join("")
      .toLowerCase();
    if (initials.includes(q) || initials.startsWith(q)) return true;
  } catch {
    // pinyin-pro 失败时回退到子串匹配
  }

  const words = text.split(/[\s\-_/]+/).filter(Boolean);
  const acronym = words.map((w) => w[0]?.toLowerCase() ?? "").join("");
  if (acronym.includes(q) || acronym.startsWith(q)) return true;

  return false;
}

/** 文档标题搜索：子串 + 拼音全拼 + 拼音首字母 + 英文缩写 */
export function matchesDocQuery(title: string, query: string): boolean {
  return matchesTextQuery(title, query);
}

/** Markdown 正文转可检索纯文本（保留标题与段落文字） */
export function markdownToPlainText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]+`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatchIndex(text: string, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return -1;

  const lower = text.toLowerCase();
  const direct = lower.indexOf(q);
  if (direct >= 0) return direct;

  try {
    const fullPy = pinyin(text, { toneType: "none", type: "array" }).join("").toLowerCase();
    const pyIdx = fullPy.indexOf(q);
    if (pyIdx >= 0) return pyIdx;

    const initials = pinyin(text, { pattern: "first", toneType: "none", type: "array" })
      .join("")
      .toLowerCase();
    const initIdx = initials.indexOf(q);
    if (initIdx >= 0) return initIdx;
  } catch {
    // ignore
  }

  return -1;
}

/** 围绕匹配位置截取摘要，用于搜索结果展示 */
export function searchSnippet(text: string, query: string, maxLen = 120): string {
  const plain = text.trim();
  if (!plain) return "（空文档）";
  if (!query.trim()) {
    return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
  }

  const idx = findMatchIndex(plain, query);
  if (idx < 0) {
    return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
  }

  const qLen = query.trim().length;
  const half = Math.floor((maxLen - qLen) / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(plain.length, start + maxLen);
  let snippet = plain.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < plain.length) snippet = `${snippet}…`;
  return snippet;
}

export function contentSnippet(content: string, maxLen = 120): string {
  const plain = content
    .replace(/^#+\s+.+/m, "")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "（空文档）";
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
}
