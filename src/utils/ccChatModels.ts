import type { CcProviderPublic } from "../services/ccWorkbenchService";

export type CcModelSlot = "sonnet" | "opus" | "haiku";

export type CcModelSource = "recent" | "custom" | "catalog" | "slot";

export interface CcChatModelOption {
  slot?: CcModelSlot;
  id: string;
  baseId: string;
  label: string;
  description: string;
  /** 当前 id 是否已启用 [1m] 后缀 */
  supports1m: boolean;
  /** 模型是否支持 1M 上下文 */
  supports1mContext: boolean;
  source: CcModelSource;
}

export type CcPermissionMode = "default" | "acceptEdits" | "plan" | "bypassPermissions";

export type CcReasoningEffort = "low" | "medium" | "high" | "max";

const SLOT_META: Record<CcModelSlot, { label: string; description: string }> = {
  sonnet: { label: "Sonnet", description: "主力推理" },
  opus: { label: "Opus", description: "深度推理" },
  haiku: { label: "Haiku", description: "快速响应" },
};

export function modelSupports1m(id: string): boolean {
  return /\[1m\]$/i.test(id);
}

export function strip1mSuffix(id: string): string {
  return id.replace(/\[1m\]$/i, "");
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

export function buildModelOptions(provider: CcProviderPublic | null | undefined): CcChatModelOption[] {
  const slots: CcModelSlot[] = ["sonnet", "opus", "haiku"];
  const options: CcChatModelOption[] = [];

  for (const slot of slots) {
    const id = resolveSlotModel(provider, slot);
    if (!id) continue;
    const meta = SLOT_META[slot];
    const baseId = strip1mSuffix(id);
    options.push({
      slot,
      id: baseId,
      baseId,
      label: baseId,
      description: `${meta.label} · ${meta.description}`,
      supports1m: modelSupports1m(baseId),
      supports1mContext: !baseId.toLowerCase().includes("haiku"),
      source: "slot",
    });
  }

  if (!options.length && provider?.model?.trim()) {
    const baseId = strip1mSuffix(provider.model.trim());
    options.push({
      slot: "sonnet",
      id: baseId,
      baseId,
      label: baseId,
      description: "默认模型",
      supports1m: modelSupports1m(baseId),
      supports1mContext: !baseId.toLowerCase().includes("haiku"),
      source: "slot",
    });
  }

  return options;
}

export function defaultModelId(provider: CcProviderPublic | null | undefined): string {
  const options = buildModelOptions(provider);
  const sonnet = options.find((o) => o.slot === "sonnet");
  return sonnet?.id ?? options[0]?.id ?? "claude-sonnet-4-6";
}

export function resolveEffortFromProvider(provider: CcProviderPublic | null | undefined): CcReasoningEffort {
  const raw = provider?.envExtras?.CLAUDE_CODE_EFFORT_LEVEL?.trim().toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "max") return raw;
  return "high";
}

export const PERMISSION_MODE_LABELS: Record<CcPermissionMode, string> = {
  default: "自动模式",
  acceptEdits: "接受编辑",
  plan: "规划模式",
  bypassPermissions: "跳过确认",
};

/** 权限模式选项（对齐 CC GUI 下拉说明） */
export interface CcPermissionModeOption {
  mode: CcPermissionMode;
  label: string;
  description: string;
}

export const PERMISSION_MODE_OPTIONS: CcPermissionModeOption[] = [
  {
    mode: "default",
    label: "自动模式",
    description: "首次使用工具时需确认",
  },
  {
    mode: "acceptEdits",
    label: "接受编辑",
    description: "自动接受文件编辑与常见命令",
  },
  {
    mode: "plan",
    label: "规划模式",
    description: "只读探索，不修改源码",
  },
  {
    mode: "bypassPermissions",
    label: "跳过确认",
    description: "跳过权限确认，仅建议隔离环境使用",
  },
];

export const REASONING_EFFORT_LABELS: Record<CcReasoningEffort, string> = {
  low: "low",
  medium: "medium",
  high: "high",
  max: "max",
};
