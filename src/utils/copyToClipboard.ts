/** 复制文本到剪贴板，优先 Clipboard API，失败时降级 execCommand */
export async function copyToClipboard(
  text: string,
  sourceEl?: HTMLElement | null,
): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }

  if (sourceEl) {
    try {
      const range = document.createRange();
      range.selectNodeContents(sourceEl);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const ok = document.execCommand("copy");
      selection?.removeAllRanges();
      if (ok) return true;
    } catch {
      /* fallback below */
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
