import { computed, onMounted, ref, watch } from "vue";
import {
  getAiConfig,
  setAiConfig,
  testAiConnection,
  type AiConfigPublic,
  type CloudProviderInput,
  type LlmTarget,
} from "../services/aiService";
import { useChatStore } from "../stores/chat";
import { useUiStore } from "../stores/ui";
import {
  findPresetByBaseUrl,
  findPresetById,
  providerMatchesPreset,
  type AiCloudPreset,
} from "../utils/aiCloudPresets";

export type AiSettingsTab = "basic" | "models" | "knowledge";
/** @deprecated 使用 AiSettingsTab */
export type AiModelTab = "local" | "cloud";

export type AiSettingsTabInput = AiSettingsTab | AiModelTab;

export function normalizeAiSettingsTab(tab: AiSettingsTabInput): AiSettingsTab {
  if (tab === "local" || tab === "cloud") return "models";
  return tab;
}

export interface ProviderDraft {
  id?: string;
  presetId?: string;
  name: string;
  baseUrl: string;
  model: string;
  /** 文生图模型 */
  imageModel: string;
  apiKey: string;
  apiKeyMasked: string;
  enabled?: boolean;
}

export type TestFeedback = { type: "success" | "error"; message: string };

export function useAiSettings(options?: { autoLoad?: boolean }) {
  const ui = useUiStore();
  const chat = useChatStore();

  const loading = ref(true);
  const saving = ref(false);
  const testingId = ref<LlmTarget | null>(null);
  const testFeedback = ref<TestFeedback | null>(null);
  const config = ref<AiConfigPublic | null>(null);

  const localBaseUrl = ref("http://127.0.0.1:11434");
  const localModel = ref("qwen2.5:7b");
  const ragTopK = ref("8");

  const providerDrafts = ref<ProviderDraft[]>([]);
  const selectedIndex = ref<number | null>(null);
  const activeTab = ref<AiSettingsTab>("basic");

  const modelDialogOpen = ref(false);
  const modelDialogMode = ref<"local" | "cloud">("local");
  const modelDialogIndex = ref<number | null>(null);
  const dialogProvider = ref<ProviderDraft | null>(null);

  const selectedProvider = computed(() =>
    selectedIndex.value !== null ? providerDrafts.value[selectedIndex.value] ?? null : null,
  );

  const selectedPreset = computed(() => {
    const provider = dialogProvider.value ?? selectedProvider.value;
    if (!provider) return null;
    if (provider.presetId) {
      return findPresetById(provider.presetId) ?? null;
    }
    return findPresetByBaseUrl(provider.baseUrl) ?? null;
  });

  const selectedPresetModel = computed(() => {
    const preset = selectedPreset.value;
    const provider = selectedProvider.value;
    if (!preset || !provider) return null;
    return preset.models.find((m) => m.id === provider.model) ?? null;
  });

  function draftFromPreset(preset: AiCloudPreset): ProviderDraft {
    const defaultImage =
      preset.models.find((m) => m.kind === "image")?.id ?? "";
    return {
      presetId: preset.id,
      name: preset.name,
      baseUrl: preset.baseUrl,
      model: preset.model,
      imageModel: defaultImage,
      apiKey: "",
      apiKeyMasked: "",
      enabled: true,
    };
  }

  function newProviderDraft(): ProviderDraft {
    return {
      name: "新提供商",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      imageModel: "",
      apiKey: "",
      apiKeyMasked: "",
      enabled: true,
    };
  }

  function providerRowKey(index: number, provider: ProviderDraft): string {
    return provider.id ?? `new-${index}`;
  }

  function hasApiKey(provider: ProviderDraft): boolean {
    return Boolean(provider.apiKey.trim() || provider.apiKeyMasked);
  }

  function hostLabel(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  async function loadConfig(revealKey = false, quiet = false) {
    if (!quiet) loading.value = true;
    try {
      config.value = await getAiConfig(revealKey);
      localBaseUrl.value = config.value.localBaseUrl;
      localModel.value = config.value.localModel;
      ragTopK.value = String(config.value.ragTopK);
      providerDrafts.value = config.value.cloudProviders.map((p) => {
        const baseUrl = p.baseUrl;
        const preset = findPresetByBaseUrl(baseUrl);
        return {
          id: p.id,
          presetId: preset?.id,
          name: p.name,
          baseUrl: p.baseUrl,
          model: p.model,
          imageModel: p.imageModel ?? "",
          apiKey: p.apiKey ?? "",
          apiKeyMasked: p.apiKeyMasked,
          enabled: p.enabled !== false,
        };
      });
    if (
      selectedIndex.value !== null &&
      selectedIndex.value >= providerDrafts.value.length
    ) {
      selectedIndex.value = providerDrafts.value.length ? 0 : null;
    } else if (providerDrafts.value.length && selectedIndex.value === null) {
      selectedIndex.value = 0;
    }
    } catch (e) {
      if (!quiet) {
        ui.showToast("error", e instanceof Error ? e.message : "加载 AI 配置失败");
      }
    } finally {
      if (!quiet) loading.value = false;
    }
  }

  function toProviderInput(d: ProviderDraft): CloudProviderInput {
    const input: CloudProviderInput = {
      id: d.id,
      name: d.name.trim(),
      baseUrl: d.baseUrl.trim(),
      model: d.model.trim(),
      imageModel: d.imageModel.trim(),
      enabled: d.enabled !== false,
    };
    if (d.apiKey.trim()) {
      input.apiKey = d.apiKey.trim();
    }
    return input;
  }

  async function persist(
    update: Parameters<typeof setAiConfig>[0],
    persistOptions?: { quiet?: boolean },
  ) {
    if (!config.value) return;
    const quiet = persistOptions?.quiet ?? false;
    saving.value = true;
    try {
      config.value = await setAiConfig(update);
      if (!quiet) ui.showToast("success", "AI 配置已保存");
      void chat.loadAiEnabled();
      await loadConfig(true, quiet);
    } catch (e) {
      ui.showToast("error", e instanceof Error ? e.message : "保存失败");
      await loadConfig(false, quiet);
    } finally {
      saving.value = false;
    }
  }

  async function onToggleEnabled(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    await persist({ enabled: checked });
  }

  async function onToggleCloud(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    await persist({ cloudEnabled: checked });
  }

  async function onToggleWrite(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    await persist({ writeEnabled: checked });
  }

  async function saveLocalSettings() {
    await persist({
      localBaseUrl: localBaseUrl.value.trim(),
      localModel: localModel.value.trim(),
    });
  }

  async function saveRagSettings() {
    const topK = Number.parseInt(ragTopK.value, 10);
    await persist({
      ragTopK: Number.isFinite(topK) ? topK : 8,
    });
  }

  async function saveCloudProviders(quiet = false) {
    await persist(
      {
        cloudProviders: providerDrafts.value.map(toProviderInput),
        activeCloudProviderId:
          config.value?.activeCloudProviderId ??
          providerDrafts.value[0]?.id ??
          null,
      },
      { quiet },
    );
  }

  async function toggleLocalEnabled(enabled: boolean) {
    await persist({ localEnabled: enabled });
  }

  async function toggleCloudProviderEnabled(index: number, enabled: boolean) {
    const draft = providerDrafts.value[index];
    if (!draft) return;
    draft.enabled = enabled;
    let activeId = config.value?.activeCloudProviderId ?? null;
    if (!enabled && draft.id && draft.id === activeId) {
      activeId =
        providerDrafts.value.find((p, i) => i !== index && p.enabled !== false && p.id)?.id ?? null;
    }
    if (enabled && draft.id && !activeId) {
      activeId = draft.id;
    }
    await persist({
      cloudProviders: providerDrafts.value.map(toProviderInput),
      activeCloudProviderId: activeId,
    });
  }

  async function setDefaultCloudProvider(providerId: string) {
    await persist({ activeCloudProviderId: providerId });
  }

  async function deleteCloudProvider(index: number) {
    const removed = providerDrafts.value[index];
    providerDrafts.value.splice(index, 1);
    let activeId = config.value?.activeCloudProviderId ?? null;
    if (removed?.id && removed.id === activeId) {
      activeId = providerDrafts.value.find((p) => p.enabled !== false && p.id)?.id ?? null;
    }
    await persist({
      cloudProviders: providerDrafts.value.map(toProviderInput),
      activeCloudProviderId: activeId,
    });
  }

  function openLocalDialog() {
    modelDialogMode.value = "local";
    modelDialogIndex.value = null;
    dialogProvider.value = null;
    modelDialogOpen.value = true;
  }

  function openCloudDialog(index: number) {
    const draft = providerDrafts.value[index];
    if (!draft) return;
    modelDialogMode.value = "cloud";
    modelDialogIndex.value = index;
    dialogProvider.value = { ...draft };
    modelDialogOpen.value = true;
  }

  function closeModelDialog() {
    modelDialogOpen.value = false;
    dialogProvider.value = null;
    modelDialogIndex.value = null;
    testFeedback.value = null;
  }

  async function saveModelDialog() {
    if (modelDialogMode.value === "local") {
      await persist({
        localBaseUrl: localBaseUrl.value.trim(),
        localModel: localModel.value.trim(),
      });
    } else if (modelDialogIndex.value !== null && dialogProvider.value) {
      providerDrafts.value[modelDialogIndex.value] = { ...dialogProvider.value };
      await saveCloudProviders();
    }
    closeModelDialog();
  }

  async function testModelDialog() {
    testFeedback.value = null;
    if (modelDialogMode.value === "local") {
      await runTest("local");
      return;
    }
    if (modelDialogIndex.value === null || !dialogProvider.value) return;
    if (!hasApiKey(dialogProvider.value)) {
      testFeedback.value = { type: "error", message: "请先填写 API Key" };
      ui.showToast("error", testFeedback.value.message);
      return;
    }
    providerDrafts.value[modelDialogIndex.value] = { ...dialogProvider.value };
    await saveCloudProviders(true);
    const id = providerDrafts.value[modelDialogIndex.value]?.id;
    if (id) {
      await runTest(id);
      return;
    }
    testFeedback.value = { type: "error", message: "请先保存提供商配置" };
    ui.showToast("error", testFeedback.value.message);
  }

  function selectTab(tab: AiSettingsTabInput) {
    activeTab.value = normalizeAiSettingsTab(tab);
  }

  /** @deprecated 使用 selectTab */
  function selectModelTab(tab: AiModelTab) {
    selectTab(tab);
  }

  function selectProvider(index: number) {
    selectedIndex.value = index;
  }

  function addProvider() {
    if (config.value && !config.value.cloudEnabled) {
      void persist({ cloudEnabled: true }).then(() => {
        providerDrafts.value.push(newProviderDraft());
        openCloudDialog(providerDrafts.value.length - 1);
      });
      return;
    }
    providerDrafts.value.push(newProviderDraft());
    openCloudDialog(providerDrafts.value.length - 1);
    activeTab.value = "models";
  }

  async function addProviderFromPreset(preset: AiCloudPreset) {
    const existingIndex = providerDrafts.value.findIndex((p) =>
      providerMatchesPreset(p, preset),
    );
    if (existingIndex >= 0) {
      openCloudDialog(existingIndex);
      ui.showToast("success", `已打开「${preset.name}」配置`);
      return;
    }
    if (config.value && !config.value.cloudEnabled) {
      await persist({ cloudEnabled: true });
    }
    providerDrafts.value.push(draftFromPreset(preset));
    openCloudDialog(providerDrafts.value.length - 1);
    activeTab.value = "models";
  }

  function isPresetConfigured(preset: AiCloudPreset): boolean {
    return providerDrafts.value.some((p) => providerMatchesPreset(p, preset));
  }

  function removeSelectedProvider() {
    if (selectedIndex.value === null) return;
    const index = selectedIndex.value;
    providerDrafts.value.splice(index, 1);
    if (!providerDrafts.value.length) {
      selectedIndex.value = null;
      return;
    }
    selectedIndex.value = Math.min(index, providerDrafts.value.length - 1);
  }

  async function runTest(target: LlmTarget) {
    testingId.value = target;
    testFeedback.value = null;
    try {
      if (target === "local") {
        await saveLocalSettings();
      } else {
        const draft = providerDrafts.value.find((p) => p.id === target);
        if (draft && !hasApiKey(draft)) {
          testFeedback.value = { type: "error", message: "请先填写 API Key" };
          ui.showToast("error", testFeedback.value.message);
          return;
        }
        await saveCloudProviders(true);
      }
      const result = await testAiConnection(target);
      testFeedback.value = {
        type: result.ok ? "success" : "error",
        message: result.message,
      };
      ui.showToast(result.ok ? "success" : "error", result.message);
    } catch (e) {
      const message = e instanceof Error ? e.message : "连接测试失败";
      testFeedback.value = { type: "error", message };
      ui.showToast("error", message);
    } finally {
      testingId.value = null;
    }
  }

  async function testSelectedProvider() {
    const provider = selectedProvider.value;
    if (!provider) return;

    if (!provider.id) {
      if (!hasApiKey(provider)) {
        ui.showToast("error", "请先填写 API Key 并保存");
        return;
      }
      await saveCloudProviders(true);
    }

    const targetId = selectedProvider.value?.id;
    if (!targetId) {
      ui.showToast("error", "请先保存提供商配置");
      return;
    }
    await runTest(targetId);
  }

  function isTestingProvider(provider: ProviderDraft): boolean {
    return testingId.value !== null && testingId.value === provider.id;
  }

  const localEnabled = computed(() => config.value?.localEnabled !== false);

  const networkHint = computed(() => {
    if (!config.value?.enabled) return "AI 未启用 · 零外联";
    const enabledCloud = providerDrafts.value.filter((p) => p.enabled !== false).length;
    if (config.value.cloudEnabled && enabledCloud > 0) {
      return `AI 外联：已启用 ${enabledCloud} 个云端模型`;
    }
    if (config.value.cloudEnabled) return "AI 外联：已开启，请添加云端模型";
    if (localEnabled.value) return "AI：本地模型；可选用「仅检索」模式（零外联）";
    return "AI：请启用至少一个模型";
  });

  watch(
    () => config.value?.cloudEnabled,
    (enabled) => {
      if (!enabled) selectedIndex.value = null;
    },
  );

  if (options?.autoLoad !== false) {
    onMounted(() => {
      void loadConfig(true);
    });
  }

  return {
    loading,
    saving,
    testingId,
    testFeedback,
    config,
    localBaseUrl,
    localModel,
    ragTopK,
    providerDrafts,
    selectedIndex,
    activeTab,
    selectedProvider,
    selectedPreset,
    selectedPresetModel,
    localEnabled,
    modelDialogOpen,
    modelDialogMode,
    modelDialogIndex,
    dialogProvider,
    networkHint,
    loadConfig,
    onToggleEnabled,
    onToggleCloud,
    onToggleWrite,
    saveLocalSettings,
    saveRagSettings,
    saveCloudProviders,
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
    selectModelTab,
    selectProvider,
    addProvider,
    addProviderFromPreset,
    isPresetConfigured,
    removeSelectedProvider,
    runTest,
    testSelectedProvider,
    isTestingProvider,
    providerRowKey,
    hasApiKey,
    hostLabel,
  };
}

export type UseAiSettingsReturn = ReturnType<typeof useAiSettings>;
