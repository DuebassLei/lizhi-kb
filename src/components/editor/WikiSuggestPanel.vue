<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { EditorView } from "@codemirror/view";
import {
  applyWikiSuggestion,
  getWikiSuggestState,
  onWikiSuggestChange,
  wikiSuggestCoords,
  wikiSuggestPlugin,
} from "../../extensions/wikiLinkAutocomplete";
import type { WikiSuggestion } from "../../composables/useWikiSuggest";

const props = defineProps<{
  view: EditorView | null;
}>();

const tick = ref(0);

function bump() {
  tick.value++;
}

const unsubPlugin = onWikiSuggestChange(bump);
onBeforeUnmount(() => {
  unsubPlugin();
});

watch(
  () => props.view,
  (v, _o, onCleanup) => {
    if (!v) return;
    // 面板打开时跟随滚动更新坐标；关闭时不挂监听
    const onScroll = () => {
      if (getWikiSuggestState(v)?.open) bump();
    };
    v.scrollDOM.addEventListener("scroll", onScroll, { passive: true });
    onCleanup(() => {
      v.scrollDOM.removeEventListener("scroll", onScroll);
    });
  },
  { immediate: true },
);

const panel = computed(() => {
  void tick.value;
  const view = props.view;
  if (!view) return null;
  const state = getWikiSuggestState(view);
  if (!state?.open) return null;
  const pos = wikiSuggestCoords(view, state.from);
  if (!pos) return null;
  return { ...state, ...pos };
});

function pickItem(item: WikiSuggestion, index: number) {
  const view = props.view;
  if (!view || !panel.value) return;
  const plugin = view.plugin(wikiSuggestPlugin);
  if (plugin) plugin.state = { ...plugin.state, selected: index };
  applyWikiSuggestion(view, item, panel.value.from, panel.value.to);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="panel"
      class="wiki-suggest-panel"
      :style="{ left: `${panel.left}px`, top: `${panel.top}px` }"
      data-testid="wiki-suggest-panel"
      role="listbox"
      :aria-label="panel.query ? '双链补全' : '选择要链接的文档'"
    >
      <p
        v-if="!panel.query && panel.items.length"
        class="border-b border-border px-2.5 py-1.5 text-[10px] text-muted"
      >
        最近文档 · ↑↓ 选择 · Enter 确认
      </p>
      <p
        v-if="!panel.items.length"
        class="px-2.5 py-2 text-xs text-muted"
      >
        输入文档名搜索，或继续输入创建新链接
      </p>
      <button
        v-for="(item, i) in panel.items"
        :key="`${item.id}-${item.title}`"
        type="button"
        class="wiki-suggest-item"
        :class="{
          'wiki-suggest-item--active': i === panel.selected,
          'wiki-suggest-item--new': item.isNew,
        }"
        role="option"
        :aria-selected="i === panel.selected"
        @mousedown.prevent="pickItem(item, i)"
      >
        <span v-if="item.isNew">创建「{{ item.title }}」</span>
        <span v-else>{{ item.title }}</span>
      </button>
    </div>
  </Teleport>
</template>
