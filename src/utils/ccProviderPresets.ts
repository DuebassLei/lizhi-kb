/** Claude Agent / Claude Code 网关预设（对齐 jetbrains-cc-gui PROVIDER_PRESETS） */
export type CcProviderMode = "official" | "custom";

export interface CcProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  sonnetModel: string;
  opusModel: string;
  fastModel: string;
  hint: string;
  envExtras?: Record<string, string>;
  docsUrl?: string;
  docsLabel?: string;
}

export const CC_OFFICIAL_PRESET: CcProviderPreset = {
  id: "official",
  name: "Anthropic 官方",
  baseUrl: "",
  model: "",
  sonnetModel: "",
  opusModel: "",
  fastModel: "",
  hint: "直连 api.anthropic.com，使用 sk-ant- API Key",
};

export const CC_PROVIDER_PRESETS: CcProviderPreset[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/anthropic",
    model: "deepseek-v4-pro[1m]",
    sonnetModel: "deepseek-v4-pro[1m]",
    opusModel: "deepseek-v4-pro[1m]",
    fastModel: "deepseek-v4-flash",
    hint: "DeepSeek 官方 Anthropic 兼容端点",
    envExtras: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
    docsUrl: "https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code",
    docsLabel: "DeepSeek × Claude Code",
  },
  {
    id: "kimi",
    name: "Kimi（月之暗面）",
    baseUrl: "https://api.moonshot.cn/anthropic",
    model: "kimi-k2.5",
    sonnetModel: "kimi-k2.5",
    opusModel: "kimi-k2.5",
    fastModel: "kimi-k2.5",
    hint: "Moonshot 国内站 API Key",
    docsUrl: "https://platform.moonshot.cn/",
    docsLabel: "Moonshot 开放平台",
  },
  {
    id: "minimax",
    name: "MiniMax",
    baseUrl: "https://api.minimaxi.com/anthropic",
    model: "MiniMax-M2.7",
    sonnetModel: "MiniMax-M2.7",
    opusModel: "MiniMax-M2.7",
    fastModel: "MiniMax-M2.7",
    hint: "国内用户使用 api.minimaxi.com",
    docsUrl: "https://platform.minimaxi.com/docs/guides/text-ai-coding-tools",
    docsLabel: "MiniMax Claude Code",
  },
  {
    id: "minimax-intl",
    name: "MiniMax（国际）",
    baseUrl: "https://api.minimax.io/anthropic",
    model: "MiniMax-M2.7",
    sonnetModel: "MiniMax-M2.7",
    opusModel: "MiniMax-M2.7",
    fastModel: "MiniMax-M2.7",
    hint: "国际用户使用 api.minimax.io",
    docsUrl: "https://platform.minimax.io/docs/token-plan/claude-code",
    docsLabel: "MiniMax Claude Code",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/anthropic",
    model: "glm-4.7",
    sonnetModel: "glm-4.7",
    opusModel: "glm-4.7",
    fastModel: "glm-4.7",
    hint: "智谱开放平台 API Key",
    docsUrl: "https://open.bigmodel.cn/",
    docsLabel: "智谱开放平台",
  },
  {
    id: "qwen",
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/apps/anthropic",
    model: "qwen3-max",
    sonnetModel: "qwen3-max",
    opusModel: "qwen3-max",
    fastModel: "qwen3-max",
    hint: "阿里云 DashScope API Key",
    docsUrl: "https://dashscope.aliyun.com/",
    docsLabel: "DashScope",
  },
  {
    id: "gemini-proxy",
    name: "Gemini（本地代理）",
    baseUrl: "http://127.0.0.1:8082",
    model: "gemini-2.5-flash",
    sonnetModel: "gemini-2.5-flash",
    opusModel: "gemini-2.5-pro",
    fastModel: "gemini-2.5-flash",
    hint: "需运行 gemini-claude-bridge 等 Anthropic↔Gemini 代理",
    docsUrl: "https://github.com/weijiafu14/gemini-claude-bridge",
    docsLabel: "gemini-claude-bridge",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api",
    model: "anthropic/claude-sonnet-4.5",
    sonnetModel: "anthropic/claude-sonnet-4.5",
    opusModel: "anthropic/claude-opus-4.5",
    fastModel: "anthropic/claude-haiku-4.5",
    hint: "OpenRouter 聚合网关",
    docsUrl: "https://openrouter.ai/docs",
    docsLabel: "OpenRouter Docs",
  },
];

export function providerModeLabel(mode: CcProviderMode): string {
  return mode === "official" ? "官方" : "自定义";
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function findCcProviderPreset(id: string): CcProviderPreset | undefined {
  if (id === "official") return CC_OFFICIAL_PRESET;
  return CC_PROVIDER_PRESETS.find((p) => p.id === id);
}

export function presetToProviderMode(preset: CcProviderPreset): CcProviderMode {
  return preset.id === "official" || !preset.baseUrl ? "official" : "custom";
}
