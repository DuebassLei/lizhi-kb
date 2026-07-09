/** 光标处是否处于未闭合的 [[wiki 输入中 */
export function wikiLinkQueryAt(
  text: string,
  cursor: number,
): { from: number; to: number; query: string } | null {
  const before = text.slice(0, cursor);
  const openIdx = before.lastIndexOf("[[");
  if (openIdx < 0) return null;

  const afterOpen = before.slice(openIdx + 2);
  if (afterOpen.includes("]]") || afterOpen.includes("\n")) return null;

  return {
    from: openIdx + 2,
    to: cursor,
    query: afterOpen,
  };
}

/** 将文档正文中指向 oldTitle 的 [[...]] 替换为 newTitle */
export function replaceWikiLinkTitle(content: string, oldTitle: string, newTitle: string): string {
  const oldNorm = oldTitle.trim().toLowerCase();
  if (!oldNorm || oldNorm === newTitle.trim().toLowerCase()) return content;

  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (full, linkTitle: string, alias?: string) => {
    if (linkTitle.trim().toLowerCase() !== oldNorm) return full;
    if (alias) return `[[${newTitle}|${alias}]]`;
    return `[[${newTitle}]]`;
  });
}
