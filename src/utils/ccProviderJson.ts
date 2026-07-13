import type { CcProviderPublic } from "../services/ccWorkbenchService";

const MANAGED_ENV_KEYS = new Set([
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_SMALL_FAST_MODEL",
]);

export interface ProviderJsonFields {
  apiKey: string;
  baseUrl: string;
  model: string;
  sonnetModel: string;
  opusModel: string;
  fastModel: string;
  envExtras: Record<string, string>;
}

export interface ParsedProviderJson {
  fields: ProviderJsonFields;
  topLevelExtras: Record<string, unknown>;
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readHaikuModel(env: Record<string, unknown>): string {
  return (
    trimString(env.ANTHROPIC_DEFAULT_HAIKU_MODEL) ||
    trimString(env.ANTHROPIC_SMALL_FAST_MODEL)
  );
}

export function normalizeProviderEnvForSave(
  env: Record<string, unknown>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    const text = trimString(value);
    if (text) next[key] = text;
  }

  const mainModel = next.ANTHROPIC_MODEL;
  if (!mainModel) {
    delete next.ANTHROPIC_MODEL;
    return next;
  }

  const specific = [
    next.ANTHROPIC_DEFAULT_HAIKU_MODEL,
    next.ANTHROPIC_DEFAULT_SONNET_MODEL,
    next.ANTHROPIC_DEFAULT_OPUS_MODEL,
  ].filter(Boolean);

  if (specific.length === 0 || specific.every((m) => m === mainModel)) {
    delete next.ANTHROPIC_MODEL;
  }

  return next;
}

export function buildProviderJsonConfig(
  fields: ProviderJsonFields,
  topLevelExtras: Record<string, unknown> = {},
): string {
  const env: Record<string, string> = {};
  if (fields.apiKey.trim()) env.ANTHROPIC_AUTH_TOKEN = fields.apiKey.trim();
  if (fields.baseUrl.trim()) env.ANTHROPIC_BASE_URL = fields.baseUrl.trim();
  if (fields.model.trim()) env.ANTHROPIC_MODEL = fields.model.trim();
  if (fields.sonnetModel.trim()) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = fields.sonnetModel.trim();
  }
  if (fields.opusModel.trim()) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = fields.opusModel.trim();
  }
  if (fields.fastModel.trim()) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = fields.fastModel.trim();
  }
  for (const [key, value] of Object.entries(fields.envExtras)) {
    if (value.trim() && !MANAGED_ENV_KEYS.has(key)) {
      env[key] = value.trim();
    }
  }

  const normalizedEnv = normalizeProviderEnvForSave(env);
  const config: Record<string, unknown> = { ...topLevelExtras };
  if (Object.keys(normalizedEnv).length > 0) {
    config.env = normalizedEnv;
  } else {
    delete config.env;
  }

  return JSON.stringify(config, null, 2);
}

export function parseProviderJsonConfig(raw: string): {
  parsed: ParsedProviderJson | null;
  error: string | null;
} {
  if (!raw.trim()) {
    return {
      parsed: {
        fields: {
          apiKey: "",
          baseUrl: "",
          model: "",
          sonnetModel: "",
          opusModel: "",
          fastModel: "",
          envExtras: {},
        },
        topLevelExtras: {},
      },
      error: null,
    };
  }

  let value: Record<string, unknown>;
  try {
    value = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { parsed: null, error: "JSON 格式无效" };
  }

  const envRaw =
    value.env && typeof value.env === "object"
      ? (value.env as Record<string, unknown>)
      : {};
  const normalizedEnv = normalizeProviderEnvForSave(envRaw);

  const envExtras: Record<string, string> = {};
  for (const [key, val] of Object.entries(normalizedEnv)) {
    if (!MANAGED_ENV_KEYS.has(key)) {
      envExtras[key] = val;
    }
  }

  const apiKey =
    normalizedEnv.ANTHROPIC_AUTH_TOKEN ||
    normalizedEnv.ANTHROPIC_API_KEY ||
    "";

  const topLevelExtras = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "env"),
  );

  return {
    parsed: {
      fields: {
        apiKey,
        baseUrl: normalizedEnv.ANTHROPIC_BASE_URL ?? "",
        model: normalizedEnv.ANTHROPIC_MODEL ?? "",
        sonnetModel: normalizedEnv.ANTHROPIC_DEFAULT_SONNET_MODEL ?? "",
        opusModel: normalizedEnv.ANTHROPIC_DEFAULT_OPUS_MODEL ?? "",
        fastModel: readHaikuModel(envRaw),
        envExtras,
      },
      topLevelExtras,
    },
    error: null,
  };
}

export function formatProviderJsonConfig(raw: string): {
  formatted: string;
  error: string | null;
} {
  const { parsed, error } = parseProviderJsonConfig(raw);
  if (error || !parsed) return { formatted: raw, error: error ?? "JSON 格式无效" };
  return {
    formatted: buildProviderJsonConfig(parsed.fields, parsed.topLevelExtras),
    error: null,
  };
}

export function providerToJsonFields(provider: CcProviderPublic): ProviderJsonFields {
  return {
    apiKey: provider.apiKey ?? "",
    baseUrl: provider.baseUrl,
    model: provider.model,
    sonnetModel: provider.sonnetModel || provider.model,
    opusModel: provider.opusModel || provider.model,
    fastModel: provider.fastModel,
    envExtras: { ...(provider.envExtras ?? {}) },
  };
}

export function loadProviderJsonEditor(
  provider: CcProviderPublic,
): { json: string; error: string | null } {
  if (provider.settingsConfig?.trim()) {
    const { formatted, error } = formatProviderJsonConfig(provider.settingsConfig);
    if (!error) {
      const fields = providerToJsonFields(provider);
      if (provider.apiKey) {
        fields.apiKey = provider.apiKey;
      }
      const { parsed } = parseProviderJsonConfig(formatted);
      const topLevelExtras = parsed?.topLevelExtras ?? {};
      return {
        json: buildProviderJsonConfig(fields, topLevelExtras),
        error: null,
      };
    }
  }
  const fields = providerToJsonFields(provider);
  return { json: buildProviderJsonConfig(fields), error: null };
}

export function detectProviderModeFromBaseUrl(baseUrl: string): "official" | "custom" {
  const normalized = baseUrl.trim().toLowerCase();
  if (!normalized) return "official";
  try {
    const url = new URL(normalized);
    return url.hostname === "api.anthropic.com" ? "official" : "custom";
  } catch {
    return "custom";
  }
}
