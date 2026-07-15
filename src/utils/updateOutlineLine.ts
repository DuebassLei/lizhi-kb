import { updateHeadingLine } from "./updateHeadingLine";

/** 回写大纲节点对应行：保留标题 # / 列表标记与缩进 */
export function updateOutlineLine(
  content: string,
  lineIndex: number,
  newText: string,
): string {
  const lines = content.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) return content;
  const trimmed = newText.replace(/\s+/g, " ").trim();
  if (!trimmed) return content;

  const line = lines[lineIndex];
  if (/^#{1,6}\s+/.test(line.trimStart())) {
    return updateHeadingLine(content, lineIndex, trimmed);
  }

  const listMatch = /^(\s*)([-*+]|\d+\.)\s+(.+)$/.exec(line);
  if (listMatch) {
    lines[lineIndex] = `${listMatch[1]}${listMatch[2]} ${trimmed}`;
    return lines.join("\n");
  }

  const indent = line.match(/^\s*/)?.[0] ?? "";
  lines[lineIndex] = `${indent}${trimmed}`;
  return lines.join("\n");
}
