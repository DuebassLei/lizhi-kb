import type { EditorView } from "@codemirror/view";
import { onBeforeUnmount, watch, type ComputedRef, type Ref } from "vue";
import { extractHeadings } from "../utils/headings";
import {
  syncEditorToPreviewHeadings,
  syncPreviewToEditorHeadings,
} from "../utils/headingScrollSync";
import { createScrollSyncDriver, type ScrollSyncSide } from "../utils/scrollSyncDriver";

/** 预览 HTML debounce 期间暂停标题对齐，避免源码标题与旧 DOM 不一致时乱跳 */
const CONTENT_COOLDOWN_MS = 280;

const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

/** 分栏时：源码 ⇄ 预览按标题双向对齐（无标题时退回比例） */
export function useEditorPreviewScrollSync(
  editorView: Ref<EditorView | null | undefined>,
  previewRef: Ref<HTMLElement | null> | ComputedRef<HTMLElement | null>,
  enabled: Ref<boolean>,
  content: Ref<string> | ComputedRef<string>,
) {
  let syncingFrom: ScrollSyncSide | null = null;
  let detach: (() => void) | null = null;
  let rafId = 0;
  let pending: ScrollSyncSide | null = null;
  let cooldownUntil = 0;
  const driver = createScrollSyncDriver();

  function attach() {
    detach?.();
    detach = null;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    pending = null;
    driver.clear();

    const view = editorView.value;
    const preview = previewRef.value;
    if (!enabled.value || !view || !preview) return;

    const { scrollDOM } = view;

    const flush = () => {
      rafId = 0;
      const side = pending;
      pending = null;
      if (!side || !enabled.value || syncingFrom) return;
      if (!driver.shouldSyncFrom(side)) return;
      if (performance.now() < cooldownUntil) return;

      const currentPreview = previewRef.value;
      const currentView = editorView.value;
      if (!currentPreview || !currentView) return;

      syncingFrom = side;
      try {
        const headings = extractHeadings(content.value);
        if (side === "editor") {
          syncPreviewToEditorHeadings(currentView, currentPreview, headings);
        } else {
          syncEditorToPreviewHeadings(currentView, currentPreview, headings);
        }
      } finally {
        syncingFrom = null;
      }
    };

    const schedule = (side: ScrollSyncSide) => {
      if (syncingFrom && syncingFrom !== side) return;
      if (!driver.shouldSyncFrom(side)) return;
      pending = side;
      if (rafId) return;
      rafId = requestAnimationFrame(flush);
    };

    const armEditor = () => driver.arm("editor");
    const armPreview = () => driver.arm("preview");

    const onEditorScroll = () => {
      if (syncingFrom === "preview") return;
      schedule("editor");
    };

    const onPreviewScroll = () => {
      if (syncingFrom === "editor") return;
      schedule("preview");
    };

    const onEditorKeydown = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) armEditor();
    };

    const userIntentOpts: AddEventListenerOptions = { passive: true, capture: true };
    for (const type of ["wheel", "touchstart", "pointerdown"] as const) {
      scrollDOM.addEventListener(type, armEditor, userIntentOpts);
      preview.addEventListener(type, armPreview, userIntentOpts);
    }
    view.dom.addEventListener("keydown", onEditorKeydown, true);

    scrollDOM.addEventListener("scroll", onEditorScroll, { passive: true });
    preview.addEventListener("scroll", onPreviewScroll, { passive: true });

    detach = () => {
      for (const type of ["wheel", "touchstart", "pointerdown"] as const) {
        scrollDOM.removeEventListener(type, armEditor, userIntentOpts);
        preview.removeEventListener(type, armPreview, userIntentOpts);
      }
      view.dom.removeEventListener("keydown", onEditorKeydown, true);
      scrollDOM.removeEventListener("scroll", onEditorScroll);
      preview.removeEventListener("scroll", onPreviewScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      pending = null;
      driver.clear();
    };
  }

  watch([editorView, previewRef, enabled], attach, { immediate: true });

  watch(content, () => {
    cooldownUntil = performance.now() + CONTENT_COOLDOWN_MS;
  });

  onBeforeUnmount(() => detach?.());
}
