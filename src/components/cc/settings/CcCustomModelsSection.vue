<script setup lang="ts">
import { computed, ref } from "vue";
import { Plus, Trash2 } from "@lucide/vue";

import { useCcModelCatalog } from "../../../composables/cc/useCcModelCatalog";
import type { CcProviderPublic } from "../../../services/ccWorkbenchService";
import { strip1mSuffix } from "../../../utils/ccChatModels";
import Btn from "../../ui/Btn.vue";
import CcAddModelDialog from "../chat/CcAddModelDialog.vue";

const props = defineProps<{
  providers: CcProviderPublic[];
  activeProvider: CcProviderPublic | null;
}>();

const emit = defineEmits<{
  removed: [baseId: string];
}>();

const catalog = useCcModelCatalog();
const addDialogOpen = ref(false);
const selectedProviderId = ref("");

const providerId = computed(
  () => selectedProviderId.value || props.activeProvider?.id || props.providers[0]?.id || "",
);

const customModels = computed(() => catalog.getCustomModels(providerId.value));

function onAdd(payload: { id: string; label?: string }) {
  if (!providerId.value) return;
  const ok = catalog.addCustomModel(providerId.value, payload.id, payload.label);
  if (!ok) {
    window.alert("模型 ID 无效或已存在");
  }
}

function onRemove(baseId: string) {
  if (!providerId.value) return;
  if (!confirm(`确定删除自定义模型「${baseId}」？`)) return;
  catalog.removeCustomModel(providerId.value, baseId);
  emit("removed", baseId);
}

function syncProviderSelect() {
  if (!selectedProviderId.value && props.activeProvider?.id) {
    selectedProviderId.value = props.activeProvider.id;
  }
}

syncProviderSelect();
</script>

<template>
  <section class="cc-custom-models" data-testid="cc-custom-models-section">
    <div class="cc-custom-models__header">
      <div>
        <h4 class="text-sm font-medium">自定义模型</h4>
        <p class="mt-0.5 text-xs text-muted">
          与会话输入栏共享，按供应商分别管理
        </p>
      </div>
      <Btn variant="secondary" size="sm" @click="addDialogOpen = true">
        <Plus class="mr-1 h-3.5 w-3.5" />
        添加
      </Btn>
    </div>

    <label v-if="providers.length > 1" class="cc-custom-models__provider-select">
      <span>查看供应商</span>
      <select v-model="selectedProviderId" class="cc-custom-models__select">
        <option v-for="p in providers" :key="p.id" :value="p.id">
          {{ p.name }}{{ p.isActive ? "（当前）" : "" }}
        </option>
      </select>
    </label>

    <ul v-if="customModels.length" class="cc-custom-models__list">
      <li v-for="model in customModels" :key="model.id" class="cc-custom-models__item">
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">{{ model.label || model.id }}</p>
          <p class="truncate text-xs text-muted">{{ strip1mSuffix(model.id) }}</p>
        </div>
        <button
          type="button"
          class="cc-custom-models__delete"
          aria-label="删除模型"
          @click="onRemove(model.id)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </li>
    </ul>
    <p v-else class="cc-custom-models__empty">当前供应商暂无自定义模型</p>

    <CcAddModelDialog :open="addDialogOpen" @close="addDialogOpen = false" @add="onAdd" />
  </section>
</template>

<style scoped>
.cc-custom-models {
  margin-top: 1.5rem;
  border-top: 1px solid var(--color-border);
  padding-top: 1.25rem;
}

.cc-custom-models__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.cc-custom-models__provider-select {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.875rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-custom-models__select {
  min-width: 10rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text);
}

.cc-custom-models__list {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cc-custom-models__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.625rem 0.75rem;
}

.cc-custom-models__delete {
  color: var(--color-muted);
}

.cc-custom-models__delete:hover {
  color: #dc2626;
}

.cc-custom-models__empty {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}
</style>
