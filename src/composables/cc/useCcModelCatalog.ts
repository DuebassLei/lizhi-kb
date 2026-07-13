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
  /** baseId（无 [1m]）→ 是否启用 1M */
  model1mPrefs?: Record<string, boolean>;
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

  function addCustomModel(
    providerId: string,
    baseId: string,
    label?: string,
    pricing?: { inputPrice?: number; outputPrice?: number },
  ): boolean {
    const id = strip1mSuffix(baseId.trim());
    if (!id) return false;
    const existing = getCustomModels(providerId);
    if (existing.some((m) => strip1mSuffix(m.id) === id)) return false;
    const entry: CcCustomModelEntry = {
      id,
      label: label?.trim() || undefined,
      inputPrice: pricing?.inputPrice,
      outputPrice: pricing?.outputPrice,
    };
    const next = {
      ...prefs.value,
      customModels: {
        ...prefs.value.customModels,
        [providerId]: [...existing, entry],
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

  function getModel1mEnabled(providerId: string, baseId: string, globalDefault: boolean): boolean {
    const prefs1m = prefs.value.perProvider[providerId]?.model1mPrefs;
    const key = strip1mSuffix(baseId);
    if (prefs1m && key in prefs1m) return Boolean(prefs1m[key]);
    return globalDefault;
  }

  function setModel1mEnabled(providerId: string, baseId: string, enabled: boolean) {
    const key = strip1mSuffix(baseId.trim());
    if (!key || !providerId) return;
    const current = prefs.value.perProvider[providerId] ?? {
      selectedModelId: "",
      recentModelIds: [],
    };
    persist({
      ...prefs.value,
      perProvider: {
        ...prefs.value.perProvider,
        [providerId]: {
          ...current,
          model1mPrefs: { ...(current.model1mPrefs ?? {}), [key]: enabled },
        },
      },
    });
  }

  function exportCustomModelsJson(): string {
    return JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), customModels: prefs.value.customModels },
      null,
      2,
    );
  }

  function importCustomModelsJson(
    raw: string,
    mode: "merge" | "replace",
  ): { added: number; skipped: number } {
    const parsed = JSON.parse(raw) as { customModels?: Record<string, CcCustomModelEntry[]> };
    const incoming = parsed.customModels ?? {};
    let added = 0;
    let skipped = 0;
    const base = mode === "replace" ? {} : { ...prefs.value.customModels };
    for (const [providerId, models] of Object.entries(incoming)) {
      if (!Array.isArray(models)) continue;
      const existing = base[providerId] ?? [];
      const seen = new Set(existing.map((m) => strip1mSuffix(m.id)));
      const merged = [...existing];
      for (const m of models) {
        const id = strip1mSuffix(String(m.id ?? "").trim());
        if (!id) {
          skipped++;
          continue;
        }
        if (seen.has(id)) {
          skipped++;
          continue;
        }
        seen.add(id);
        merged.push({ id, label: m.label?.trim() || undefined });
        added++;
      }
      base[providerId] = merged;
    }
    persist({ ...prefs.value, customModels: base });
    return { added, skipped };
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
    getModel1mEnabled,
    setModel1mEnabled,
    exportCustomModelsJson,
    importCustomModelsJson,
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
