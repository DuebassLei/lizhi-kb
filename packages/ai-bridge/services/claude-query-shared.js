import {
  buildAdditionalDirectories,
  isDriveOnlyPath,
  sanitizeOpenedFiles,
  selectWorkingDirectory,
} from "../utils/path-utils.js";
import { bootstrapSdkSettingSources } from "../utils/claude-config-sanitize.js";
import { buildSdkEnv } from "../utils/env-utils.js";
import {
  resolveProviderApiModel,
  resolveSdkModelName,
  setModelEnvironmentVariables,
} from "../utils/model-utils.js";

/**
 * Anthropic proxy base URLs must not include /v1/messages — the SDK appends that path.
 * @param {string} raw
 */
export function normalizeAnthropicBaseUrl(raw) {
  let url = String(raw ?? "").trim().replace(/\/+$/, "");
  url = url.replace(/\/v1\/messages$/i, "");
  return url.replace(/\/+$/, "");
}

/**
 * @param {Record<string, unknown>} params
 */
export function buildAnthropicEnv(params) {
  const apiKey = String(params.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    return null;
  }

  const providerMode = params.providerMode === "custom" ? "custom" : "official";
  const baseUrl = normalizeAnthropicBaseUrl(String(params.baseUrl ?? ""));
  const model = String(params.model ?? "").trim();
  const sonnetModel = String(params.sonnetModel ?? "").trim();
  const opusModel = String(params.opusModel ?? "").trim();
  const fastModel = String(params.fastModel ?? "").trim();

  /** @type {Record<string, string>} */
  const env = {};

  if (providerMode === "custom" && baseUrl) {
    env.ANTHROPIC_BASE_URL = baseUrl;
    env.ANTHROPIC_AUTH_TOKEN = apiKey;
  } else {
    env.ANTHROPIC_API_KEY = apiKey;
  }

  if (sonnetModel) env.ANTHROPIC_DEFAULT_SONNET_MODEL = sonnetModel;
  if (opusModel) env.ANTHROPIC_DEFAULT_OPUS_MODEL = opusModel;
  if (fastModel) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = fastModel;
    env.ANTHROPIC_SMALL_FAST_MODEL = fastModel;
    env.CLAUDE_CODE_SUBAGENT_MODEL = fastModel;
  }

  if (model) {
    const specifics = [sonnetModel, opusModel, fastModel].filter(Boolean);
    if (specifics.length === 0) {
      if (!sonnetModel) env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
      if (!opusModel) env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;
    } else {
      const allSame = specifics.every((value) => value === model);
      if (!allSame) {
        env.ANTHROPIC_MODEL = model;
      }
    }
  }

  const extraEnv = params.extraEnv;
  if (extraEnv && typeof extraEnv === "object") {
    for (const [key, value] of Object.entries(extraEnv)) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      env[key] = trimmed;
    }
  }

  const reasoningEffort = String(params.reasoningEffort ?? "").trim();
  if (reasoningEffort && params.disableThinking !== true) {
    env.CLAUDE_CODE_EFFORT_LEVEL = reasoningEffort;
  }

  return env;
}

/**
 * Shared SDK env + model resolution for bridge subcommands (enhance, test-model).
 * @param {Record<string, unknown>} params
 */
export function prepareBridgeSdkContext(params) {
  const cwd = normalizeCwd(params.cwd);
  const anthropicEnv = buildAnthropicEnv(params);
  if (!anthropicEnv) {
    throw new Error("未配置 API Key / Auth Token");
  }

  const selectedModel = String(params.selectedModel ?? "").trim();
  const selectedModelSlot = params.selectedModelSlot
    ? String(params.selectedModelSlot).trim()
    : null;
  const disableThinking = params.disableThinking === true;

  const resolvedApiModel = resolveProviderApiModel(selectedModel, selectedModelSlot, {
    model: params.model ? String(params.model) : null,
    sonnetModel: params.sonnetModel ? String(params.sonnetModel) : null,
    opusModel: params.opusModel ? String(params.opusModel) : null,
    fastModel: params.fastModel ? String(params.fastModel) : null,
  });
  const sdkModel = resolveSdkModelName(selectedModel, selectedModelSlot);
  const baseModelId = selectedModel || sdkModel;

  if (resolvedApiModel) {
    setModelEnvironmentVariables(resolvedApiModel, baseModelId);
  }

  if (disableThinking) {
    delete anthropicEnv.CLAUDE_CODE_EFFORT_LEVEL;
    anthropicEnv.CLAUDE_CODE_DISABLE_THINKING = "1";
  }

  const sdkEnv = buildSdkEnv(anthropicEnv, cwd);
  const settingsEnv = {
    CLAUDE_CODE_EFFORT_LEVEL: "",
    MAX_THINKING_TOKENS: "",
  };
  const normalized = String(resolvedApiModel || selectedModel || "").trim();
  if (normalized) {
    settingsEnv.CLAUDE_CODE_DISABLE_1M_CONTEXT = /\[1m\]$/i.test(normalized) ? "" : "1";
  }
  if (disableThinking) {
    settingsEnv.CLAUDE_CODE_DISABLE_THINKING = "1";
  }

  return {
    cwd,
    sdkModel,
    sdkEnv,
    settings: mergeSdkSettings(null, settingsEnv),
  };
}

