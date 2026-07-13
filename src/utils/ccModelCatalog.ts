import type { CcProviderPublic } from "../services/ccWorkbenchService";
import type { CcChatModelOption, CcModelSlot } from "./ccChatModels";
import { strip1mSuffix } from "./ccChatModels";
import { is1mContextDisabled, providerUsesOfficialModelCatalog } from "./ccProviderEnv";

import type { CcModelSource } from "./ccChatModels";

export interface CcCatalogModel {
  id: string;
  label: string;
  description?: string;
  supports1m: boolean;
}

export interface CcCustomModelEntry {
  id: string;
  label?: string;
  /** USD per 1M input tokens */
  inputPrice?: number;
  /** USD per 1M output tokens */
  outputPrice?: number;
}

const SLOT_META: Record<CcModelSlot, { label: string; description: string }> = {
  sonnet: { label: "Sonnet", description: "主力推理" },
  opus: { label: "Opus", description: "深度推理" },
  haiku: { label: "Haiku", description: "快速响应" },
};

export const CLAUDE_MODEL_CATALOG: CcCatalogModel[] = [
  {
    id: "claude-opus-4-6",
    label: "Opus 4.6",
    description: "Opus 4.6 · 深度推理",
    supports1m: true,
  },
  {
    id: "claude-sonnet-4-6",
    label: "Sonnet 4.6",
    description: "Sonnet 4.6 · 主力模型",
    supports1m: true,
  },
  {
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    description: "Haiku 4.5 · 快速响应",
    supports1m: false,
  },
  {
    id: "claude-sonnet-4-5",
    label: "Sonnet 4.5",
    description: "Sonnet 4.5 · 上一代 Sonnet",
    supports1m: true,
  },
  {
    id: "claude-opus-4-5",
    label: "Opus 4.5",
    description: "Opus 4.5 · 上一代 Opus",
    supports1m: true,
  },
];

export function modelSupports1mContext(baseId: string): boolean {
  return !strip1mSuffix(baseId).toLowerCase().includes("haiku");
}

export function modelHas1mEnabled(id: string): boolean {
  return /\[1m\]$/i.test(id);
}

export function apply1mSuffix(baseId: string, enabled: boolean): string {
  const stripped = strip1mSuffix(baseId.trim());
  if (!stripped) return "";
  if (!enabled || !modelSupports1mContext(stripped)) {
    return stripped;
  }
  return `${stripped}[1m]`;
}

function resolveSlotModel(provider: CcProviderPublic | null | undefined, slot: CcModelSlot): string {
  if (!provider) return "";
  const main = provider.model?.trim() ?? "";
  switch (slot) {
    case "sonnet":
      return provider.sonnetModel?.trim() || main;
    case "opus":
      return provider.opusModel?.trim() || main;
    case "haiku":
      return provider.fastModel?.trim() || main;
    default:
      return main;
  }
}

function makeOption(
  baseId: string,
  source: CcModelSource,
  longContextEnabled: boolean,
  opts: {
    slot?: CcModelSlot;
    label?: string;
    description?: string;
    supports1m?: boolean;
  } = {},
): CcChatModelOption | null {
  const stripped = strip1mSuffix(baseId.trim());
  if (!stripped) return null;
  const supports1m = opts.supports1m ?? modelSupports1mContext(stripped);
  const id = apply1mSuffix(stripped, longContextEnabled);
  const label = opts.label ?? stripped;
  const description = opts.description ?? stripped;
  return {
    slot: opts.slot,
    id,
    baseId: stripped,
    label,
    description,
    supports1m: modelHas1mEnabled(id),
    supports1mContext: supports1m,
    source,
  };
}

function optionKey(opt: CcChatModelOption): string {
  if (opt.source === "slot" && opt.slot) {
    return `slot:${opt.slot}`;
  }
  return `${opt.source}:${opt.baseId}`;
}

