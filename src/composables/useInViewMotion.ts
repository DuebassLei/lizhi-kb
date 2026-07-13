import { onMounted, onUnmounted, ref, type Ref } from "vue";

export interface UseInViewMotionOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
}

export function useInViewMotion(
  target: Ref<HTMLElement | null | undefined>,
  options: UseInViewMotionOptions = {},
) {
  const {
    threshold = 0.15,
    rootMargin = "0px",
    once = false,
    onEnter,
    onLeave,
  } = options;

  const inView = ref(false);
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    const el = target.value;
    if (!el || typeof IntersectionObserver === "undefined") {
      inView.value = true;
      onEnter?.();
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          inView.value = true;
          onEnter?.();
          if (once) observer?.disconnect();
        } else if (!once) {
          inView.value = false;
          onLeave?.();
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(el);
  });

  onUnmounted(() => {
    observer?.disconnect();
  });

  return inView;
}
