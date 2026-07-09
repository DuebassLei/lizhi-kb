import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";

export interface VirtualScrollSlice {
  start: number;
  end: number;
  totalHeight: number;
}

function findStartIndex(offsets: number[], scrollTop: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (offsets[mid] <= scrollTop) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

function findEndIndex(
  offsets: number[],
  heights: number[],
  scrollBottom: number,
  from: number,
): number {
  for (let i = from; i < offsets.length; i++) {
    if (offsets[i] >= scrollBottom) {
      return Math.max(from, i);
    }
    if (offsets[i] + heights[i] > scrollBottom) {
      return i + 1;
    }
  }
  return offsets.length;
}

/**
 * 变高虚拟列表：监听外部滚动容器，仅渲染视口内行。
 */
export function useVirtualScroll(
  scrollEl: Ref<HTMLElement | null | undefined>,
  totalHeight: Ref<number>,
  offsets: Ref<number[]>,
  heights: Ref<number[]>,
  overscan = 8,
) {
  const scrollTop = ref(0);
  const viewportHeight = ref(480);

  const slice = computed<VirtualScrollSlice>(() => {
    const off = offsets.value;
    const h = heights.value;
    if (!off.length) {
      return { start: 0, end: 0, totalHeight: totalHeight.value };
    }

    const top = scrollTop.value;
    const bottom = top + viewportHeight.value;
    const start = Math.max(0, findStartIndex(off, top) - overscan);
    const end = Math.min(off.length, findEndIndex(off, h, bottom, start) + overscan);

    return { start, end, totalHeight: totalHeight.value };
  });

  let scrollTarget: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;

  function syncViewport() {
    if (scrollTarget) {
      viewportHeight.value = scrollTarget.clientHeight || 480;
    }
  }

  function onScroll() {
    if (scrollTarget) {
      scrollTop.value = scrollTarget.scrollTop;
    }
  }

  function detach() {
    if (scrollTarget) {
      scrollTarget.removeEventListener("scroll", onScroll);
    }
    resizeObserver?.disconnect();
    resizeObserver = null;
    scrollTarget = null;
  }

  function attach(el: HTMLElement | null | undefined) {
    detach();
    scrollTarget = el ?? null;
    if (!scrollTarget) return;

    scrollTop.value = scrollTarget.scrollTop;
    syncViewport();
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    resizeObserver = new ResizeObserver(syncViewport);
    resizeObserver.observe(scrollTarget);
  }

  watch(scrollEl, (el) => attach(el), { immediate: true });

  onBeforeUnmount(detach);

  return { slice, scrollTop };
}
