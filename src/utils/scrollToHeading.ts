/** 在 Markdown 正文中查找第 n 次出现的标题行索引 */
export function findHeadingLineIndex(content: string, headingText: string, occurrence = 0): number {
  const target = headingText.trim();
  const lines = content.split("\n");
  let count = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+(.+)$/.exec(lines[i].trim());
    if (m && m[2].trim() === target) {
      if (count === occurrence) return i;
      count += 1;
    }
  }
  return -1;
}

/** 在预览 DOM 中滚动到匹配标题 */
export function scrollToHeadingInContainer(container: HTMLElement, headingText: string, occurrence = 0): boolean {
  const target = headingText.trim();
  const tags = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
  let count = 0;
  for (const el of tags) {
    if (el.textContent?.trim() === target) {
      if (count === occurrence) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      count += 1;
    }
  }
  return false;
}

function scrollCmToLine(content: string, headingText: string): boolean {
  const line = findHeadingLineIndex(content, headingText);
  if (line < 0) return false;

  const lineEls = document.querySelectorAll(".cm-line");
  const lineEl = lineEls[line] as HTMLElement | undefined;
  if (lineEl) {
    lineEl.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  const scroller = document.querySelector(".cm-scroller") as HTMLElement | null;
  if (scroller) {
    const style = getComputedStyle(scroller);
    const lineHeight = Number.parseFloat(style.lineHeight) || 20;
    scroller.scrollTop = Math.max(0, line * lineHeight - scroller.clientHeight / 3);
    return true;
  }

  return false;
}

/** 滚动到文档标题（支持分栏预览） */
export function scrollToDocumentHeading(
  headingText: string,
  options: {
    content: string;
    splitPreviewVisible?: boolean;
    splitPreviewKind?: "gfm" | "wechat";
  },
): boolean {
  const { content, splitPreviewVisible = false, splitPreviewKind = "gfm" } = options;

  let ok = scrollCmToLine(content, headingText);

  if (splitPreviewVisible) {
    const selector =
      splitPreviewKind === "wechat"
        ? '[data-testid="wechat-preview-content"]'
        : '[data-testid="markdown-preview"]';
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) {
      ok = scrollToHeadingInContainer(el, headingText) || ok;
    }
  }

  return ok;
}
