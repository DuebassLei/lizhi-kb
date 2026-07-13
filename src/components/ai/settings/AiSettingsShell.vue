<script setup lang="ts">
import { onMounted, ref } from "vue";
import Btn from "../../ui/Btn.vue";
import Input from "../../ui/Input.vue";
import { useAiSettings, type AiSettingsTab, type AiSettingsTabInput, normalizeAiSettingsTab } from "../../../composables/useAiSettings";
import { AI_CLOUD_PRESETS } from "../../../utils/aiCloudPresets";
import AiModelDialog from "./AiModelDialog.vue";
import AiModelList from "./AiModelList.vue";
import AiSettingsSidebar from "./AiSettingsSidebar.vue";

const props = withDefaults(
  defineProps<{ revealKeyOnMount?: boolean }>(),
  { revealKeyOnMount: false },
);

const emit = defineEmits<{ saved: [] }>();

const currentTab = ref<AiSettingsTab>("basic");

const settings = useAiSettings({ autoLoad: false });

const {
  loading,
  saving,
  testingId,
  testFeedback,
  config,
  localBaseUrl,
  localModel,
  localEnabled,
  ragTopK,
  providerDrafts,
  selectedPreset,
  modelDialogOpen,
  modelDialogMode,
  dialogProvider,
  networkHint,
  loadConfig,
  onToggleEnabled,
  onToggleCloud,
  onToggleWrite,
  saveRagSettings,
  toggleLocalEnabled,
  toggleCloudProviderEnabled,
  setDefaultCloudProvider,
  deleteCloudProvider,
  openLocalDialog,
  openCloudDialog,
  closeModelDialog,
  saveModelDialog,
  testModelDialog,
  selectTab,
  addProvider,
  addProviderFromPreset,
  runTest,
} = settings;

onMounted(() => {
  void loadConfig(props.revealKeyOnMount);
});

async function onToggleEnabledWrap(event: Event) {
  await onToggleEnabled(event);
  emit("saved");
}

async function onToggleCloudWrap(event: Event) {
  await onToggleCloud(event);
  emit("saved");
}

async function saveRagSettingsWrap() {
  await saveRagSettings();
  emit("saved");
}

async function persistWrap(fn: () => Promise<void>) {
  await fn();
  emit("saved");
}

async function saveModelDialogWrap() {
  await saveModelDialog();
  emit("saved");
}

function onTabChange(tab: AiSettingsTab) {
  currentTab.value = tab;
  selectTab(tab);
}

defineExpose({
  loadConfig,
  selectTab: (tab: AiSettingsTabInput) => {
    const resolved = normalizeAiSettingsTab(tab);
    currentTab.value = resolved;
    selectTab(resolved);
  },
});
</script>

<template>
  <div class="ai-settings-shell" data-testid="ai-settings-shell">
    <AiSettingsSidebar :current="currentTab" @change="onTabChange" />

    <div class="ai-settings-shell__content">
      <div v-if="loading" class="p-4 text-sm text-muted">加载中…</div>

      <template v-else-if="config">
        <section v-show="currentTab === 'basic'" class="ai-settings-panel">
          <h3 class="ai-settings-panel__title">基础配置</h3>
          <p class="ai-settings-panel__desc">{{ networkHint }}</p>
          <label class="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="accent-link"
              :checked="config.enabled"
              :disabled="saving"
              data-testid="ai-enabled-toggle"
              @change="onToggleEnabledWrap"
            />
            启用 AI 助手
          </label>
          <p class="mt-2 text-xs text-muted">开启后工作区侧栏与 /ai 页面可用</p>
        </section>

        <section v-show="currentTab === 'models'" class="ai-settings-panel" data-testid="ai-panel-models">
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="accent-link"
              :checked="config.cloudEnabled"
              :disabled="saving"
              data-testid="ai-cloud-enabled-toggle"
              @change="onToggleCloudWrap"
            />
            启用云端 API（opt-in 外联）
          </label>
          <p class="mt-1 text-xs text-muted">关闭时仅可使用本地 Ollama 与「仅检索」模式</p>

          <div class="mt-4">
            <AiModelList
              :local-enabled="localEnabled"
              :local-model="localModel"
              :local-base-url="localBaseUrl"
              :cloud-enabled="config.cloudEnabled"
              :providers="providerDrafts"
              :active-cloud-provider-id="config.activeCloudProviderId"
              :presets="AI_CLOUD_PRESETS"
              :saving="saving"
              :testing-id="testingId"
              @toggle-local="(v) => persistWrap(() => toggleLocalEnabled(v))"
              @edit-local="openLocalDialog"
              @test-local="runTest('local')"
              @toggle-cloud="(i, v) => persistWrap(() => toggleCloudProviderEnabled(i, v))"
              @set-default="(id) => persistWrap(() => setDefaultCloudProvider(id))"
              @edit-cloud="openCloudDialog"
              @delete-cloud="(i) => persistWrap(() => deleteCloudProvider(i))"
              @test-cloud="(i) => {
                openCloudDialog(i);
                void testModelDialog();
              }"
              @quick-preset="addProviderFromPreset"
              @add-custom="addProvider"
            />
          </div>
        </section>

        <section v-show="currentTab === 'knowledge'" class="ai-settings-panel">
          <h3 class="ai-settings-panel__title">知识库与权限</h3>
          <p class="ai-settings-panel__desc">知识库检索与笔记助手写权限。</p>

          <label class="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="accent-link"
              :checked="config.writeEnabled"
              :disabled="saving"
              data-testid="ai-write-enabled-toggle"
              @change="onToggleWrite"
            />
            笔记助手允许写笔记
          </label>
          <p class="mt-1 text-xs text-muted">关闭时笔记助手仅可搜索与读取</p>

          <div class="mt-4 flex items-end gap-2">
            <div class="min-w-0 flex-1">
              <label class="ai-settings-field-label">RAG 检索条数（1–20）</label>
              <Input v-model="ragTopK" type="number" min="1" max="20" :disabled="saving" />
            </div>
            <Btn variant="secondary" size="sm" :disabled="saving" @click="saveRagSettingsWrap">
              保存
            </Btn>
          </div>
        </section>
      </template>
    </div>

    <AiModelDialog
      :open="modelDialogOpen"
      :mode="modelDialogMode"
      :saving="saving"
      :testing="testingId !== null"
      :test-feedback="testFeedback"
      :local-base-url="localBaseUrl"
      :local-model="localModel"
      :provider="dialogProvider"
      :preset="selectedPreset"
      @close="closeModelDialog"
      @save="saveModelDialogWrap"
      @test="testModelDialog"
      @update:local-base-url="localBaseUrl = $event"
      @update:local-model="localModel = $event"
      @update:provider="dialogProvider = $event"
    />
  </div>
</template>

<style scoped>
.ai-settings-shell {
  display: flex;
  min-height: 0;
  flex: 1;
  background:
    radial-gradient(ellipse 80% 50% at 100% 0%, color-mix(in srgb, var(--color-link) 6%, transparent), transparent),
    var(--color-surface-0);
}

.ai-settings-shell__content {
  min-width: 0;
  flex: 1;
  overflow-y: auto;
}

.ai-settings-panel {
  padding: 1rem 1.125rem 1.25rem;
}

.ai-settings-panel__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.ai-settings-panel__desc {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.ai-settings-field-label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}
</style>
