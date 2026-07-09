<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import type { EditorView } from "@codemirror/view";
import { wikiLinkTitleAt } from "../../utils/wikiLinkAt";
import { useLinksStore } from "../../stores/links";

const props = defineProps<{
  view: EditorView | null;
}>();

const links = useLinksStore();
const visible = ref(false);
const title = ref("");
const snippet = ref("");
const pos = ref({ x: 0, y: 0 });
let timer: ReturnType<typeof setTimeout> | null = null;

function hide() {
  visible.value = false;
  title.value = "";
  snippet.value = "";
}

function scheduleCheck(view: EditorView, event: MouseEvent) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void (async () => {
      const coords = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (coords == null) {
        hide();
        return;
      }
      const t = wikiLinkTitleAt(view.state.doc.toString(), coords);
      if (!t) {
        hide();
        return;
      }
      await links.ensureSnippetForTitle(t);
      title.value = t;
      snippet.value = links.getSnippetByTitle(t) ?? "（暂无预览）";
      const host = view.dom.closest(".editor-shell") as HTMLElement | null;
      if (host) {
        const rect = host.getBoundingClientRect();
        pos.value = {
          x: Math.min(event.clientX - rect.left + 12, rect.width - 260),
          y: event.clientY - rect.top + 12,
        };
      }
      visible.value = true;
    })();
  }, 500);
}

function bindView(view: EditorView) {
  const onMove = (e: MouseEvent) => scheduleCheck(view, e);
  const onLeave = () => {
    if (timer) clearTimeout(timer);
    hide();
  };
  view.dom.addEventListener("mousemove", onMove);
  view.dom.addEventListener("mouseleave", onLeave);
  return () => {
    view.dom.removeEventListener("mousemove", onMove);
    view.dom.removeEventListener("mouseleave", onLeave);
    if (timer) clearTimeout(timer);
  };
}

let cleanup: (() => void) | null = null;

watch(
  () => props.view,
  (v) => {
    cleanup?.();
    cleanup = v ? bindView(v) : null;
    if (!v) hide();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  cleanup?.();
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div
    v-if="visible"
    class="wiki-hover-preview pointer-events-none absolute z-50 w-64 rounded-lg border border-border bg-surface-1 p-3 shadow-lg"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    data-testid="wiki-hover-preview"
  >
    <p class="text-xs font-medium text-link">[[{{ title }}]]</p>
    <p class="mt-2 line-clamp-6 text-[11px] leading-relaxed text-muted">{{ snippet }}</p>
  </div>
</template>

<style scoped>
.wiki-hover-preview {
  animation: wiki-preview-in 0.15s ease-out;
}
@keyframes wiki-preview-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
