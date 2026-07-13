<script setup lang="ts">
import { onMounted, ref } from "vue";
import { FolderOpen } from "@lucide/vue";

import { useCcWorkbenchSettings, type CcProviderPublic } from "../../composables/useCcWorkbenchSettings";
import Btn from "../ui/Btn.vue";
import CcCcSwitchImportDialog from "./settings/CcCcSwitchImportDialog.vue";
import CcCustomModelsSection from "./settings/CcCustomModelsSection.vue";
import CcProviderDialog from "./settings/CcProviderDialog.vue";
import CcProviderList from "./settings/CcProviderList.vue";
import CcSettingsSidebar, { type CcSettingsTab } from "./settings/CcSettingsSidebar.vue";
import CcAgentsSection from "./settings/CcAgentsSection.vue";
import CcSkillsSection from "./settings/CcSkillsSection.vue";
import CcPromptsSection from "./settings/CcPromptsSection.vue";
import CcMcpServersSection from "./settings/CcMcpServersSection.vue";
import CcHooksSection from "./settings/CcHooksSection.vue";
import CcClaudeMdSection from "./settings/CcClaudeMdSection.vue";
import CcPermissionsSection from "./settings/CcPermissionsSection.vue";
import CcUsageStatsSection from "./settings/CcUsageStatsSection.vue";
import CcEnhancedPromptSection from "./settings/CcEnhancedPromptSection.vue";
import CcSdkSection from "./settings/CcSdkSection.vue";
import CcSettingSourcesSection from "./settings/CcSettingSourcesSection.vue";

const props = withDefaults(
  defineProps<{ revealKeyOnMount?: boolean }>(),
  { revealKeyOnMount: false },
);

const emit = defineEmits<{ saved: [] }>();

const currentTab = ref<CcSettingsTab>("providers");
const dialogOpen = ref(false);
const ccSwitchOpen = ref(false);
const editingProvider = ref<CcProviderPublic | null>(null);

const settings = useCcWorkbenchSettings();
const {
  loading,
  saving,
  installing,
  switchingProvider,
  config,
  status,
  runtimeSummary,
  providers,
  activeProvider,
  loadAll,
  toggleEnabled,
  setCwdMode,
  pickProject,
  saveProvider,
  removeProvider,
  activateProvider,
  sortProviders,
  importCcSwitch,
  installSdk,
  cwdModeLabel,
} = settings;

onMounted(() => {
  void loadAll(props.revealKeyOnMount ? undefined : null);
});

function onAddProvider() {
  editingProvider.value = null;
  dialogOpen.value = true;
}

function onEditProvider(provider: CcProviderPublic) {
  void loadAll(provider.id).then(() => {
    editingProvider.value = providers.value.find((p) => p.id === provider.id) ?? provider;
    dialogOpen.value = true;
  });
}

async function onSaveProvider(input: Parameters<typeof saveProvider>[0]) {
  const result = await saveProvider(input);
  if (result) {
    dialogOpen.value = false;
    emit("saved");
  }
}

async function onDeleteProvider(provider: CcProviderPublic) {
  const result = await removeProvider(provider.id);
  if (result) emit("saved");
}

async function onSwitchProvider(id: string) {
  const result = await activateProvider(id);
  if (result) emit("saved");
}

async function onSortProviders(orderedIds: string[]) {
  const result = await sortProviders(orderedIds);
  if (result) emit("saved");
}

function onCustomModelRemoved(baseId: string) {
  void baseId;
  emit("saved");
}

async function onCcSwitchSave(providerIds: string[], dbPath: string | null) {
  const result = await importCcSwitch({ providerIds, dbPath });
  if (result) {
    ccSwitchOpen.value = false;
    emit("saved");
  }
}

async function onToggleEnabled(event: Event) {
  const result = await toggleEnabled((event.target as HTMLInputElement).checked);
  if (result) emit("saved");
}

async function onCwdModeChange(mode: "vault" | "project") {
  const result = await setCwdMode(mode);
  if (result) emit("saved");
}

async function onInstallSdk() {
  const ok = await installSdk();
  if (ok) emit("saved");
}

defineExpose({ refresh: loadAll });
</script>

