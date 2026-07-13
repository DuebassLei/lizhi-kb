<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { X } from "@lucide/vue";

import type { CcImportPreviewItem } from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";

const props = defineProps<{
  open: boolean;
  title: string;
  loading?: boolean;
  error?: string | null;
  items: CcImportPreviewItem[];
  showConflictMode?: boolean;
  conflictMode?: "skip" | "overwrite" | "rename";
}>();

const emit = defineEmits<{
  close: [];
  confirm: [selectedIds: string[], conflictMode: "skip" | "overwrite" | "rename"];
}>();

const selected = ref<Set<string>>(new Set());
const mode = ref<"skip" | "overwrite" | "rename">("skip");

const allSelected = computed(
  () => props.items.length > 0 && selected.value.size === props.items.length,
);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      selected.value = new Set();
      return;
    }
    mode.value = props.conflictMode ?? "skip";
    selectAllNew();
  },
);

function selectAllNew() {
  selected.value = new Set(
    props.items.filter((i) => i.status !== "error").map((i) => i.id),
  );
}

function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set();
    return;
  }
  selected.value = new Set(props.items.map((i) => i.id));
}

function toggleItem(item: CcImportPreviewItem) {
  const next = new Set(selected.value);
  if (next.has(item.id)) next.delete(item.id);
  else next.add(item.id);
  selected.value = next;
}

function statusLabel(item: CcImportPreviewItem) {
  if (item.status === "new") return "新增";
  if (item.status === "conflict") return "冲突";
  if (item.status === "error") return "错误";
  return item.status;
}

function onConfirm() {
  if (!selected.value.size) return;
  emit("confirm", [...selected.value], mode.value);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cc-dialog">
      <div v-if="open" class="cc-import-dialog__overlay" @click.self="emit('close')">
        <div class="cc-import-dialog" data-testid="cc-import-conflict-dialog">
          <header class="cc-import-dialog__header">
            <h3 class="text-sm font-semibold">{{ title }}</h3>
            <button type="button" class="cc-import-dialog__close" aria-label="关闭" @click="emit('close')">
              <X class="h-4 w-4" />
            </button>
          </header>

          <div class="cc-import-dialog__body">
            <p v-if="loading" class="text-sm text-muted">正在分析导入项…</p>
            <p v-else-if="error" class="text-sm text-red-500">{{ error }}</p>
            <p v-else-if="!items.length" class="text-sm text-muted">未找到可导入项</p>

            <template v-else>
              <div v-if="showConflictMode" class="cc-import-dialog__mode">
                <label class="text-xs text-muted">冲突处理</label>
                <select v-model="mode" class="cc-import-dialog__select">
                  <option value="skip">跳过同名</option>
                  <option value="overwrite">覆盖同名</option>
                  <option value="rename">重命名导入</option>
                </select>
              </div>

              <label class="cc-import-select-all">
                <input type="checkbox" :checked="allSelected" @change="toggleAll" />
                全选（{{ selected.size }}/{{ items.length }}）
              </label>

              <div class="cc-import-list">
                <label
                  v-for="item in items"
                  :key="`${item.id}:${item.sourcePath}`"
                  class="cc-import-item"
                  :class="{ 'cc-import-item--selected': selected.has(item.id) }"
                >
                  <input
                    type="checkbox"
                    :checked="selected.has(item.id)"
                    :disabled="item.status === 'error'"
                    @change="toggleItem(item)"
                  />
                  <div class="cc-import-item__body">
                    <div class="cc-import-item__title">
                      <span class="font-medium">{{ item.name }}</span>
                      <span class="cc-import-item__badge">{{ statusLabel(item) }}</span>
                    </div>
                    <p class="cc-import-item__meta">#{{ item.id }}</p>
                    <p v-if="item.sourcePath" class="cc-import-item__meta break-all">{{ item.sourcePath }}</p>
                    <p v-if="item.message" class="cc-import-item__meta text-red-500">{{ item.message }}</p>
                  </div>
                </label>
              </div>
            </template>
          </div>

          <footer class="cc-import-dialog__footer">
            <Btn variant="ghost" size="sm" @click="emit('close')">取消</Btn>
            <Btn
              variant="secondary"
              size="sm"
              :disabled="!selected.size || loading"
              @click="onConfirm"
            >
              导入选中
            </Btn>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cc-import-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay, rgba(0, 0, 0, 0.45));
  padding: 1rem;
}

.cc-import-dialog {
  width: min(100%, 32rem);
  max-height: min(90vh, 36rem);
  display: flex;
  flex-direction: column;
  border-radius: 0.875rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 24px 48px color-mix(in srgb, #000 25%, transparent);
}

.cc-import-dialog__header,
.cc-import-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.cc-import-dialog__footer {
  border-bottom: none;
  border-top: 1px solid var(--color-border);
  justify-content: flex-end;
  gap: 0.5rem;
}

.cc-import-dialog__body {
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cc-import-dialog__mode {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cc-import-dialog__select {
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  padding: 0.3125rem 0.5rem;
  font-size: 0.75rem;
  background: var(--color-surface-1);
}

.cc-import-dialog__close {
  color: var(--color-muted);
}

.cc-import-select-all {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-import-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cc-import-item {
  display: flex;
  gap: 0.625rem;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  padding: 0.625rem 0.75rem;
  cursor: pointer;
}

.cc-import-item--selected {
  border-color: color-mix(in srgb, var(--color-link) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-link) 6%, transparent);
}

.cc-import-item__body {
  min-width: 0;
  flex: 1;
}

.cc-import-item__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.cc-import-item__badge {
  border-radius: 999px;
  background: var(--color-surface-1);
  padding: 0 0.375rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-import-item__meta {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-dialog-enter-active,
.cc-dialog-leave-active {
  transition: opacity 0.18s ease;
}

.cc-dialog-enter-from,
.cc-dialog-leave-to {
  opacity: 0;
}
</style>