export function buildCcModelCatalog(
  provider: CcProviderPublic | null | undefined,
  customModels: CcCustomModelEntry[],
  recentIds: string[],
  longContextEnabled: boolean,
): CcChatModelOption[] {
  const use1m = effectiveLongContextEnabled(provider, longContextEnabled);
  const options: CcChatModelOption[] = [];
  const seen = new Set<string>();
  const seenSlotBaseIds = new Set<string>();

  function push(opt: CcChatModelOption | null) {
    if (!opt) return;
    const key = optionKey(opt);
    if (seen.has(key)) return;
    seen.add(key);
    options.push(opt);
  }

  for (const entry of customModels) {
    const baseId = strip1mSuffix(entry.id.trim());
    if (!baseId) continue;
    push(
      makeOption(baseId, "custom", use1m, {
        label: entry.label?.trim() || baseId,
        description: "自定义模型",
        supports1m: !is1mContextDisabled(provider),
      }),
    );
  }

  for (const rawId of recentIds) {
    const baseId = strip1mSuffix(rawId.trim());
    if (!baseId) continue;
    const catalogHit = CLAUDE_MODEL_CATALOG.find((m) => m.id === baseId);
    push(
      makeOption(baseId, "recent", use1m, {
        label: catalogHit?.label ?? baseId,
        description: catalogHit?.description ?? "最近使用",
        supports1m: catalogHit?.supports1m && !is1mContextDisabled(provider),
      }),
    );
  }

  if (providerUsesOfficialModelCatalog(provider)) {
    for (const model of CLAUDE_MODEL_CATALOG) {
      push(
        makeOption(model.id, "catalog", use1m, {
          label: model.label,
          description: model.description ?? model.label,
          supports1m: model.supports1m,
        }),
      );
    }
  }

  const slots: CcModelSlot[] = ["sonnet", "opus", "haiku"];
  for (const slot of slots) {
    const baseId = strip1mSuffix(resolveSlotModel(provider, slot).trim());
    if (!baseId || seenSlotBaseIds.has(baseId)) continue;
    seenSlotBaseIds.add(baseId);
    const meta = SLOT_META[slot];
    push(
      makeOption(baseId, "slot", use1m, {
        slot,
        label: baseId,
        description: `${meta.label} · ${meta.description}`,
        supports1m: modelSupports1mContext(baseId) && !is1mContextDisabled(provider),
      }),
    );
  }

  if (!options.length && provider?.model?.trim()) {
    const baseId = strip1mSuffix(provider.model.trim());
    push(
      makeOption(baseId, "slot", use1m, {
        slot: "sonnet",
        label: baseId,
        description: "默认模型",
        supports1m: modelSupports1mContext(baseId) && !is1mContextDisabled(provider),
      }),
    );
  }

  return options;
}

function effectiveLongContextEnabled(
  provider: CcProviderPublic | null | undefined,
  longContextEnabled: boolean,
): boolean {
  if (is1mContextDisabled(provider)) return false;
  return longContextEnabled;
}

export function defaultCatalogModelId(
  provider: CcProviderPublic | null | undefined,
  longContextEnabled: boolean,
): string {
  const use1m = effectiveLongContextEnabled(provider, longContextEnabled);
  const slots: CcModelSlot[] = ["sonnet", "opus", "haiku"];
  for (const slot of slots) {
    const baseId = strip1mSuffix(resolveSlotModel(provider, slot).trim());
    if (baseId) {
      return apply1mSuffix(baseId, use1m && modelSupports1mContext(baseId));
    }
  }
  const fallback =
    strip1mSuffix(provider?.sonnetModel?.trim() ?? "")
    || strip1mSuffix(provider?.model?.trim() ?? "")
    || "claude-sonnet-4-6";
  return apply1mSuffix(fallback, use1m && modelSupports1mContext(fallback));
}

export const MODEL_GROUP_LABELS: Record<CcModelSource, string> = {
  recent: "最近使用",
  custom: "自定义",
  catalog: "推荐模型",
  slot: "供应商槽位",
};

export const MODEL_GROUP_ORDER: CcModelSource[] = ["recent", "custom", "catalog", "slot"];

export function groupModelOptions(
  options: CcChatModelOption[],
): Array<{ source: CcModelSource; label: string; items: CcChatModelOption[] }> {
  return MODEL_GROUP_ORDER.map((source) => ({
    source,
    label: MODEL_GROUP_LABELS[source],
    items: options.filter((o) => o.source === source),
  })).filter((g) => g.items.length > 0);
}
