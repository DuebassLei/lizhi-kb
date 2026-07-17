import type {
  WaConfig,
  WaCoverTemplateId,
  WaIllustrationLayout,
  WaOutlineFramework,
} from "../../types/writingAssistant";

export const WA_TARGET_WORDS_MIN = 100;
export const WA_TARGET_WORDS_MAX = 6000;
export const WA_TARGET_WORDS_STEP = 100;
export const WA_TARGET_WORDS_DEFAULT = 1800;

/** 滑杆快捷点 */
export const WA_TARGET_WORDS_PRESETS = [800, 1800, 3500] as const;

export const WA_DEFAULT_CONFIG: WaConfig = {
  outlineFramework: "general",
  stylePackId: "default",
  targetWords: WA_TARGET_WORDS_DEFAULT,
  humanizeSkill: "humanizer-zh",
  useRag: false,
  enableCover: true,
  enableIllustrations: true,
  defaultCoverTemplate: "plain",
  defaultIllustrationLayout: "hero",
};

export const WA_OUTLINE_FRAMEWORK_LABELS: Record<WaOutlineFramework, string> = {
  general: "总分总（通用）",
  problemSolution: "痛点 → 方案",
  howto: "教程步骤",
  storyCase: "故事 / 案例",
  comparison: "对比评测",
  listicle: "清单盘点",
  viral: "爆款钩子链",
  contrarian: "反常识论证",
  emotional: "情感共鸣弧",
};

export const WA_OUTLINE_FRAMEWORK_HINTS: Record<WaOutlineFramework, string> = {
  general: "开篇 → 总述 → 分论 → 收束，适合多数公众号长文",
  problemSolution: "现象 → 原因 → 方案 → 验证 → 行动",
  howto: "准备 → 分步操作 → 复盘进阶",
  storyCase: "故事开场 → 洞察 → 方法论 → 套用",
  comparison: "背景 → 方案对比 → 建议结论",
  listicle: "开篇 + 多要点清单 + 怎么选",
  viral: "钩子 → 数据 → 痛点 → 承诺 → 比喻 → 反驳 → 场景 → 升华（吸收爆款结构）",
  contrarian: "大胆陈述 → 数据 → 纠偏 → 逻辑 → 案例 → CTA（约 20/60/20）",
  emotional: "人物 → 冲突 → 转折 → 洞察 → 呼应读者",
};

const LEGACY_LENGTH_WORDS: Record<string, number> = {
  short: 800,
  medium: 1800,
  long: 3500,
};

/** 将任意配置值规范到滑杆范围内 */
export function resolveTargetWords(raw: unknown): number {
  let n: number;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    n = raw;
  } else if (typeof raw === "string" && raw in LEGACY_LENGTH_WORDS) {
    n = LEGACY_LENGTH_WORDS[raw];
  } else if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    n = Number(raw.trim());
  } else {
    n = WA_TARGET_WORDS_DEFAULT;
  }
  const stepped =
    Math.round(n / WA_TARGET_WORDS_STEP) * WA_TARGET_WORDS_STEP;
  return Math.min(WA_TARGET_WORDS_MAX, Math.max(WA_TARGET_WORDS_MIN, stepped));
}

/** 去掉前导 /，小写目录名风格保留原样（仅 trim） */
export function normalizeHumanizeSkillName(raw: string | undefined | null): string {
  return (raw ?? "").trim().replace(/^\/+/, "");
}

/** Skill 未配置或读取失败时的内置去 AI 味规则 */
export const WA_HUMANIZE_FALLBACK_RULES = `请对正文做去 AI 味改写：
- 保留结构与事实，改掉过于工整的排比、套话、机械过渡
- 句长有变化，口语连接自然
- 不删信息密度，不夸大
- 输出完整改写后正文（含标题），不要解释`;

export const WA_ILLUSTRATION_LAYOUT_LABELS: Record<WaIllustrationLayout, string> = {
  hero: "主图（hero）",
  split: "分栏（split）",
  bullets: "要点（bullets）",
};

export const WA_COVER_TEMPLATE_LABELS: Record<WaCoverTemplateId, string> = {
  plain: "极简杂志",
  grid: "硬科技 HUD",
  accent: "漫画分镜",
};

export const WA_MOOD_LABELS = {
  cool: "冷色",
  warm: "暖色",
  neutral: "中性",
} as const;

/** 能力声明固定句（spec §13.11） */
export const WA_CAPABILITY_TEXT = "公众号长文 · 封面三路径";
export const WA_ILLUSTRATION_DISCLAIMER =
  "封面/配图可为本地版式、上传图或 AI 生成（若已配置图片模型）";
