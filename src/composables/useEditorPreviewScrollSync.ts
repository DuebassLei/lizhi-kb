import type { EditorView } from "@codemirror/view";
import { onBeforeUnmount, watch, type ComputedRef, type Ref } from "vue";

/** 分栏时：编辑器滚动带动右侧预览同步位置 */
export function useEditorPreviewScrollSync(
  editorView: Ref<EditorView | null | undefined>,
  previewRef: Ref<HTMLElement | null> | ComputedRef<HTMLElement | null>,
  enabled: Ref<boolean>,
) {
  let syncing = false;
  let detach: (() => void) | null = null;

  function attach() {
    detach?.();
    detach = null;
    const view = editorView.value;
    const preview = previewRef.value;
    if (!enabled.value || !view || !preview) return;

    const { scrollDOM } = view;

    const onEditorScroll = () => {
      if (syncing) return;
      syncing = true;
      const editorMax = scrollDOM.scrollHeight - scrollDOM.clientHeight;
      const ratio = editorMax > 0 ? scrollDOM.scrollTop / editorMax : 0;
      const previewMax = preview.scrollHeight - preview.clientHeight;
      preview.scrollTop = ratio * previewMax;
      syncing = false;
    };

    scrollDOM.addEventListener("scroll", onEditorScroll, { passive: true });
    detach = () => scrollDOM.removeEventListener("scroll", onEditorScroll);
  }

  watch([editorView, previewRef, enabled], attach, { immediate: true });
  onBeforeUnmount(() => detach?.());
}
