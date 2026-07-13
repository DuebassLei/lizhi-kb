import { onMounted, onUnmounted, ref } from "vue";

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion() {
  const reduced = ref(
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(QUERY).matches
      : false,
  );
  let mql: MediaQueryList | null = null;

  function sync() {
    reduced.value = mql?.matches ?? false;
  }

  onMounted(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    mql = window.matchMedia(QUERY);
    sync();
    mql.addEventListener("change", sync);
  });

  onUnmounted(() => {
    mql?.removeEventListener("change", sync);
  });

  return reduced;
}
