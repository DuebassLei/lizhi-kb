import { onBeforeUnmount, ref, type Ref } from "vue";
import {
  clampSplitEditorRatio,
  loadStoredSplitEditorRatio,
  saveSplitEditorRatio,
} from "../utils/splitEditorRatioSetting";

export function useSplitPreviewResize(containerRef: Ref<HTMLElement | null>) {
  const editorRatio = ref(loadStoredSplitEditorRatio());
  const dragging = ref(false);

  function onPointerMove(e: PointerEvent) {
    const container = containerRef.value;
    if (!dragging.value || !container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = clampSplitEditorRatio((e.clientX - rect.left) / rect.width);
    editorRatio.value = ratio;
  }

  function endDrag() {
    if (!dragging.value) return;
    dragging.value = false;
    saveSplitEditorRatio(editorRatio.value);
    document.body.classList.remove("split-preview-resizing");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }

  function onResizeStart(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.value = true;
    document.body.classList.add("split-preview-resizing");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  onBeforeUnmount(endDrag);

  return { editorRatio, dragging, onResizeStart };
}
