import { onBeforeUnmount, ref } from "vue";
import {
  clampChatPanelWidth,
  loadStoredChatPanelWidth,
  saveChatPanelWidth,
} from "../utils/chatPanelWidthSetting";

export function useChatPanelResize() {
  const widthPx = ref(loadStoredChatPanelWidth());
  const dragging = ref(false);

  let startX = 0;
  let startWidth = 0;

  function onPointerMove(e: PointerEvent) {
    if (!dragging.value) return;
    const next = clampChatPanelWidth(startWidth + (startX - e.clientX));
    widthPx.value = next;
  }

  function endDrag() {
    if (!dragging.value) return;
    dragging.value = false;
    saveChatPanelWidth(widthPx.value);
    document.body.classList.remove("chat-panel-resizing");
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
    document.body.classList.add("chat-panel-resizing");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  onBeforeUnmount(endDrag);

  return { widthPx, dragging, onResizeStart };
}
