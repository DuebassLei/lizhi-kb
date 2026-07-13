import { computed, ref } from "vue";

import { activateCcProvider } from "./cc/useCcProviderSwitch";
import {
  cwdModeLabel,
  deleteCcProvider,
  getCcWorkbenchConfig,
  getCcWorkbenchStatus,
  installCcSdk,
  pickProjectDirectory,
  saveCcSwitchImport,
  setCcWorkbenchConfig,
  sortCcProviders,
  upsertCcProvider,
  type CcProviderInput,
  type CcProviderPublic,
  type CcSwitchSaveRequest,
  type CcWorkbenchConfigPublic,
  type CcWorkbenchStatus,
  type CwdMode,
} from "../services/ccWorkbenchService";
import { buildCcSettingSourcesSummary } from "../utils/ccSettingSources";
import { useUiStore } from "../stores/ui";

export function useCcWorkbenchSettings() {
  const ui = useUiStore();

  const loading = ref(true);
  const saving = ref(false);
  const installing = ref(false);
  const switchingProvider = ref(false);
  const config = ref<CcWorkbenchConfigPublic | null>(null);
  const status = ref<CcWorkbenchStatus | null>(null);

  const runtimeSummary = computed(() => {
    const s = status.value;
    if (!s) return "检测中…";
    const parts: string[] = [];
    parts.push(s.nodeAvailable ? `Node ${s.nodeVersion ?? ""}` : "Node 未安装");
    parts.push(s.sdkInstalled ? "SDK 已安装" : "SDK 未安装");
    parts.push(s.mcpEnabled ? "MCP 已开启" : "MCP 未开启");
    const mode = config.value?.cwdMode ?? "vault";
    parts.push(`设置 ${buildCcSettingSourcesSummary(mode)}`);
    return parts.join(" · ");
  });

  const providers = computed(() => config.value?.providers ?? []);
  const activeProvider = computed(
    () => providers.value.find((p) => p.isActive) ?? null,
  );

  async function loadAll(revealProviderId?: string | null) {
    loading.value = true;
    try {
      [config.value, status.value] = await Promise.all([
        getCcWorkbenchConfig(Boolean(revealProviderId), revealProviderId),
        getCcWorkbenchStatus(),
      ]);
    } catch (e) {
      ui.showToast("error", e instanceof Error ? e.message : "加载失败");
    } finally {
      loading.value = false;
    }
  }

  async function persist(update: Parameters<typeof setCcWorkbenchConfig>[0]) {
    saving.value = true;
    try {
      config.value = await setCcWorkbenchConfig(update);
      ui.showToast("success", "已保存");
      status.value = await getCcWorkbenchStatus();
      return config.value;
    } catch (e) {
      ui.showToast("error", e instanceof Error ? e.message : "保存失败");
      await loadAll();
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function toggleEnabled(enabled: boolean) {
    return persist({ enabled });
  }

  async function setCwdMode(mode: CwdMode) {
    try {
      config.value = await setCcWorkbenchConfig({ cwdMode: mode });
      if (mode === "project" && !config.value?.projectPath) {
        const path = await pickProjectDirectory();
        if (path) {
          config.value = await setCcWorkbenchConfig({ cwdMode: "project", projectPath: path });
        }
      }
      status.value = await getCcWorkbenchStatus();
      return config.value;
    } catch (e) {
      ui.showToast("error", e instanceof Error ? e.message : "保存失败");
      await loadAll();
      return null;
    }
  }

  async function pickProject() {
    const path = await pickProjectDirectory();
    if (!path) return null;
    return persist({ cwdMode: "project", projectPath: path });
  }

  async function saveProvider(input: CcProviderInput) {
    saving.value = true;
    try {
      config.value = await upsertCcProvider(input);
      ui.showToast("success", "供应商已保存");
      status.value = await getCcWorkbenchStatus();
      return config.value;
    } catch (e) {
      ui.showToast("error", e instanceof Error ? e.message : "保存失败");
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function removeProvider(id: string) {
    saving.value = true;
    try {
      config.value = await deleteCcProvider(id);
      ui.showToast("success", "已删除");
      return config.value;
    } catch (e) {
      ui.showToast("error", e instanceof Error ? e.message : "删除失败");
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function activateProvider(id: string) {
    switchingProvider.value = true;
    try {
      const next = await activateCcProvider(id);
      if (!next) return null;
      config.value = next;
      ui.showToast("success", "已切换供应商");
      status.value = await getCcWorkbenchStatus();
      return config.value;
    } finally {
      switchingProvider.value = false;
    }
  }

  async function sortProviders(orderedIds: string[]) {
    try {
      config.value = await sortCcProviders(orderedIds);
      return config.value;
    } catch (e) {
      ui.showToast("error", e instanceof Error ? e.message : "排序失败");
      await loadAll();
      return null;
    }
  }

  async function importCcSwitch(request: CcSwitchSaveRequest) {
    saving.value = true;
    try {
      config.value = await saveCcSwitchImport(request);
      ui.showToast("success", "cc-switch 导入完成");
      status.value = await getCcWorkbenchStatus();
      return config.value;
    } catch (e) {
      ui.showToast("error", e instanceof Error ? e.message : "导入失败");
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function installSdk() {
    installing.value = true;
    try {
      const msg = await installCcSdk();
      ui.showToast("success", msg);
      status.value = await getCcWorkbenchStatus();
      return true;
    } catch (e) {
      ui.showToast("error", e instanceof Error ? e.message : "安装失败");
      return false;
    } finally {
      installing.value = false;
    }
  }

  return {
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
  };
}

export type { CcProviderPublic };
