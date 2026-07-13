/** 云端 AI 提供商预设（OpenAI 兼容 API） */
export interface AiCloudPresetModel {
  id: string;
  label: string;
  /** chat = /v1/chat/completions；image = /v1/images/generations */
  kind: "chat" | "image";
}

export interface AiCloudPreset {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  models: AiCloudPresetModel[];
  docsUrl: string;
  docsLabel: string;
  description: string;
}

export const DEEPSEEK_PRESET: AiCloudPreset = {
  id: "deepseek",
  name: "DeepSeek",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  models: [
    { id: "deepseek-chat", label: "DeepSeek Chat（对话，推荐）", kind: "chat" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner（推理）", kind: "chat" },
  ],
  docsUrl: "https://platform.deepseek.com/api-docs/",
  docsLabel: "DeepSeek API",
  description: "OpenAI 兼容 API · 高性价比对话模型",
};

export const LITTLE_WHALE_GPT_PROXY_PRESET: AiCloudPreset = {
  id: "little-whale-gpt-proxy",
  name: "小鲸鱼",
  baseUrl: "https://lab.iwhalecloud.com/gpt-proxy/v1",
  model: "LOCAL/MiniMax-M2.7",
  models: [
    {
      id: "LOCAL/MiniMax-M2.7",
      label: "MiniMax M2.7（对话，推荐）",
      kind: "chat",
    },
  ],
  docsUrl: "https://lab.iwhalecloud.com/gpt-proxy/v1/chat/completions",
  docsLabel: "小鲸鱼 GPT 接口",
  description: "OpenAI 兼容 API · Authorization: Bearer API_KEY",
};

export const AGNES_AI_PRESET: AiCloudPreset = {
  id: "agnes-ai",
  name: "Agnes AI",
  baseUrl: "https://apihub.agnes-ai.com/v1",
  model: "agnes-2.0-flash",
  models: [
    { id: "agnes-2.0-flash", label: "Agnes 2.0 Flash（对话，推荐）", kind: "chat" },
    {
      id: "agnes-image-2.0-flash",
      label: "Agnes Image 2.0 Flash（文生图/图生图）",
      kind: "image",
    },
    {
      id: "agnes-image-2.1-flash",
      label: "Agnes Image 2.1 Flash（高密度图像）",
      kind: "image",
    },
  ],
  docsUrl: "https://agnes-ai.com/zh-Hans/docs/quickstart",
  docsLabel: "Agnes AI 快速开始",
  description: "OpenAI 兼容 API · 在开发者控制台生成 API Key",
};

export const MOONSHOT_PRESET: AiCloudPreset = {
  id: "moonshot",
  name: "Kimi（月之暗面）",
  baseUrl: "https://api.moonshot.cn/v1",
  model: "kimi-k2.5",
  models: [
    { id: "kimi-k2.5", label: "Kimi K2.5（对话，推荐）", kind: "chat" },
    { id: "moonshot-v1-32k", label: "Moonshot v1 32K", kind: "chat" },
    { id: "moonshot-v1-8k", label: "Moonshot v1 8K", kind: "chat" },
  ],
  docsUrl: "https://platform.moonshot.cn/docs",
  docsLabel: "Moonshot 开放平台",
  description: "OpenAI 兼容 API · 国内 Kimi 模型",
};

export const ZHIPU_PRESET: AiCloudPreset = {
  id: "zhipu",
  name: "智谱 GLM",
  baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  model: "glm-4-flash",
  models: [
    { id: "glm-4-flash", label: "GLM-4 Flash（对话，推荐）", kind: "chat" },
    { id: "glm-4-plus", label: "GLM-4 Plus", kind: "chat" },
    { id: "glm-4-air", label: "GLM-4 Air", kind: "chat" },
  ],
  docsUrl: "https://open.bigmodel.cn/dev/api",
  docsLabel: "智谱开放平台",
  description: "OpenAI 兼容 API · 智谱开放平台 API Key",
};

export const QWEN_PRESET: AiCloudPreset = {
  id: "qwen",
  name: "通义千问",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "qwen-plus",
  models: [
    { id: "qwen-plus", label: "Qwen Plus（对话，推荐）", kind: "chat" },
    { id: "qwen-max", label: "Qwen Max", kind: "chat" },
    { id: "qwen-turbo", label: "Qwen Turbo", kind: "chat" },
  ],
  docsUrl: "https://help.aliyun.com/zh/model-studio/",
  docsLabel: "阿里云百炼",
  description: "OpenAI 兼容模式 · DashScope API Key",
};

export const MINIMAX_PRESET: AiCloudPreset = {
  id: "minimax",
  name: "MiniMax",
  baseUrl: "https://api.minimaxi.com/v1",
  model: "MiniMax-Text-01",
  models: [
    { id: "MiniMax-Text-01", label: "MiniMax Text 01（对话，推荐）", kind: "chat" },
    { id: "abab6.5s-chat", label: "abab6.5s Chat", kind: "chat" },
  ],
  docsUrl: "https://platform.minimaxi.com/document",
  docsLabel: "MiniMax 开放平台",
  description: "OpenAI 兼容 API · 国内 api.minimaxi.com",
};

export const OPENAI_PRESET: AiCloudPreset = {
  id: "openai",
  name: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  models: [
    { id: "gpt-4o-mini", label: "GPT-4o Mini（对话，推荐）", kind: "chat" },
    { id: "gpt-4o", label: "GPT-4o", kind: "chat" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", kind: "chat" },
  ],
  docsUrl: "https://platform.openai.com/docs/api-reference",
  docsLabel: "OpenAI API",
  description: "官方 OpenAI API · 需可访问 api.openai.com",
};

export const SILICONFLOW_PRESET: AiCloudPreset = {
  id: "siliconflow",
  name: "硅基流动",
  baseUrl: "https://api.siliconflow.cn/v1",
  model: "deepseek-ai/DeepSeek-V3",
  models: [
    {
      id: "deepseek-ai/DeepSeek-V3",
      label: "DeepSeek V3（对话，推荐）",
      kind: "chat",
    },
    { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen 2.5 72B", kind: "chat" },
    { id: "Pro/deepseek-ai/DeepSeek-R1", label: "DeepSeek R1", kind: "chat" },
  ],
  docsUrl: "https://docs.siliconflow.cn/",
  docsLabel: "硅基流动文档",
  description: "OpenAI 兼容 API · 多模型聚合网关",
};

export const AI_CLOUD_PRESETS: AiCloudPreset[] = [
  DEEPSEEK_PRESET,
  LITTLE_WHALE_GPT_PROXY_PRESET,
  MOONSHOT_PRESET,
  ZHIPU_PRESET,
  QWEN_PRESET,
  MINIMAX_PRESET,
  AGNES_AI_PRESET,
  SILICONFLOW_PRESET,
  OPENAI_PRESET,
];

export function normalizePresetBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function findPresetByBaseUrl(baseUrl: string): AiCloudPreset | undefined {
  const normalized = normalizePresetBaseUrl(baseUrl);
  return AI_CLOUD_PRESETS.find(
    (p) => normalizePresetBaseUrl(p.baseUrl) === normalized,
  );
}

export function findPresetById(id: string): AiCloudPreset | undefined {
  return AI_CLOUD_PRESETS.find((p) => p.id === id);
}

export function providerMatchesPreset(
  provider: { name: string; baseUrl: string; presetId?: string },
  preset: AiCloudPreset,
): boolean {
  if (provider.presetId === preset.id) return true;
  if (findPresetByBaseUrl(provider.baseUrl)?.id === preset.id) return true;
  return provider.name.trim().toLowerCase() === preset.name.toLowerCase();
}
