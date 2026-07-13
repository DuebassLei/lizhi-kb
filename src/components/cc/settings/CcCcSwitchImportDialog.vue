<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { X } from "@lucide/vue";

import {
  pickCcSwitchDbFile,
  previewCcSwitchImport,
  type CcSwitchImportItem,
  type CcSwitchImportPreview,
} from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [providerIds: string[], dbPath: string | null];
}>();

const loading = ref(false);
const preview = ref<CcSwitchImportPreview | null>(null);
const selected = ref<Set<string>>(new Set());
const dbPath = ref<string | null>(null);
const error = ref<string | null>(null);

const allSelected = computed(
  () =>
    preview.value !== null &&
    preview.value.providers.length > 0 &&
    selected.value.size === preview.value.providers.length,
);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      preview.value = null;
      selected.value = new Set();
      dbPath.value = null;
      error.value = null;
      return;
    }
    void loadDefault();
  },
);

async function loadDefault() {
  loading.value = true;
  error.value = null;
  try {
    preview.value = await previewCcSwitchImport(null);
    dbPath.value = preview.value.dbPath;
    selectAllNew();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "读取 cc-switch 失败";
    preview.value = null;
  } finally {
    loading.value = false;
  }
}

async function pickDbFile() {
  const path = await pickCcSwitchDbFile();
  if (!path) return;
  loading.value = true;
  error.value = null;
  try {
    preview.value = await previewCcSwitchImport(path);
    dbPath.value = path;
    selectAllNew();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "读取数据库失败";
  } finally {
    loading.value = false;
  }
}

function selectAllNew() {
  if (!preview.value) return;
  selected.value = new Set(
    preview.value.providers
      .filter((p) => p.status === "new" || p.status === "update")
      .map((p) => p.id),
  );
}

function toggleAll() {
  if (!preview.value) return;
  if (allSelected.value) {
    selected.value = new Set();
    return;
  }
  selected.value = new Set(preview.value.providers.map((p) => p.id));
}

function toggleItem(item: CcSwitchImportItem) {
  const next = new Set(selected.value);
  if (next.has(item.id)) next.delete(item.id);
  else next.add(item.id);
  selected.value = next;
}

function statusLabel(item: CcSwitchImportItem) {
  if (item.status === "new") return "新增";
  if (item.status === "update") return "更新";
  return item.status;
}

function onSave() {
  if (!selected.value.size) return;
  emit("save", [...selected.value], dbPath.value);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cc-dialog">
      <div v-if="open" class="cc-switch-dialog__overlay" @click.self="emit('close')">
        <div class="cc-switch-dialog" data-testid="cc-switch-import-dialog">
          <header class="cc-switch-dialog__header">
            <h3 class="text-sm font-semibold">从 cc-switch 导入</h3>
            <button type="button" class="cc-switch-dialog__close" aria-label="关闭" @click="emit('close')">
              <X class="h-4 w-4" />
            </button>
          </header>

          <div class="cc-switch-dialog__body">
            <div class="cc-switch-dialog__actions">
              <Btn variant="secondary" size="sm" :disabled="loading" @click="loadDefault">
                读取默认数据库
              </Btn>
              <Btn variant="ghost" size="sm" :disabled="loading" @click="pickDbFile">
                选择 cc-switch.db
              </Btn>
            </div>

            <p v-if="dbPath" class="text-xs text-muted break-all">{{ dbPath }}</p>
            <p v-if="loading" class="text-sm text-muted">正在读取 cc-switch 配置…</p>
            <p v-else-if="error" class="text-sm text-red-500">{{ error }}</p>
            <p v-else-if="preview && !preview.providers.length" class="text-sm text-muted">
              未找到 Claude 供应商配置
            </p>

            <template v-else-if="preview">
              <label class="cc-switch-select-all">
                <input type="checkbox" :checked="allSelected" @change="toggleAll" />
                全选（{{ selected.size }}/{{ preview.providers.length }}）
              </label>

              <div class="cc-switch-list">
                <label
                  v-for="item in preview.providers"
                  :key="item.id"
                  class="cc-switch-item"
                  :class="{ 'cc-switch-item--selected': selected.has(item.id) }"
                >
                  <input
                    type="checkbox"
                    :checked="selected.has(item.id)"
                    @change="toggleItem(item)"
                  />
                  <div class="cc-switch-item__body">
                    <div class="cc-switch-item__title">
                      <span class="font-medium">{{ item.name }}</span>
                      <span class="cc-switch-item__badge">{{ statusLabel(item) }}</span>
                    </div>
                    <p v-if="item.baseUrl" class="cc-switch-item__meta">{{ item.baseUrl }}</p>
                    <p v-if="item.model" class="cc-switch-item__meta">{{ item.model }}</p>
                    <p v-if="item.apiKeyMasked" class="cc-switch-item__meta">{{ item.apiKeyMasked }}</p>
                  </div>
                </label>
              </div>
            </template>
          </div>

          <footer class="cc-switch-dialog__footer">
            <Btn variant="ghost" size="sm" @click="emit('close')">取消</Btn>
            <Btn
              variant="secondary"
              size="sm"
              :disabled="!selected.size || loading"
              @click="onSave"
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
.cc-switch-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay, rgba(0, 0, 0, 0.45));
  padding: 1rem;
}

.cc-switch-dialog {
  width: min(100%, 32rem);
  max-height: min(90vh, 36rem);
  display: flex;
  flex-direction: column;
  border-radius: 0.875rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 24px 48px color-mix(in srgb, #000 25%, transparent);
}

.cc-switch-dialog__header,
.cc-switch-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.cc-switch-dialog__footer {
  border-bottom: none;
  border-top: 1px solid var(--color-border);
  justify-content: flex-end;
  gap: 0.5rem;
}

.cc-switch-dialog__body {
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cc-switch-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.cc-switch-dialog__close {
  color: var(--color-muted);
}

.cc-switch-select-all {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-switch-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cc-switch-item {
  display: flex;
  gap: 0.625rem;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  padding: 0.625rem 0.75rem;
  cursor: pointer;
}

.cc-switch-item--selected {
  border-color: color-mix(in srgb, var(--color-link) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-link) 6%, transparent);
}

.cc-switch-item__body {
  min-width: 0;
  flex: 1;
}

.cc-switch-item__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.cc-switch-item__badge {
  border-radius: 999px;
  background: var(--color-surface-1);
  padding: 0 0.375rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-switch-item__meta {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
  word-break: break-all;
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
