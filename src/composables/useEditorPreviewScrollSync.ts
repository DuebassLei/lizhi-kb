import type { EditorView } from "@codemirror/view";
import { onBeforeUnmount, watch, type ComputedRef, type Ref } from "vue";
import { extractHeadings } from "../utils/headings";
import {
  syncEditorToPreviewHeadings,
  syncPreviewToEditorHeadings,
} from "../utils/headingScrollSync";

/** 分栏时：源码 ⇄ 预览按标题双向对齐（无标题时退回比例） */
export function useEditorPreviewScrollSync(
  editorView: Ref<EditorView | null | undefined>,
  previewRef: Ref<HTMLElement | null> | ComputedRef<HTMLElement | null>,
  enabled: Ref<boolean>,
  content: Ref<string> | ComputedRef<string>,
) {
  let syncingFrom: "editor" | "preview" | null = null;
  let detach: (() => void) | null = null;
  let rafId = 0;
  let pending: "editor" | "preview" | null = null;

  function attach() {
    detach?.();
    detach = null;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    pending = null;

    const view = editorView.value;
    const preview = previewRef.value;
    if (!enabled.value || !view || !preview) return;

    const { scrollDOM } = view;

    const flush = () => {
      rafId = 0;
      const side = pending;
      pending = null;
      if (!side || !enabled.value || syncingFrom) return;

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

    const schedule = (side: "editor" | "preview") => {
      if (syncingFrom && syncingFrom !== side) return;
      pending = side;
      if (rafId) return;
      rafId = requestAnimationFrame(flush);
    };

    const onEditorScroll = () => {
      if (syncingFrom === "preview") return;
      schedule("editor");
    };

    const onPreviewScroll = () => {
      if (syncingFrom === "editor") return;
      schedule("preview");
    };

    scrollDOM.addEventListener("scroll", onEditorScroll, { passive: true });
    preview.addEventListener("scroll", onPreviewScroll, { passive: true });

    detach = () => {
      scrollDOM.removeEventListener("scroll", onEditorScroll);
      preview.removeEventListener("scroll", onPreviewScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      pending = null;
    };
  }

  watch([editorView, previewRef, enabled], attach, { immediate: true });
  onBeforeUnmount(() => detach?.());
}
