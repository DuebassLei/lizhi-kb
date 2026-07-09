import { findHeadingLineIndex } from "./headings";

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

function scrollCmToLine(lineIndex: number): boolean {
  const lineEls = document.querySelectorAll(".cm-editor-host .cm-line");
  const lineEl = lineEls[lineIndex] as HTMLElement | undefined;
  if (lineEl) {
    lineEl.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  const scroller = document.querySelector(".cm-editor-host .cm-scroller") as HTMLElement | null;
  if (scroller) {
    const style = getComputedStyle(scroller);
    const lineHeight = Number.parseFloat(style.lineHeight) || 20;
    scroller.scrollTop = Math.max(0, lineIndex * lineHeight - scroller.clientHeight / 3);
    return true;
  }

  return false;
}

export interface ScrollToDocumentHeadingOptions {
  content: string;
  headingText?: string;
  lineIndex?: number;
  occurrence?: number;
  scrollEditorLine?: (lineIndex: number) => void;
  splitPreviewVisible?: boolean;
  splitPreviewKind?: "gfm" | "wechat";
}

/** 滚动到文档标题（支持分栏预览） */
export function scrollToDocumentHeading(options: ScrollToDocumentHeadingOptions): boolean {
  const {
    content,
    headingText,
    lineIndex: explicitLineIndex,
    occurrence = 0,
    scrollEditorLine,
    splitPreviewVisible = false,
    splitPreviewKind = "gfm",
  } = options;

  let lineIndex = explicitLineIndex;
  if (lineIndex == null && headingText) {
    lineIndex = findHeadingLineIndex(content, headingText, occurrence);
  }
  if (lineIndex == null || lineIndex < 0) return false;

  let ok = false;
  if (scrollEditorLine) {
    scrollEditorLine(lineIndex);
    ok = true;
  } else {
    ok = scrollCmToLine(lineIndex);
  }

  if (splitPreviewVisible && headingText) {
    const selector =
      splitPreviewKind === "wechat"
        ? '[data-testid="wechat-preview-content"]'
        : '[data-testid="markdown-preview"]';
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) {
      ok = scrollToHeadingInContainer(el, headingText, occurrence) || ok;
    }
  }

  return ok;
}
