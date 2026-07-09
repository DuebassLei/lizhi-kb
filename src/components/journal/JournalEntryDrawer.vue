<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Clock, X } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import type { JournalEntry } from "../../types/journal";
import { formatEntryDateTime } from "../../utils/journalDates";
import JournalEntryPreview from "./JournalEntryPreview.vue";

const props = defineProps<{
  entry: JournalEntry | null;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [content: string];
  delete: [];
}>();

const content = ref("");
const preview = ref(false);

watch(
  () => props.entry,
  (entry) => {
    content.value = entry?.content ?? "";
    preview.value = false;
  },
  { immediate: true },
);

const canSave = computed(() => content.value.trim().length > 0);

const entryMeta = computed(() =>
  props.entry ? formatEntryDateTime(props.entry.createdAt) : "",
);

function handleSave() {
  if (!canSave.value) return;
  emit("save", content.value.trim());
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleSave();
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="open && entry"
        class="fixed inset-0 z-50 flex justify-end"
        data-testid="journal-entry-drawer"
      >
        <button
          type="button"
          class="absolute inset-0 bg-overlay backdrop-blur-[2px]"
          aria-label="关闭"
          @click="emit('close')"
        />

        <aside
          class="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface-0 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="journal-drawer-title"
        >
          <header class="shrink-0 border-b border-border px-4 py-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 space-y-1">
                <h2 id="journal-drawer-title" class="text-sm font-semibold">编辑小记</h2>
                <p class="flex items-center gap-1.5 text-[11px] text-muted">
                  <Clock class="h-3 w-3 shrink-0" />
                  <span class="truncate">{{ entryMeta }}</span>
                </p>
              </div>
              <Btn variant="ghost" size="sm" aria-label="关闭" @click="emit('close')">
                <X class="h-4 w-4" />
              </Btn>
            </div>

            <div
              class="mt-3 inline-flex rounded-lg border border-border bg-surface-1/50 p-0.5"
              role="tablist"
              aria-label="编辑模式"
            >
              <button
                type="button"
                role="tab"
                class="journal-drawer-tab"
                :class="{ 'journal-drawer-tab--active': !preview }"
                :aria-selected="!preview"
                @click="preview = false"
              >
                编辑
              </button>
              <button
                type="button"
                role="tab"
                class="journal-drawer-tab"
                :class="{ 'journal-drawer-tab--active': preview }"
                :aria-selected="preview"
                @click="preview = true"
              >
                预览
              </button>
            </div>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto p-4">
            <textarea
              v-if="!preview"
              v-model="content"
              rows="14"
              class="focus-ring journal-drawer-editor"
              placeholder="支持 Markdown 格式"
              @keydown="onKeydown"
            />
            <div v-else class="journal-drawer-preview">
              <JournalEntryPreview :content="content" />
            </div>
          </div>

          <footer class="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
            <Btn variant="ghost" size="sm" class="text-danger/90" @click="emit('delete')">
              删除
            </Btn>
            <div class="flex items-center gap-2">
              <span class="hidden text-[10px] text-muted sm:inline">Ctrl+Enter 保存</span>
              <Btn variant="secondary" size="sm" @click="emit('close')">取消</Btn>
              <Btn variant="primary" size="sm" :disabled="!canSave" @click="handleSave">
                保存
              </Btn>
            </div>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.journal-drawer-tab {
  border-radius: var(--radius-md);
  padding: 0.375rem 0.75rem;
  font-size: var(--text-xs);
  color: var(--color-muted);
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.journal-drawer-tab:hover {
  color: var(--color-text-secondary);
}

.journal-drawer-tab--active {
  background: var(--color-surface-2);
  color: var(--color-text);
  font-weight: 500;
}

.journal-drawer-editor {
  min-height: 280px;
  width: 100%;
  resize: vertical;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 55%, transparent);
  padding: 0.875rem;
  font-size: var(--text-sm);
  line-height: var(--leading-prose);
  color: var(--color-text);
}

.journal-drawer-preview {
  min-height: 280px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 35%, transparent);
  padding: 1rem 1.125rem 1.25rem;
}

.journal-drawer-preview :deep(.journal-doc) {
  font-size: var(--text-md);
  line-height: var(--leading-prose);
  color: var(--color-text-secondary);
}

.journal-drawer-preview :deep(.journal-doc h1) {
  font-size: 1.35rem;
}

.journal-drawer-preview :deep(.journal-doc h2) {
  font-size: 1.15rem;
}

.journal-drawer-preview :deep(.journal-doc h3) {
  font-size: 1.05rem;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-active aside,
.drawer-leave-active aside {
  transition: transform 0.2s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from aside,
.drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
