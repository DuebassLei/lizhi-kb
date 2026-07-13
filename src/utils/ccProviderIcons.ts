import type { CcChatModelOption } from "./ccChatModels";

/** 供应商 preset / id → 显示图标（emoji 占位，后续可换 SVG） */
const PROVIDER_ICON_MAP: Record<string, string> = {
  anthropic: "🅰",
  deepseek: "🐋",
  openai: "🌀",
  google: "🔷",
  local: "💻",
  "local-settings": "⚙",
  minimax: "🤖",
  zhipu: "🧠",
  moonshot: "🌙",
  qwen: "☁",
  custom: "🔌",
};

const MODEL_FAMILY_ICON: Record<string, string> = {
  opus: "👑",
  sonnet: "🎵",
  haiku: "🍃",
  deepseek: "🐋",
  gpt: "🌀",
  claude: "🅰",
};

export function providerIcon(providerId: string, mode?: string): string {
  const key = providerId.toLowerCase();
  if (PROVIDER_ICON_MAP[key]) return PROVIDER_ICON_MAP[key];
  if (mode === "local") return "💻";
  if (mode === "official") return "🅰";
  return "🔌";
}

export function modelOptionIcon(opt: CcChatModelOption): string {
  const id = opt.baseId.toLowerCase();
  if (id.includes("opus")) return MODEL_FAMILY_ICON.opus;
  if (id.includes("sonnet")) return MODEL_FAMILY_ICON.sonnet;
  if (id.includes("haiku")) return MODEL_FAMILY_ICON.haiku;
  if (id.includes("deepseek")) return MODEL_FAMILY_ICON.deepseek;
  if (id.includes("gpt")) return MODEL_FAMILY_ICON.gpt;
  if (id.includes("claude")) return MODEL_FAMILY_ICON.claude;
  if (opt.source === "custom") return "✏";
  if (opt.source === "recent") return "🕐";
  return "◇";
}
