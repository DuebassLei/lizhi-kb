/** 判断是否为可导入的 Markdown 文本文件 */
export function isMarkdownFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt");
}

/** 从文件名提取默认标题（去掉扩展名） */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.(md|markdown|txt)$/i, "").trim();
  return base.slice(0, 80) || "无标题";
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"));
    reader.readAsText(file, "UTF-8");
  });
}

/** 拖放事件是否携带外部文件 */
export function isExternalFileDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}
