/** 将侧边栏目录树滚动到指定目录行 */
export function scrollToFolderRow(folderId: string): void {
  requestAnimationFrame(() => {
    const row = document.querySelector(
      `[data-folder-id="${CSS.escape(folderId)}"] [data-testid="folder-row"]`,
    );
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}
