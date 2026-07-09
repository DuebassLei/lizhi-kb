import { onBeforeUnmount, ref } from "vue";
import {
  clampSidebarWidth,
  loadStoredSidebarWidth,
  saveSidebarWidth,
} from "../utils/sidebarWidthSetting";

export function useSidebarResize() {
  const widthPx = ref(loadStoredSidebarWidth());
  const dragging = ref(false);

  let startX = 0;
  let startWidth = 0;

  function onPointerMove(e: PointerEvent) {
    if (!dragging.value) return;
    const next = clampSidebarWidth(startWidth + (e.clientX - startX));
    widthPx.value = next;
  }

  function endDrag() {
    if (!dragging.value) return;
    dragging.value = false;
    saveSidebarWidth(widthPx.value);
    document.body.classList.remove("sidebar-resizing");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }

  function onResizeStart(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.value = true;
    startX = e.clientX;
    startWidth = widthPx.value;
    document.body.classList.add("sidebar-resizing");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  onBeforeUnmount(endDrag);

  return { widthPx, dragging, onResizeStart };
}
