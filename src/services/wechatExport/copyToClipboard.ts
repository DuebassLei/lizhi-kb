function copyRichTextLegacy(html: string): boolean {
  const sel = window.getSelection();
  const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;

  const input = document.createElement("input");
  input.style.position = "absolute";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.focus();

  let success = false;
  const handler = (e: ClipboardEvent) => {
    e.preventDefault();
    if (e.clipboardData) {
      e.clipboardData.setData("text/html", html);
      e.clipboardData.setData("text/plain", html);
      success = true;
    }
    document.removeEventListener("copy", handler);
  };

  document.addEventListener("copy", handler);
  try {
    document.execCommand("copy");
  } catch {
    /* ignore */
  }
  document.removeEventListener("copy", handler);
  document.body.removeChild(input);

  if (range && sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }

  return success;
}

/** 复制 HTML 富文本到系统剪贴板 */
export async function copyRichText(html: string): Promise<boolean> {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([html], { type: "text/plain" }),
        }),
      ]);
      return true;
    } catch {
      /* fall through */
    }
  }
  return copyRichTextLegacy(html);
}
