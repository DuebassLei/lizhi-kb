export function appendToMarkdownContent(current: string, insert: string): string {
  const trimmed = insert.trim();
  if (!trimmed) return current;
  if (!current.trim()) return trimmed;
  if (current.endsWith("\n\n")) return `${current}${trimmed}`;
  if (current.endsWith("\n")) return `${current}\n${trimmed}`;
  return `${current}\n\n${trimmed}`;
}

export function formatCitationInsert(title: string): string {
  const safe = title.trim();
  if (!safe) return "";
  return `> 引用：[[${safe}]]\n\n`;
}