/**
 * Deep-merge provider settings blob with runtime overrides (env wins on conflict).
 * @param {Record<string, unknown>|null|undefined} providerSettings
 * @param {Record<string, string>} overrideEnv
 */
export function mergeSdkSettings(providerSettings, overrideEnv) {
  /** @type {Record<string, unknown>} */
  const base =
    providerSettings && typeof providerSettings === "object" && !Array.isArray(providerSettings)
      ? structuredClone(providerSettings)
      : {};

  /** @type {Record<string, string>} */
  const env =
    base.env && typeof base.env === "object" && !Array.isArray(base.env)
      ? { .../** @type {Record<string, string>} */ (base.env) }
      : {};

  for (const [key, value] of Object.entries(overrideEnv ?? {})) {
    env[key] = value;
  }
  base.env = env;
  return base;
}

/**
 * @param {unknown} raw
 */
export function normalizeCwd(raw) {
  if (isDriveOnlyPath(String(raw ?? ""))) {
    throw new Error("工作目录无效：不能仅为盘符，请在设置中选择完整项目文件夹");
  }
  return selectWorkingDirectory(raw);
}

export { bootstrapSdkSettingSources } from "../utils/claude-config-sanitize.js";
export { buildAdditionalDirectories, sanitizeOpenedFiles };

/**
 * @param {string[]} openedFiles
 * @param {Array<{ path?: string, name?: string, content?: string, truncated?: boolean }>|undefined} openedFileContents
 * @param {string|null|undefined} agentPrompt
 * @param {string} userPrompt
 * @param {Array<{ path?: string, name?: string, kind?: string, content?: string, truncated?: boolean }>|undefined} attachmentContents
 */
export function buildPromptWithContext(
  openedFiles,
  openedFileContents,
  agentPrompt,
  userPrompt,
  attachmentContents,
) {
  const parts = [];
  const contentBlocks = Array.isArray(openedFileContents)
    ? openedFileContents.filter((item) => item && String(item.content ?? "").trim())
    : [];

  if (contentBlocks.length > 0) {
    const body = contentBlocks
      .map((file) => {
        const name = String(file.name ?? file.path ?? "未命名");
        const path = String(file.path ?? name);
        const suffix = file.truncated ? "\n...(内容已截断)" : "";
        return `### ${name}\n路径: ${path}\n\n${String(file.content ?? "").trim()}${suffix}`;
      })
      .join("\n\n");
    parts.push(`【文件上下文】\n${body}`);
  } else if (Array.isArray(openedFiles) && openedFiles.length > 0) {
    parts.push("【文件上下文】\n" + openedFiles.map((f) => `- @${f}`).join("\n"));
  }

  const attachmentBlocks = Array.isArray(attachmentContents)
    ? attachmentContents.filter((item) => item && String(item.content ?? "").trim())
    : [];
  if (attachmentBlocks.length > 0) {
    const body = attachmentBlocks
      .map((file) => {
        const name = String(file.name ?? file.path ?? "未命名");
        const path = String(file.path ?? name);
        const kind = String(file.kind ?? "file");
        const suffix = file.truncated ? "\n...(附件内容已截断)" : "";
        return `### ${name}\n类型: ${kind}\n路径: ${path}\n\n${String(file.content ?? "").trim()}${suffix}`;
      })
      .join("\n\n");
    parts.push(`【消息附件】\n${body}`);
  }

  if (agentPrompt && String(agentPrompt).trim()) {
    parts.push("【智能体指令】\n" + String(agentPrompt).trim());
  }
  if (parts.length === 0) {
    return userPrompt;
  }
  parts.push("【用户消息】\n" + userPrompt);
  return parts.join("\n\n");
}
