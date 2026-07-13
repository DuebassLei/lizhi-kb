import { onBeforeUnmount, ref } from "vue";
import {
  clampCcWorkbenchDrawerWidth,
  loadStoredCcWorkbenchDrawerWidth,
  saveCcWorkbenchDrawerWidth,
} from "../utils/ccWorkbenchDrawerWidthSetting";

export function useCcWorkbenchDrawerResize() {
  const widthPx = ref(loadStoredCcWorkbenchDrawerWidth());
  const dragging = ref(false);

  let startX = 0;
  let startWidth = 0;

  function onPointerMove(e: PointerEvent) {
    if (!dragging.value) return;
    widthPx.value = clampCcWorkbenchDrawerWidth(startWidth + (startX - e.clientX));
  }

  function endDrag() {
    if (!dragging.value) return;
    dragging.value = false;
    saveCcWorkbenchDrawerWidth(widthPx.value);
    document.body.classList.remove("cc-workbench-drawer-resizing");
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
    document.body.classList.add("cc-workbench-drawer-resizing");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  onBeforeUnmount(endDrag);

  return { widthPx, dragging, onResizeStart };
}
