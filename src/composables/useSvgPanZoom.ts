import { onMounted, onUnmounted, ref, type Ref } from "vue";
import { schedulePersistVaultUiState } from "../services/vaultUiStateService";
import {
  readGraphNodePositionsFromStorage,
  writeGraphNodePositionsToStorage,
} from "../utils/vaultUiStateLocalStorage";

export interface PanZoomState {
  scale: Ref<number>;
  offsetX: Ref<number>;
  offsetY: Ref<number>;
}

export function useSvgPanZoom(_containerRef: Ref<HTMLElement | null>): PanZoomState & {
  onWheel: (e: WheelEvent) => void;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  centerAt: (x: number, y: number) => void;
  transformStyle: Ref<string>;
} {
  const scale = ref(1);
  const offsetX = ref(0);
  const offsetY = ref(0);
  const transformStyle = ref("translate(0px, 0px) scale(1)");

  let panning = false;
  let panStart = { x: 0, y: 0 };
  let offsetStart = { x: 0, y: 0 };

  function syncTransform() {
    transformStyle.value = `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`;
  }

  function clampScale(v: number) {
    return Math.min(3, Math.max(0.25, v));
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    scale.value = clampScale(scale.value + delta);
    syncTransform();
  }

  function onPointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-graph-node], [data-mindmap-node]")) return;
    panning = true;
    panStart = { x: e.clientX, y: e.clientY };
    offsetStart = { x: offsetX.value, y: offsetY.value };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!panning) return;
    offsetX.value = offsetStart.x + (e.clientX - panStart.x);
    offsetY.value = offsetStart.y + (e.clientY - panStart.y);
    syncTransform();
  }

  function onPointerUp(e: PointerEvent) {
    if (!panning) return;
    panning = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function zoomIn() {
    scale.value = clampScale(scale.value + 0.15);
    syncTransform();
  }

  function zoomOut() {
    scale.value = clampScale(scale.value - 0.15);
    syncTransform();
  }

  function resetView() {
    scale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    syncTransform();
  }

  function centerAt(x: number, y: number) {
    // 外层容器已用 translate(-50%, -50%) 将 SVG 原点置于容器中心，
    // 因此只需将目标坐标反向平移缩放后的距离即可居中。
    offsetX.value = -x * scale.value;
    offsetY.value = -y * scale.value;
    syncTransform();
  }

  onMounted(syncTransform);

  return {
    scale,
    offsetX,
    offsetY,
    transformStyle,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    zoomIn,
    zoomOut,
    resetView,
    centerAt,
  };
}

export function loadGraphNodePositions(): Record<string, { x: number; y: number }> {
  return readGraphNodePositionsFromStorage();
}

export function saveGraphNodePosition(id: string, x: number, y: number): void {
  const all = readGraphNodePositionsFromStorage();
  all[id] = { x, y };
  writeGraphNodePositionsToStorage(all);
  schedulePersistVaultUiState();
}

export function useNodeDrag() {
  const dragging = ref<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(
    null,
  );

  function startNodeDrag(id: string, e: PointerEvent, nodeX: number, nodeY: number) {
    e.stopPropagation();
    dragging.value = { id, startX: e.clientX, startY: e.clientY, nodeX, nodeY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function moveNodeDrag(
    e: PointerEvent,
    scale: number,
    onMove: (id: string, x: number, y: number) => void,
  ) {
    if (!dragging.value) return;
    const dx = (e.clientX - dragging.value.startX) / scale;
    const dy = (e.clientY - dragging.value.startY) / scale;
    onMove(dragging.value.id, dragging.value.nodeX + dx, dragging.value.nodeY + dy);
  }

  function endNodeDrag(e: PointerEvent, onEnd: (id: string, x: number, y: number) => void, x: number, y: number) {
    if (!dragging.value) return;
    onEnd(dragging.value.id, x, y);
    dragging.value = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  onUnmounted(() => {
    dragging.value = null;
  });

  return { dragging, startNodeDrag, moveNodeDrag, endNodeDrag };
}
