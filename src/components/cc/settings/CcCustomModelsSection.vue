<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, Plus, Trash2, Upload } from "@lucide/vue";
import { open, save } from "@tauri-apps/plugin-dialog";

import { useCcModelCatalog } from "../../../composables/cc/useCcModelCatalog";
import { tauriInvoke } from "../../../composables/useTauriCommand";
import type { CcProviderPublic } from "../../../services/ccWorkbenchService";
import { isTauriRuntime } from "../../../services/vaultService";
import { strip1mSuffix } from "../../../utils/ccChatModels";
import Btn from "../../ui/Btn.vue";
import ConfirmDialog from "../../common/ConfirmDialog.vue";
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
const deletePending = ref<string | null>(null);

const providerId = computed(
  () => selectedProviderId.value || props.activeProvider?.id || props.providers[0]?.id || "",
);

const customModels = computed(() => catalog.getCustomModels(providerId.value));

function onAdd(payload: { id: string; label?: string; inputPrice?: number; outputPrice?: number }) {
  if (!providerId.value) return;
  const ok = catalog.addCustomModel(providerId.value, payload.id, payload.label, {
    inputPrice: payload.inputPrice,
    outputPrice: payload.outputPrice,
  });
  if (!ok) {
    window.alert("模型 ID 无效或已存在");
  }
}

function onRemove(baseId: string) {
  if (!providerId.value) return;
  deletePending.value = baseId;
}

function confirmRemove() {
  if (!providerId.value || !deletePending.value) return;
  const baseId = deletePending.value;
  deletePending.value = null;
  catalog.removeCustomModel(providerId.value, baseId);
  emit("removed", baseId);
}

function syncProviderSelect() {
  if (!selectedProviderId.value && props.activeProvider?.id) {
    selectedProviderId.value = props.activeProvider.id;
  }
}

async function exportModels() {
  const json = catalog.exportCustomModelsJson();
  if (!isTauriRuntime()) {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cc-custom-models.json";
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const path = await save({
    title: "导出自定义模型",
    defaultPath: "cc-custom-models.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return;
  await tauriInvoke<void>("write_export_file", { path, content: json });
}

async function importModels() {
  if (!isTauriRuntime()) {
    window.alert("请在 Tauri 桌面应用中导入");
    return;
  }
  const path = await open({
    title: "导入自定义模型",
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path || typeof path !== "string") return;
  const merge = confirm("确定导入？\n确定 = 合并到现有列表\n取消 = 放弃");
  if (!merge) return;
  try {
    const raw = await tauriInvoke<string>("read_text_file", { path });
    const result = catalog.importCustomModelsJson(raw, "merge");
    window.alert(`导入完成：新增 ${result.added}，跳过 ${result.skipped}`);
  } catch (e) {
    window.alert(e instanceof Error ? e.message : "导入失败");
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
      <div class="flex flex-wrap gap-2">
        <Btn variant="secondary" size="sm" @click="exportModels">
          <Download class="mr-1 h-3.5 w-3.5" />
          导出
        </Btn>
        <Btn variant="secondary" size="sm" @click="importModels">
          <Upload class="mr-1 h-3.5 w-3.5" />
          导入
        </Btn>
        <Btn variant="secondary" size="sm" @click="addDialogOpen = true">
          <Plus class="mr-1 h-3.5 w-3.5" />
          添加
        </Btn>
      </div>
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

    <ConfirmDialog
      :open="!!deletePending"
      title="删除自定义模型"
      :item-name="deletePending ?? undefined"
      description="删除后无法恢复，请确认是否继续。"
      confirm-label="删除"
      destructive
      test-id="delete-cc-custom-model-dialog"
      @confirm="confirmRemove"
      @cancel="deletePending = null"
    />
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
