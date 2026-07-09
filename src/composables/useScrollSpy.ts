import { onBeforeUnmount, onMounted, ref, type Ref, watch } from "vue";

export function useScrollSpy(sectionIds: string[], scrollRoot: Ref<HTMLElement | null>) {
  const activeId = ref(sectionIds[0] ?? "");
  let ignoreUntil = 0;
  let rafId: number | null = null;
  let unbind: (() => void) | undefined;

  function updateActive() {
    if (Date.now() < ignoreUntil) return;
    const root = scrollRoot.value;
    if (!root) return;

    const anchorLine = root.getBoundingClientRect().top + 96;
    let current = sectionIds[0] ?? "";

    for (const id of sectionIds) {
      const el = root.querySelector(`#${CSS.escape(id)}`);
      if (!el || !(el instanceof HTMLElement)) continue;
      if (el.getBoundingClientRect().top <= anchorLine) {
        current = id;
      }
    }

    activeId.value = current;
  }

  function onScroll() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      updateActive();
    });
  }

  function bind() {
    unbind?.();
    const root = scrollRoot.value;
    if (!root) return;

    root.addEventListener("scroll", onScroll, { passive: true });
    updateActive();
    unbind = () => root.removeEventListener("scroll", onScroll);
  }

  onMounted(() => {
    bind();
  });

  watch(scrollRoot, () => {
    bind();
  });

  onBeforeUnmount(() => {
    unbind?.();
    if (rafId !== null) cancelAnimationFrame(rafId);
  });

  function scrollToSection(id: string) {
    const root = scrollRoot.value;
    const el = root?.querySelector(`#${CSS.escape(id)}`);
    if (!el || !(el instanceof HTMLElement)) return;

    activeId.value = id;
    ignoreUntil = Date.now() + 700;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return { activeId, scrollToSection };
}
