<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Search, X } from "@lucide/vue";

import {
  listCcContextFiles,
  type CcContextFileEntry,
  type CwdMode,
} from "../../../services/ccWorkbenchService";
import { loadRecentContextPaths } from "../../../utils/ccContextUtils";

const props = defineProps<{
  open: boolean;
  cwdMode: CwdMode;
  projectPath?: string | null;
  modelValue: string[];
}>();

const emit = defineEmits<{
  "update:modelValue": [paths: string[]];
  close: [];
}>();

const query = ref("");
const files = ref<CcContextFileEntry[]>([]);
const recentPaths = ref<string[]>(loadRecentContextPaths());
const loading = ref(false);
const selected = ref<string[]>([...props.modelValue]);

watch(
  () => props.open,
  (open) => {
    if (open) {
      selected.value = [...props.modelValue];
      void refreshFiles();
    }
  },
);

watch(
  () => props.modelValue,
  (value) => {
    selected.value = [...value];
  },
);

async function refreshFiles() {
  loading.value = true;
  try {
    files.value = await listCcContextFiles({
      cwdMode: props.cwdMode,
      projectPath: props.projectPath ?? null,
      query: query.value,
    });
  } finally {
    loading.value = false;
  }
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = files.value;
  if (!q) return list;
  return list.filter(
    (f) => f.path.toLowerCase().includes(q) || f.name.toLowerCase().includes(q),
  );
});

const recentEntries = computed(() =>
  recentPaths.value
    .map((path) => files.value.find((f) => f.path === path) ?? { path, name: path, kind: "file" })
    .filter((entry) => !query.value.trim() || entry.path.toLowerCase().includes(query.value.trim().toLowerCase())),
);

function toggle(path: string) {
  if (selected.value.includes(path)) {
    selected.value = selected.value.filter((p) => p !== path);
  } else {
    selected.value = [...selected.value, path];
  }
}

function confirm() {
  emit("update:modelValue", [...selected.value]);
  emit("close");
}

function removeChip(path: string) {
  selected.value = selected.value.filter((p) => p !== path);
}
</script>

<template>
  <div v-if="open" class="cc-file-picker-backdrop" @click.self="emit('close')">
    <div class="cc-file-picker" data-testid="cc-file-context-picker">
      <header class="cc-file-picker__header">
        <h3>文件上下文</h3>
        <button type="button" class="cc-file-picker__close" aria-label="关闭" @click="emit('close')">
          <X class="h-4 w-4" />
        </button>
      </header>

      <div v-if="selected.length" class="cc-file-picker__chips">
        <span v-for="path in selected" :key="path" class="cc-file-picker__chip">
          {{ path }}
          <button type="button" aria-label="移除" @click="removeChip(path)">×</button>
        </span>
      </div>

      <div class="cc-file-picker__search">
        <Search class="h-3.5 w-3.5 text-muted" />
        <input
          v-model="query"
          type="search"
          placeholder="搜索文件…"
          @input="refreshFiles()"
        />
      </div>

      <div class="cc-file-picker__list">
        <template v-if="recentEntries.length && !loading">
          <p class="cc-file-picker__section">最近使用</p>
          <button
            v-for="file in recentEntries"
            :key="`recent-${file.path}`"
            type="button"
            class="cc-file-picker__item"
            :class="{ 'cc-file-picker__item--active': selected.includes(file.path) }"
            @click="toggle(file.path)"
          >
            <span class="font-medium">{{ file.name }}</span>
            <span class="text-muted">{{ file.path }}</span>
          </button>
        </template>

        <p v-if="loading" class="cc-file-picker__hint">加载中…</p>
        <template v-else>
          <p v-if="filtered.length" class="cc-file-picker__section">全部文件</p>
          <button
            v-for="file in filtered"
            :key="file.path"
            type="button"
            class="cc-file-picker__item"
            :class="{
              'cc-file-picker__item--active': selected.includes(file.path),
              'cc-file-picker__item--folder': file.kind === 'folder',
            }"
            @click="toggle(file.path)"
          >
            <span class="font-medium">{{ file.name }}</span>
            <span class="text-muted">{{ file.path }}</span>
          </button>
        </template>
        <p v-if="!loading && !filtered.length && !recentEntries.length" class="cc-file-picker__hint">暂无文件</p>
      </div>

      <footer class="cc-file-picker__footer">
        <span class="text-muted">已选 {{ selected.length }} 个</span>
        <button type="button" class="cc-file-picker__confirm" @click="confirm">确定</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.cc-file-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, black 35%, transparent);
  padding: 1rem;
}

.cc-file-picker {
  display: flex;
  width: min(28rem, 100%);
  max-height: min(70vh, 32rem);
  flex-direction: column;
  border-radius: 0.875rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 16px 48px color-mix(in srgb, black 18%, transparent);
}

.cc-file-picker__header,
.cc-file-picker__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
}

.cc-file-picker__header {
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
  font-weight: 500;
}

.cc-file-picker__close {
  color: var(--color-muted);
}

.cc-file-picker__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  padding: 0.5rem 1rem 0;
}

.cc-file-picker__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
  color: var(--color-link);
}

.cc-file-picker__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.75rem 1rem 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.4375rem 0.625rem;
}

.cc-file-picker__search input {
  min-width: 0;
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  outline: none;
}

.cc-file-picker__list {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 0 0.5rem 0.5rem;
}

.cc-file-picker__item {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  border-radius: 0.4375rem;
  padding: 0.5rem;
  text-align: left;
  font-size: 0.75rem;
}

.cc-file-picker__item:hover,
.cc-file-picker__item--active {
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
}

.cc-file-picker__item--folder {
  background: color-mix(in srgb, var(--color-paw) 8%, transparent);
}

.cc-file-picker__section {
  padding: 0.375rem 0.5rem 0.125rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-muted);
}

.cc-file-picker__hint {
  padding: 0.75rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-file-picker__footer {
  border-top: 1px solid var(--color-border);
  font-size: 0.75rem;
}

.cc-file-picker__confirm {
  border-radius: 0.4375rem;
  background: var(--color-link);
  padding: 0.375rem 0.75rem;
  color: white;
  font-size: 0.75rem;
}
</style>
