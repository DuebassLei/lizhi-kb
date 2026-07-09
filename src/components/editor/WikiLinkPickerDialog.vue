<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { EditorView } from "@codemirror/view";
import { useDocumentsStore } from "../../stores/documents";
import { filterWikiSuggestions, type WikiSuggestion } from "../../composables/useWikiSuggest";
import { insertWikiLinkTitle } from "../../utils/markdownInsert";
import Btn from "../ui/Btn.vue";

const props = defineProps<{
  open: boolean;
  view: EditorView | null;
}>();

const emit = defineEmits<{
  cancel: [];
}>();

const documents = useDocumentsStore();
const query = ref("");
const selected = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

const items = computed(() => filterWikiSuggestions(query.value, 16));

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    query.value = "";
    selected.value = 0;
    await nextTick();
    inputRef.value?.focus();
  },
);

watch(items, () => {
  selected.value = 0;
});

function pick(item: WikiSuggestion) {
  const view = props.view;
  if (!view) return;
  insertWikiLinkTitle(view, item.title);
  emit("cancel");
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("cancel");
    return;
  }
  if (!items.value.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    selected.value = Math.min(selected.value + 1, items.value.length - 1);
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    selected.value = Math.max(selected.value - 1, 0);
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const item = items.value[selected.value];
    if (item) pick(item);
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[110] flex items-start justify-center bg-overlay px-4 pt-[12vh] backdrop-blur-sm"
      data-testid="wiki-link-picker-dialog"
      @click.self="emit('cancel')"
      @keydown="onKeydown"
    >
      <div
        class="w-full max-w-md rounded-xl border border-border bg-surface-1 shadow-float"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wiki-link-picker-title"
      >
        <div class="border-b border-border px-5 py-4">
          <h3
            id="wiki-link-picker-title"
            class="text-base font-medium tracking-tight text-[var(--color-text)]"
          >
            插入双链
          </h3>
          <p class="mt-1 text-xs text-muted">搜索文档标题，或输入新文档名创建链接</p>
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            class="input-field focus-ring mt-3 w-full"
            placeholder="输入文档名、拼音或首字母…"
            aria-label="搜索文档"
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <ul
          v-if="items.length"
          class="max-h-64 overflow-y-auto py-1"
          role="listbox"
          aria-label="文档列表"
        >
          <li
            v-for="(item, i) in items"
            :key="`${item.id}-${item.title}`"
            role="option"
            :aria-selected="i === selected"
          >
            <button
              type="button"
              class="flex w-full items-center gap-2 px-5 py-2 text-left text-sm transition-colors"
              :class="i === selected ? 'bg-surface-2 text-link' : 'text-text-secondary hover:bg-surface-2/60'"
              @click="pick(item)"
            >
              <span v-if="item.isNew" class="italic">创建「{{ item.title }}」</span>
              <span v-else>[[{{ item.title }}]]</span>
            </button>
          </li>
        </ul>

        <p v-else class="px-5 py-6 text-center text-sm text-muted">
          {{ documents.tree.length ? "无匹配文档" : "知识库暂无其他文档" }}
        </p>

        <div class="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Btn variant="ghost" size="md" @click="emit('cancel')">取消</Btn>
        </div>
      </div>
    </div>
  </Teleport>
</template>