<template>
  <div class="cc-settings-shell" data-testid="cc-workbench-settings-shell">
    <CcSettingsSidebar :current="currentTab" @change="currentTab = $event" />

    <div class="cc-settings-shell__content">
      <div v-if="loading" class="p-4 text-sm text-muted">加载中…</div>

      <template v-else>
        <section v-show="currentTab === 'basic'" class="cc-settings-panel">
          <h3 class="cc-settings-panel__title">基础配置</h3>
          <p class="cc-settings-panel__desc">{{ runtimeSummary }}</p>
          <label class="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="rounded border-border"
              :checked="config?.enabled"
              :disabled="saving"
              @change="onToggleEnabled"
            />
            启用 Claude Agent 工作台
          </label>
          <p v-if="activeProvider" class="mt-3 text-xs text-muted">
            当前供应商：{{ activeProvider.name }}
            <span v-if="activeProvider.baseUrl"> · {{ activeProvider.baseUrl }}</span>
          </p>
        </section>

        <section v-show="currentTab === 'providers'" class="cc-settings-panel">
          <CcProviderList
            :providers="providers"
            :switching="switchingProvider"
            :sorting="saving"
            @add="onAddProvider"
            @import-cc-switch="ccSwitchOpen = true"
            @edit="onEditProvider"
            @delete="onDeleteProvider"
            @switch="onSwitchProvider"
            @sort="onSortProviders"
          />
          <CcCustomModelsSection
            :providers="providers"
            :active-provider="activeProvider"
            @removed="onCustomModelRemoved"
          />
        </section>

        <section v-show="currentTab === 'runtime'" class="cc-settings-panel cc-settings-panel--flush">
          <CcSdkSection
            :status="status"
            :installing="installing"
            @install="onInstallSdk"
          />
          <CcSettingSourcesSection
            :cwd-mode="config?.cwdMode"
            :project-path="config?.projectPath"
          />
        </section>

        <section v-show="currentTab === 'cwd'" class="cc-settings-panel">
          <h3 class="cc-settings-panel__title">工作目录</h3>
          <p class="cc-settings-panel__desc">
            vault 模式通过 lizhi-mcp 访问加密笔记；项目模式可使用文件工具。
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="cc-cwd-chip"
              :class="{ 'cc-cwd-chip--active': config?.cwdMode === 'vault' }"
              @click="onCwdModeChange('vault')"
            >
              {{ cwdModeLabel("vault") }}
            </button>
            <button
              type="button"
              class="cc-cwd-chip"
              :class="{ 'cc-cwd-chip--active': config?.cwdMode === 'project' }"
              @click="onCwdModeChange('project')"
            >
              {{ cwdModeLabel("project") }}
            </button>
          </div>
          <p v-if="config?.projectPath" class="mt-3 text-xs break-all text-muted">
            {{ config.projectPath }}
          </p>
          <Btn class="mt-3" variant="secondary" size="sm" @click="pickProject().then((r) => r && emit('saved'))">
            <FolderOpen class="mr-1.5 h-3.5 w-3.5" />
            选择项目目录
          </Btn>
          <p class="mt-3 text-xs text-muted">
            切换模式会影响 SDK 加载的 Claude Code 设置源，详见「SDK 依赖」页。
          </p>
        </section>

        <section v-show="currentTab === 'agents'" class="cc-settings-panel cc-settings-panel--flush">
          <CcAgentsSection />
        </section>

        <section v-show="currentTab === 'skills'" class="cc-settings-panel cc-settings-panel--flush">
          <CcSkillsSection />
        </section>

        <section v-show="currentTab === 'prompts'" class="cc-settings-panel cc-settings-panel--flush">
          <CcPromptsSection />
        </section>

        <section v-show="currentTab === 'mcp'" class="cc-settings-panel cc-settings-panel--flush">
          <CcMcpServersSection />
        </section>

        <section v-show="currentTab === 'hooks'" class="cc-settings-panel cc-settings-panel--flush">
          <CcHooksSection />
        </section>

        <section v-show="currentTab === 'claude-md'" class="cc-settings-panel cc-settings-panel--flush">
          <CcClaudeMdSection />
        </section>

        <section v-show="currentTab === 'permissions'" class="cc-settings-panel cc-settings-panel--flush">
          <CcPermissionsSection />
        </section>

        <section v-show="currentTab === 'usage'" class="cc-settings-panel cc-settings-panel--flush">
          <CcUsageStatsSection />
        </section>

        <section v-show="currentTab === 'enhanced-prompt'" class="cc-settings-panel cc-settings-panel--flush">
          <CcEnhancedPromptSection />
        </section>
      </template>
    </div>

    <CcCcSwitchImportDialog
      :open="ccSwitchOpen"
      @close="ccSwitchOpen = false"
      @save="onCcSwitchSave"
    />

    <CcProviderDialog
      :open="dialogOpen"
      :provider="editingProvider"
      :saving="saving"
      @close="dialogOpen = false"
      @save="onSaveProvider"
    />
  </div>
</template>

<style scoped>
.cc-settings-shell {
  display: flex;
  min-height: 0;
  flex: 1;
  background:
    radial-gradient(ellipse 80% 50% at 100% 0%, color-mix(in srgb, var(--color-link) 6%, transparent), transparent),
    var(--color-surface-0);
}

.cc-settings-shell__content {
  min-width: 0;
  flex: 1;
  overflow-y: auto;
}

.cc-settings-panel {
  padding: 1rem 1.125rem 1.25rem;
}

.cc-settings-panel--flush {
  padding-top: 0.75rem;
}

.cc-settings-panel__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-settings-panel__desc {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-cwd-chip {
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-cwd-chip--active {
  border-color: var(--color-link);
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  color: var(--color-link);
}
</style>
