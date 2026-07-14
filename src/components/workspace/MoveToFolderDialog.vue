<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Folder } from "@lucide/vue";

import { useFoldersStore } from "../../stores/folders";
import { matchesDocQuery } from "../../utils/textMatch";

const props = defineProps<{
  open: boolean;
  docTitle: string;
  currentFolderId: string;
}>();

const emit = defineEmits<{
  confirm: [folderId: string];
  cancel: [];
}>();

const folders = useFoldersStore();
const query = ref("");
const selected = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

const candidates = computed(() => {
  const current = folders.normalizeFolder(props.currentFolderId);
  const q = query.value.trim();
  return folders.flatFolders
    .filter((f) => f.id !== current)
    .filter((f) => {
      if (!q) return true;
      return (
        matchesDocQuery(f.label, q) ||
        folders.pathLabel(f.id).toLowerCase().includes(q.toLowerCase())
      );
    });
});

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

watch(candidates, () => {
  selected.value = 0;
});

function pick(folderId: string) {
  emit("confirm", folderId);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("cancel");
    return;
  }
  if (!candidates.value.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    selected.value = Math.min(selected.value + 1, candidates.value.length - 1);
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    selected.value = Math.max(selected.value - 1, 0);
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const item = candidates.value[selected.value];
    if (item) pick(item.id);
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[110] flex items-start justify-center bg-overlay px-4 pt-[12vh] backdrop-blur-sm"
      data-testid="move-to-folder-dialog"
      @click.self="emit('cancel')"
      @keydown="onKeydown"
    >
      <div
        class="w-full max-w-md rounded-xl border border-border bg-surface-1 shadow-float"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-to-folder-title"
      >
        <div class="border-b border-border px-5 py-4">
          <h3
            id="move-to-folder-title"
            class="text-base font-medium tracking-tight text-[var(--color-text)]"
          >
            移动到…
          </h3>
          <p class="mt-1 truncate text-xs text-muted" :title="docTitle">
            将「{{ docTitle }}」移动到目标目录
          </p>
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            class="input-field focus-ring mt-3 w-full"
            placeholder="搜索目录名、路径、拼音…"
            aria-label="搜索目录"
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <ul
          v-if="candidates.length"
          class="max-h-72 overflow-y-auto py-1"
          role="listbox"
          aria-label="目录列表"
        >
          <li
            v-for="(folder, i) in candidates"
            :key="folder.id"
            role="option"
            :aria-selected="i === selected"
          >
            <button
              type="button"
              class="flex w-full items-start gap-2 px-5 py-2 text-left text-sm transition-colors"
              :class="
                i === selected
                  ? 'bg-surface-2 text-link'
                  : 'text-text-secondary hover:bg-surface-2/60'
              "
              @mouseenter="selected = i"
              @click="pick(folder.id)"
            >
              <Folder class="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
              <span class="min-w-0">
                <span class="block truncate font-medium">{{ folder.label }}</span>
                <span class="mt-0.5 block truncate text-xs text-muted">
                  {{ folders.pathLabel(folder.id) }}
                </span>
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="px-5 py-8 text-center text-xs text-muted">
          {{ query.trim() ? "没有匹配的目录" : "没有可移动的目标目录" }}
        </p>
      </div>
    </div>
  </Teleport>
</template>
