<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { Check, GripVertical, Pencil, Plus, Trash2, Upload } from "@lucide/vue";

import { useDragSort } from "../../../composables/useDragSort";
import type { CcProviderPublic } from "../../../services/ccWorkbenchService";
import { LOCAL_SETTINGS_PROVIDER_ID } from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";
import ConfirmDialog from "../../common/ConfirmDialog.vue";

const props = defineProps<{
  providers: CcProviderPublic[];
  switching?: boolean;
  sorting?: boolean;
}>();

const emit = defineEmits<{
  add: [];
  importCcSwitch: [];
  edit: [provider: CcProviderPublic];
  delete: [provider: CcProviderPublic];
  switch: [id: string];
  sort: [orderedIds: string[]];
}>();

const pinnedIds = [LOCAL_SETTINGS_PROVIDER_ID];
const deletePending = ref<CcProviderPublic | null>(null);

const sortableProviders = computed(() =>
  props.providers.filter((p) => !pinnedIds.includes(p.id)),
);

const pinnedProviders = computed(() =>
  props.providers.filter((p) => pinnedIds.includes(p.id)),
);

const {
  localItems,
  draggedId,
  dragOverId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onPointerDown,
} = useDragSort({
  items: toRef(() => sortableProviders.value),
  pinnedIds,
  onSort: (ids) => emit("sort", ids),
});

const displayProviders = computed(() => [...pinnedProviders.value, ...localItems.value]);

function onDelete(provider: CcProviderPublic) {
  if (provider.isBuiltin && provider.id !== LOCAL_SETTINGS_PROVIDER_ID) return;
  if (provider.id === LOCAL_SETTINGS_PROVIDER_ID) return;
  deletePending.value = provider;
}

function confirmDelete() {
  if (!deletePending.value) return;
  const provider = deletePending.value;
  deletePending.value = null;
  emit("delete", provider);
}

function isSortable(id: string) {
  return !pinnedIds.includes(id);
}
</script>

<template>
  <div class="cc-provider-list" data-testid="cc-provider-list">
    <div class="cc-provider-list__header">
      <div>
        <h3 class="text-sm font-medium">所有供应商</h3>
        <p class="mt-0.5 text-xs text-muted">管理 Claude Agent API 网关，拖拽排序、一键切换</p>
      </div>
      <div class="cc-provider-list__header-actions">
        <Btn variant="ghost" size="sm" @click="emit('importCcSwitch')">
          <Upload class="mr-1 h-3.5 w-3.5" />
          cc-switch
        </Btn>
        <Btn variant="secondary" size="sm" @click="emit('add')">
          <Plus class="mr-1 h-3.5 w-3.5" />
          添加
        </Btn>
      </div>
    </div>

    <div class="cc-provider-list__items">
      <article
        v-for="provider in displayProviders"
        :key="provider.id"
        class="cc-provider-card"
        :class="{
          'cc-provider-card--active': provider.isActive,
          'cc-provider-card--dragging': draggedId === provider.id,
          'cc-provider-card--drag-over': dragOverId === provider.id,
        }"
        :data-drag-sort-id="isSortable(provider.id) ? provider.id : undefined"
        :draggable="isSortable(provider.id) && !sorting"
        @dragstart="onDragStart($event, provider.id)"
        @dragover="onDragOver($event, provider.id)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, provider.id)"
        @dragend="onDragEnd"
        @pointerdown="onPointerDown($event, provider.id)"
      >
        <button
          v-if="isSortable(provider.id)"
          type="button"
          class="cc-provider-card__handle"
          aria-label="拖拽排序"
          tabindex="-1"
        >
          <GripVertical class="h-3.5 w-3.5" />
        </button>

        <div class="cc-provider-card__main">
          <div class="cc-provider-card__title-row">
            <h4 class="cc-provider-card__name">{{ provider.name }}</h4>
            <span v-if="provider.source === 'cc-switch'" class="cc-provider-card__source">cc-switch</span>
            <span v-if="provider.isActive" class="cc-provider-card__badge">
              <Check class="h-3 w-3" />
              使用中
            </span>
          </div>
          <p v-if="provider.remark" class="cc-provider-card__remark">{{ provider.remark }}</p>
          <p v-else-if="provider.baseUrl" class="cc-provider-card__remark">{{ provider.baseUrl }}</p>
          <p v-else-if="provider.id === LOCAL_SETTINGS_PROVIDER_ID" class="cc-provider-card__remark">
            读取 ~/.claude/settings.json 中的 env 配置
          </p>
          <p v-if="provider.model" class="cc-provider-card__model">{{ provider.model }}</p>
        </div>

        <div class="cc-provider-card__actions">
          <button
            v-if="!provider.isActive"
            type="button"
            class="cc-provider-card__btn cc-provider-card__btn--primary"
            :disabled="switching"
            @click="emit('switch', provider.id)"
          >
            {{ provider.id === LOCAL_SETTINGS_PROVIDER_ID ? "授权并启用" : "启用" }}
          </button>
          <button
            v-if="provider.id !== LOCAL_SETTINGS_PROVIDER_ID"
            type="button"
            class="cc-provider-card__btn"
            aria-label="编辑"
            @click="emit('edit', provider)"
          >
            <Pencil class="h-3.5 w-3.5" />
          </button>
          <button
            v-if="!provider.isBuiltin"
            type="button"
            class="cc-provider-card__btn cc-provider-card__btn--danger"
            aria-label="删除"
            @click="onDelete(provider)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </article>
    </div>

    <ConfirmDialog
      :open="!!deletePending"
      title="删除供应商"
      :item-name="deletePending?.name"
      description="删除后无法恢复，请确认是否继续。"
      confirm-label="删除"
      destructive
      test-id="delete-cc-provider-dialog"
      @confirm="confirmDelete"
      @cancel="deletePending = null"
    />
  </div>
</template>

<style scoped>
.cc-provider-list__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.875rem;
}

.cc-provider-list__header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.375rem;
}

.cc-provider-list__items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cc-provider-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-0) 80%, transparent);
  padding: 0.75rem 0.875rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  touch-action: none;
}

.cc-provider-card--active {
  border-color: color-mix(in srgb, var(--color-link) 45%, var(--color-border));
  box-shadow: inset 3px 0 0 var(--color-link);
}

.cc-provider-card--dragging {
  opacity: 0.55;
}

.cc-provider-card--drag-over {
  border-color: var(--color-link);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-link) 30%, transparent);
}

.cc-provider-card__handle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  color: var(--color-muted);
  cursor: grab;
  padding: 0.125rem;
}

.cc-provider-card__main {
  min-width: 0;
  flex: 1;
}

.cc-provider-card__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cc-provider-card__name {
  font-size: 0.8125rem;
  font-weight: 600;
}

.cc-provider-card__source {
  border-radius: 999px;
  background: var(--color-surface-1);
  padding: 0 0.375rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-provider-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-link) 15%, transparent);
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
  color: var(--color-link);
}

.cc-provider-card__remark,
.cc-provider-card__model {
  margin-top: 0.25rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
  word-break: break-all;
}

.cc-provider-card__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.375rem;
}

.cc-provider-card__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.4375rem;
  border: 1px solid var(--color-border);
  padding: 0.3125rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-provider-card__btn:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.cc-provider-card__btn--primary {
  border-color: color-mix(in srgb, var(--color-link) 35%, var(--color-border));
  color: var(--color-link);
}

.cc-provider-card__btn--danger:hover {
  border-color: color-mix(in srgb, var(--color-danger, #ef4444) 40%, var(--color-border));
  color: var(--color-danger, #ef4444);
}
</style>
