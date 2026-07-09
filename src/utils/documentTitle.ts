import { normalizeTitle } from "./wikiLinks";

/** 从正文首行提取 H1 标题（仅 `# ` 一级标题，不含 `##`） */
export function extractH1Title(content: string): string | null {
  const line = content.split("\n").find((l) => l.trim());
  if (!line) return null;
  const m = line.trim().match(/^#\s+(.+)$/);
  if (!m) return null;
  return m[1].trim().slice(0, 80) || null;
}

/**
 * 将侧栏标题同步到正文首行，仅当首行明确是文档标题时（H1 或与旧标题匹配）。
 * 避免在正文不以标题开头时强行插入标题行。
 */
export function syncTitleInContent(content: string, oldTitle: string, newTitle: string): string {
  const lines = content.split("\n");
  const firstIdx = lines.findIndex((l) => l.trim());

  if (firstIdx < 0) {
    return content;
  }

  const trimmed = lines[firstIdx].trim();
  const h1Match = trimmed.match(/^#\s+(.*)$/);
  if (!h1Match) {
    return content;
  }

  const lineText = h1Match[1].trim();
  const matchesOldTitle = normalizeTitle(lineText) === normalizeTitle(oldTitle);

  if (!matchesOldTitle) {
    return content;
  }

  lines[firstIdx] = `# ${newTitle}`;
  return lines.join("\n");
}
