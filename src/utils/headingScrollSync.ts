import type { EditorView } from "@codemirror/view";
import type { HeadingItem } from "./headings";

const ANCHOR_OFFSET_PX = 48;

/** 预览标题文案（公众号主题会把正文包在 .content 里） */
export function headingTextOf(el: Element): string {
  const content = el.querySelector(".content");
  return (content?.textContent ?? el.textContent ?? "").trim();
}

export function findHeadingElement(
  container: HTMLElement,
  headingText: string,
  occurrence = 0,
): HTMLElement | null {
  const target = headingText.trim();
  if (!target) return null;
  const tags = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
  let count = 0;
  for (const el of tags) {
    if (headingTextOf(el) !== target) continue;
    if (count === occurrence) return el as HTMLElement;
    count += 1;
  }
  return null;
}

/** 视口锚点附近对应的源码行（0-based） */
export function getEditorAnchorLine(view: EditorView, offsetPx = ANCHOR_OFFSET_PX): number {
  const height = view.scrollDOM.scrollTop + offsetPx;
  const block = view.lineBlockAtHeight(height);
  return view.state.doc.lineAt(block.from).number - 1;
}

export function findActiveHeading(
  headings: HeadingItem[],
  anchorLine: number,
): { heading: HeadingItem; occurrence: number } | null {
  let active: HeadingItem | null = null;
  for (const h of headings) {
    if (h.lineIndex <= anchorLine) active = h;
    else break;
  }
  if (!active) return null;
  const occurrence = headings.filter(
    (h) => h.text === active!.text && h.lineIndex < active!.lineIndex,
  ).length;
  return { heading: active, occurrence };
}

export function syncPreviewByRatio(editorScroll: HTMLElement, preview: HTMLElement): void {
  const editorMax = editorScroll.scrollHeight - editorScroll.clientHeight;
  const ratio = editorMax > 0 ? editorScroll.scrollTop / editorMax : 0;
  const previewMax = preview.scrollHeight - preview.clientHeight;
  preview.scrollTop = ratio * previewMax;
}

export function syncEditorByRatio(preview: HTMLElement, editorScroll: HTMLElement): void {
  const previewMax = preview.scrollHeight - preview.clientHeight;
  const ratio = previewMax > 0 ? preview.scrollTop / previewMax : 0;
  const editorMax = editorScroll.scrollHeight - editorScroll.clientHeight;
  editorScroll.scrollTop = ratio * editorMax;
}

function clampScrollTop(el: HTMLElement, next: number): void {
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  el.scrollTop = Math.max(0, Math.min(next, max));
}

/** 预览视口锚点上方最近的标题（含重复标题 occurrence） */
export function findActivePreviewHeading(
  preview: HTMLElement,
  offsetPx = ANCHOR_OFFSET_PX,
): { text: string; occurrence: number; el: HTMLElement } | null {
  const anchorY = preview.getBoundingClientRect().top + offsetPx;
  const tags = preview.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const seen = new Map<string, number>();
  let best: { text: string; occurrence: number; el: HTMLElement } | null = null;

  for (const node of tags) {
    const el = node as HTMLElement;
    const text = headingTextOf(el);
    const occurrence = seen.get(text) ?? 0;
    seen.set(text, occurrence + 1);
    if (el.getBoundingClientRect().top <= anchorY) {
      best = { text, occurrence, el };
    }
  }
  return best;
}

function resolveHeadingByOccurrence(
  headings: HeadingItem[],
  text: string,
  occurrence: number,
): HeadingItem | null {
  let count = 0;
  for (const h of headings) {
    if (h.text !== text) continue;
    if (count === occurrence) return h;
    count += 1;
  }
  return null;
}

/**
 * 按当前可见标题对齐预览滚动：同源标题出现在编辑器视口中的垂直偏移，
 * 同步到预览侧同一标题。无标题或找不到 DOM 时退回比例滚动。
 */
export function syncPreviewToEditorHeadings(
  view: EditorView,
  preview: HTMLElement,
  headings: HeadingItem[],
): void {
  if (headings.length === 0) {
    syncPreviewByRatio(view.scrollDOM, preview);
    return;
  }

  const anchorLine = getEditorAnchorLine(view);
  const active = findActiveHeading(headings, anchorLine);
  if (!active) {
    preview.scrollTop = 0;
    return;
  }

  const doc = view.state.doc;
  if (active.heading.lineIndex >= doc.lines) {
    syncPreviewByRatio(view.scrollDOM, preview);
    return;
  }

  const line = doc.line(active.heading.lineIndex + 1);
  const block = view.lineBlockAt(line.from);
  const desiredOffset = block.top - view.scrollDOM.scrollTop;

  const el = findHeadingElement(preview, active.heading.text, active.occurrence);
  if (!el) {
    syncPreviewByRatio(view.scrollDOM, preview);
    return;
  }

  const previewRect = preview.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const currentOffset = elRect.top - previewRect.top;
  clampScrollTop(preview, preview.scrollTop + (currentOffset - desiredOffset));
}

/**
 * 预览滚动 → 源码：按预览侧当前标题对齐编辑器同一标题偏移。
 */
export function syncEditorToPreviewHeadings(
  view: EditorView,
  preview: HTMLElement,
  headings: HeadingItem[],
): void {
  if (headings.length === 0) {
    syncEditorByRatio(preview, view.scrollDOM);
    return;
  }

  const active = findActivePreviewHeading(preview);
  if (!active) {
    view.scrollDOM.scrollTop = 0;
    return;
  }

  const match = resolveHeadingByOccurrence(headings, active.text, active.occurrence);
  if (!match || match.lineIndex >= view.state.doc.lines) {
    syncEditorByRatio(preview, view.scrollDOM);
    return;
  }

  const desiredOffset =
    active.el.getBoundingClientRect().top - preview.getBoundingClientRect().top;
  const line = view.state.doc.line(match.lineIndex + 1);
  const block = view.lineBlockAt(line.from);
  clampScrollTop(view.scrollDOM, block.top - desiredOffset);
}
