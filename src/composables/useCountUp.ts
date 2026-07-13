import { onUnmounted, ref, watch, type Ref } from "vue";
import { useReducedMotion } from "./useReducedMotion";

export interface UseCountUpOptions {
  duration?: number;
  locale?: boolean;
  decimals?: number;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function useCountUp(
  target: Ref<number>,
  options: UseCountUpOptions = {},
) {
  const { duration = 600, locale = false, decimals = 0 } = options;
  const reduced = useReducedMotion();
  const display = ref(0);
  let rafId = 0;
  let startTime = 0;
  let from = 0;

  function format(n: number): string {
    const rounded = decimals > 0 ? Number(n.toFixed(decimals)) : Math.round(n);
    return locale ? rounded.toLocaleString("zh-CN") : String(rounded);
  }

  function cancel() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function tick(now: number) {
    if (!startTime) startTime = now;
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = easeOutCubic(progress);
    display.value = from + (target.value - from) * eased;
    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      display.value = target.value;
    }
  }

  function animate() {
    cancel();
    if (reduced.value) {
      display.value = target.value;
      return;
    }
    from = display.value;
    startTime = 0;
    rafId = requestAnimationFrame(tick);
  }

  watch(target, animate, { immediate: true });
  watch(reduced, (r) => {
    if (r) {
      cancel();
      display.value = target.value;
    }
  });

  onUnmounted(cancel);

  const formatted = () => format(display.value);

  return { display, formatted };
}
