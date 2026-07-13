import { ref } from "vue";

import type { CcPermissionMode, CcReasoningEffort } from "../../utils/ccChatModels";
import { strip1mSuffix } from "../../utils/ccChatModels";
import type { CcCustomModelEntry } from "../../utils/ccModelCatalog";

export const CHAT_PREFS_KEY = "cc-workbench-chat-prefs";
export const CATALOG_CHANGE_EVENT = "cc-model-catalog-change";

const MAX_RECENT = 5;

export interface CcPerProviderPrefs {
  selectedModelId: string;
  recentModelIds: string[];
}

export interface CcExtendedChatPrefs {
  selectedModelId: string;
  permissionMode: CcPermissionMode;
  reasoningEffort: CcReasoningEffort;
  disableThinking?: boolean;
  longContextEnabled: boolean;
  perProvider: Record<string, CcPerProviderPrefs>;
  customModels: Record<string, CcCustomModelEntry[]>;
}

function defaultPrefs(): CcExtendedChatPrefs {
  return {
    selectedModelId: "",
    permissionMode: "default",
    reasoningEffort: "high",
    disableThinking: false,
    longContextEnabled: true,
    perProvider: {},
    customModels: {},
  };
}

export function loadExtendedChatPrefs(): CcExtendedChatPrefs {
  try {
    const raw = localStorage.getItem(CHAT_PREFS_KEY);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw) as Partial<CcExtendedChatPrefs>;
    return {
      ...defaultPrefs(),
      ...parsed,
      perProvider: parsed.perProvider ?? {},
      customModels: parsed.customModels ?? {},
      longContextEnabled: parsed.longContextEnabled ?? true,
    };
  } catch {
    return defaultPrefs();
  }
}

export function saveExtendedChatPrefs(prefs: CcExtendedChatPrefs) {
  try {
    localStorage.setItem(CHAT_PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(CATALOG_CHANGE_EVENT));
  } catch {
    /* ignore quota errors */
  }
}

export function useCcModelCatalog() {
  const prefs = ref(loadExtendedChatPrefs());

  function reload() {
    prefs.value = loadExtendedChatPrefs();
  }

  function persist(next: CcExtendedChatPrefs) {
    prefs.value = next;
    saveExtendedChatPrefs(next);
  }

  function getCustomModels(providerId: string): CcCustomModelEntry[] {
    return prefs.value.customModels[providerId] ?? [];
  }

  function addCustomModel(providerId: string, baseId: string, label?: string): boolean {
    const id = strip1mSuffix(baseId.trim());
    if (!id) return false;
    const existing = getCustomModels(providerId);
    if (existing.some((m) => strip1mSuffix(m.id) === id)) return false;
    const next = {
      ...prefs.value,
      customModels: {
        ...prefs.value.customModels,
        [providerId]: [...existing, { id, label: label?.trim() || undefined }],
      },
    };
    persist(next);
    return true;
  }

  function removeCustomModel(providerId: string, baseId: string) {
    const id = strip1mSuffix(baseId.trim());
    const existing = getCustomModels(providerId);
    const next = {
      ...prefs.value,
      customModels: {
        ...prefs.value.customModels,
        [providerId]: existing.filter((m) => strip1mSuffix(m.id) !== id),
      },
    };
    persist(next);
  }

  function getRecentModelIds(providerId: string): string[] {
    return prefs.value.perProvider[providerId]?.recentModelIds ?? [];
  }

  function pushRecentModel(providerId: string, modelId: string) {
    const id = modelId.trim();
    if (!id) return;
    const current = prefs.value.perProvider[providerId] ?? {
      selectedModelId: "",
      recentModelIds: [],
    };
    const filtered = current.recentModelIds.filter((item) => item !== id);
    const recentModelIds = [id, ...filtered].slice(0, MAX_RECENT);
    persist({
      ...prefs.value,
      perProvider: {
        ...prefs.value.perProvider,
        [providerId]: { ...current, recentModelIds },
      },
    });
  }

  function getProviderSelectedModelId(providerId: string): string {
    return prefs.value.perProvider[providerId]?.selectedModelId ?? "";
  }

  function setProviderSelectedModelId(providerId: string, modelId: string) {
    const current = prefs.value.perProvider[providerId] ?? {
      selectedModelId: "",
      recentModelIds: [],
    };
    persist({
      ...prefs.value,
      perProvider: {
        ...prefs.value.perProvider,
        [providerId]: { ...current, selectedModelId: modelId },
      },
    });
  }

  function saveProviderModelBeforeSwitch(providerId: string, modelId: string) {
    if (!providerId) return;
    const current = prefs.value.perProvider[providerId] ?? {
      selectedModelId: "",
      recentModelIds: [],
    };
    persist({
      ...prefs.value,
      perProvider: {
        ...prefs.value.perProvider,
        [providerId]: { ...current, selectedModelId: modelId },
      },
    });
  }

  function updateSessionPrefs(partial: Partial<CcExtendedChatPrefs>) {
    persist({ ...prefs.value, ...partial });
  }

  function onCatalogChange(handler: () => void) {
    const listener = () => handler();
    window.addEventListener(CATALOG_CHANGE_EVENT, listener);
    return () => window.removeEventListener(CATALOG_CHANGE_EVENT, listener);
  }

  return {
    prefs,
    reload,
    getCustomModels,
    addCustomModel,
    removeCustomModel,
    getRecentModelIds,
    pushRecentModel,
    getProviderSelectedModelId,
    setProviderSelectedModelId,
    saveProviderModelBeforeSwitch,
    updateSessionPrefs,
    onCatalogChange,
  };
}

/** 单例式 catalog 操作（供 store 使用，避免多实例不同步） */
let catalogOps: ReturnType<typeof useCcModelCatalog> | null = null;

export function getCcModelCatalogOps() {
  if (!catalogOps) {
    catalogOps = useCcModelCatalog();
  }
  return catalogOps;
}

export function resetCcModelCatalogOpsForTests() {
  catalogOps = null;
}
