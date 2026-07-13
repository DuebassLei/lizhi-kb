import { copyToClipboard } from "../../utils/copyToClipboard";

/** 处理 markdown 预览区点击（代码块复制、文件引用复制；事件委托） */
export async function handlePreviewCodeCopyClick(
  event: MouseEvent,
  showToast: (type: "success" | "error", message: string) => void,
): Promise<void> {
  const target = event.target as HTMLElement | null;

  const fileRef = target?.closest(".preview-file-ref");
  if (fileRef) {
    event.preventDefault();
    event.stopPropagation();
    const text =
      fileRef.getAttribute("data-copy-text")?.trim() ??
      fileRef.textContent?.trim() ??
      "";
    if (!text) {
      showToast("error", "无可复制路径");
      return;
    }
    const ok = await copyToClipboard(text);
    showToast(ok ? "success" : "error", ok ? "已复制路径" : "复制失败");
    return;
  }

  const btn = target?.closest(".preview-code-copy");
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();

  const wrap = btn.closest(".preview-code-wrap");
  const codeEl = wrap?.querySelector("pre.preview-code-block code");
  const text = codeEl?.textContent?.trim() ?? "";
  if (!text) {
    showToast("error", "无可复制内容");
    return;
  }

  const ok = await copyToClipboard(text);
  showToast(ok ? "success" : "error", ok ? "已复制代码" : "复制失败");
}
