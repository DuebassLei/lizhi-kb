import type {
  WaConfig,
  WaCoverTemplateId,
  WaHumanizeStrength,
  WaIllustrationLayout,
  WaLengthPreset,
  WaOutlineFormat,
  WaOutlineFramework,
  WaStylePreset,
} from "../../types/writingAssistant";

export const WA_DEFAULT_CONFIG: WaConfig = {
  outlineFormat: "h2h3",
  outlineFramework: "general",
  stylePreset: "clear",
  length: "medium",
  humanizeStrength: "medium",
  useRag: false,
  enableCover: true,
  enableIllustrations: true,
  defaultCoverTemplate: "plain",
  defaultIllustrationLayout: "hero",
};

export const WA_OUTLINE_FORMAT_LABELS: Record<WaOutlineFormat, string> = {
  h2h3: "H2 / H3",
  cn: "一 / （一） / 1.",
  list: "纯列表",
  custom: "自定义",
};

export const WA_OUTLINE_FRAMEWORK_LABELS: Record<WaOutlineFramework, string> = {
  general: "总分总（通用）",
  problemSolution: "痛点 → 方案",
  howto: "教程步骤",
  storyCase: "故事 / 案例",
  comparison: "对比评测",
  listicle: "清单盘点",
};

export const WA_OUTLINE_FRAMEWORK_HINTS: Record<WaOutlineFramework, string> = {
  general: "开篇 → 总述 → 分论 → 收束，适合多数公众号长文",
  problemSolution: "现象 → 原因 → 方案 → 验证 → 行动",
  howto: "准备 → 分步操作 → 复盘进阶",
  storyCase: "故事开场 → 洞察 → 方法论 → 套用",
  comparison: "背景 → 方案对比 → 建议结论",
  listicle: "开篇 + 多要点清单 + 怎么选",
};

export const WA_STYLE_PRESET_LABELS: Record<WaStylePreset, string> = {
  clear: "科普清晰",
  story: "故事感",
  rigorous: "严谨论述",
  casual: "轻松口语",
};

export const WA_LENGTH_LABELS: Record<WaLengthPreset, string> = {
  short: "短（约 800 字）",
  medium: "中（约 1800 字）",
  long: "长（约 3500 字）",
};

export const WA_LENGTH_WORD_TARGET: Record<WaLengthPreset, number> = {
  short: 800,
  medium: 1800,
  long: 3500,
};

export const WA_HUMANIZE_LABELS: Record<WaHumanizeStrength, string> = {
  light: "轻",
  medium: "中",
  heavy: "重",
};

export const WA_ILLUSTRATION_LAYOUT_LABELS: Record<WaIllustrationLayout, string> = {
  hero: "主图（hero）",
  split: "分栏（split）",
  bullets: "要点（bullets）",
};

export const WA_COVER_TEMPLATE_LABELS: Record<WaCoverTemplateId, string> = {
  plain: "纯色主标题",
  grid: "网格分块",
  accent: "色块强调",
};

export const WA_MOOD_LABELS = {
  cool: "冷色",
  warm: "暖色",
  neutral: "中性",
} as const;

/** 能力声明固定句（spec §13.11） */
export const WA_CAPABILITY_TEXT = "公众号长文 · 版式配图";
export const WA_ILLUSTRATION_DISCLAIMER = "配图与封面为本地 Canvas 版式卡，非 AI 文生图";
