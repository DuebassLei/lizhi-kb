import type { CcProviderPublic } from "../services/ccWorkbenchService";
import { OFFICIAL_PROVIDER_ID } from "../services/ccWorkbenchService";
import { strip1mSuffix } from "./ccChatModels";

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 合并 envExtras 与 settingsConfig.env（CC Switch / settings.json 形态） */
export function parseProviderEnv(
  provider: CcProviderPublic | null | undefined,
): Record<string, string> {
  const env: Record<string, string> = { ...(provider?.envExtras ?? {}) };
  const raw = provider?.settingsConfig?.trim();
  if (!raw) return env;
  try {
    const parsed = JSON.parse(raw) as { env?: Record<string, unknown> };
    const settingsEnv = parsed?.env;
    if (!settingsEnv || typeof settingsEnv !== "object") return env;
    for (const [key, value] of Object.entries(settingsEnv)) {
      const text = trimString(value);
      if (text) env[key] = text;
    }
  } catch {
    /* ignore invalid JSON */
  }
  return env;
}

export function is1mContextDisabled(provider: CcProviderPublic | null | undefined): boolean {
  const value = parseProviderEnv(provider).CLAUDE_CODE_DISABLE_1M_CONTEXT?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function isOfficialAnthropicModelId(id: string): boolean {
  return strip1mSuffix(id.trim()).toLowerCase().startsWith("claude-");
}

function configuredSlotBaseIds(provider: CcProviderPublic): string[] {
  const ids = [
    provider.sonnetModel,
    provider.opusModel,
    provider.fastModel,
    provider.model,
  ]
    .map((s) => strip1mSuffix(s?.trim() ?? ""))
    .filter(Boolean);
  return [...new Set(ids)];
}

/**
 * 是否在模型下拉展示内置 Anthropic 推荐目录（Opus 4.6 等）。
 * 自定义网关 / 全槽位映射到非 claude-* ID 时不展示。
 */
export function providerUsesOfficialModelCatalog(
  provider: CcProviderPublic | null | undefined,
): boolean {
  if (!provider) return false;
  if (provider.id === OFFICIAL_PROVIDER_ID) return true;
  if (provider.providerMode === "official" && !provider.baseUrl?.trim()) {
    return true;
  }

  const slotIds = configuredSlotBaseIds(provider);
  if (!slotIds.length) {
    return provider.providerMode === "official" && !provider.baseUrl?.trim();
  }

  const hasCustomGateway = Boolean(provider.baseUrl?.trim()) || provider.providerMode === "custom";
  if (hasCustomGateway && slotIds.every((id) => !isOfficialAnthropicModelId(id))) {
    return false;
  }

  return slotIds.some((id) => isOfficialAnthropicModelId(id));
}

export function effectiveLongContextForProvider(
  provider: CcProviderPublic | null | undefined,
  userPref: boolean,
): boolean {
  if (is1mContextDisabled(provider)) return false;
  return userPref;
}
