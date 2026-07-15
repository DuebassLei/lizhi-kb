/** 将 Markdown 指定行的标题文本替换为 newText，保留原有 # 层级 */
export function updateHeadingLine(
  content: string,
  lineIndex: number,
  newText: string,
): string {
  const lines = content.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) return content;
  const line = lines[lineIndex];
  const m = /^(#{1,6})\s+(.+)$/.exec(line.trimStart());
  if (!m) return content;
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const hashes = m[1];
  const trimmed = newText.replace(/\s+/g, " ").trim();
  if (!trimmed) return content;
  lines[lineIndex] = `${indent}${hashes} ${trimmed}`;
  return lines.join("\n");
}
