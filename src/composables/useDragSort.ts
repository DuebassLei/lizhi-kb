import { ref, watch, type Ref } from "vue";

export interface DragSortItem {
  id: string;
}

interface UseDragSortOptions<T extends DragSortItem> {
  items: Ref<T[]>;
  onSort: (orderedIds: string[]) => void;
  pinnedIds?: string[];
}

const PROVIDER_SORT_MIME = "application/x-lizhi-provider-sort";

function findDragSortId(x: number, y: number): string | null {
  const element = document.elementFromPoint(x, y);
  const sortable = element?.closest<HTMLElement>("[data-drag-sort-id]");
  return sortable?.dataset.dragSortId ?? null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, a, input, textarea, select, [role="button"]') !== null
  );
}

export function useDragSort<T extends DragSortItem>({
  items,
  onSort,
  pinnedIds = [],
}: UseDragSortOptions<T>) {
  const localItems = ref<T[]>([...items.value]) as Ref<T[]>;
  const draggedId = ref<string | null>(null);
  const dragOverId = ref<string | null>(null);
  let draggedIdRef: string | null = null;

  watch(
    items,
    (next) => {
      localItems.value = [...next];
    },
    { deep: true },
  );

  function clearDragState() {
    draggedIdRef = null;
    draggedId.value = null;
    dragOverId.value = null;
  }

  function sortDraggedToTarget(targetId: string | null) {
    const currentDraggedId = draggedIdRef;
    if (currentDraggedId === null || targetId === null || currentDraggedId === targetId) {
      clearDragState();
      return;
    }

    const sortableItems = localItems.value.filter((item) => !pinnedIds.includes(item.id));
    const draggedIndex = sortableItems.findIndex((item) => item.id === currentDraggedId);
    const targetIndex = sortableItems.findIndex((item) => item.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      clearDragState();
      return;
    }

    const newOrder = [...sortableItems];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    const pinnedItems = localItems.value.filter((item) => pinnedIds.includes(item.id));
    localItems.value = [...pinnedItems, ...newOrder];
    onSort(newOrder.map((item) => item.id));
    clearDragState();
  }

  function onDragStart(event: DragEvent, id: string) {
    if (pinnedIds.includes(id)) return;
    event.stopPropagation();
    draggedIdRef = id;
    draggedId.value = id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", id);
        event.dataTransfer.setData(PROVIDER_SORT_MIME, id);
      } catch {
        // ignore read-only dataTransfer
      }
    }
  }

  function onDragOver(event: DragEvent, id: string) {
    if (pinnedIds.includes(id)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    if (draggedIdRef !== null && draggedIdRef !== id) {
      dragOverId.value = id;
    }
  }

  function onDragLeave() {
    dragOverId.value = null;
  }

  function onDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    event.stopPropagation();
    sortDraggedToTarget(targetId);
  }

  function onDragEnd() {
    clearDragState();
  }

  function onPointerDown(event: PointerEvent, id: string) {
    if (event.button !== 0) return;
    if (pinnedIds.includes(id)) return;
    if (isInteractiveTarget(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    draggedIdRef = id;
    draggedId.value = id;
    dragOverId.value = null;

    const controller = new AbortController();
    const onMove = (moveEvent: PointerEvent) => {
      const targetId = findDragSortId(moveEvent.clientX, moveEvent.clientY);
      dragOverId.value = targetId !== null && targetId !== draggedIdRef ? targetId : null;
    };
    const onUp = (upEvent: PointerEvent) => {
      controller.abort();
      sortDraggedToTarget(findDragSortId(upEvent.clientX, upEvent.clientY));
    };
    const onCancel = () => {
      controller.abort();
      clearDragState();
    };

    window.addEventListener("pointermove", onMove, { signal: controller.signal });
    window.addEventListener("pointerup", onUp, { once: true, signal: controller.signal });
    window.addEventListener("pointercancel", onCancel, { once: true, signal: controller.signal });
  }

  return {
    localItems,
    draggedId,
    dragOverId,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    onPointerDown,
  };
}
