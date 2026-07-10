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

export const IWHALECLOUD_GPT_PROXY_PRESET: AiCloudPreset = {
  id: "iwhalecloud-gpt-proxy",
  name: "浩鲸 GPT Proxy",
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
  docsLabel: "GPT Proxy 接口",
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

export const AI_CLOUD_PRESETS: AiCloudPreset[] = [
  IWHALECLOUD_GPT_PROXY_PRESET,
  AGNES_AI_PRESET,
];

export function findPresetByBaseUrl(baseUrl: string): AiCloudPreset | undefined {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  return AI_CLOUD_PRESETS.find(
    (p) => p.baseUrl.replace(/\/+$/, "") === normalized,
  );
}

export function findPresetById(id: string): AiCloudPreset | undefined {
  return AI_CLOUD_PRESETS.find((p) => p.id === id);
}

export function providerMatchesPreset(
  provider: { name: string; baseUrl: string },
  preset: AiCloudPreset,
): boolean {
  if (findPresetByBaseUrl(provider.baseUrl)?.id === preset.id) return true;
  return provider.name.trim().toLowerCase() === preset.name.toLowerCase();
}
