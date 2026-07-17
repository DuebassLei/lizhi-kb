// AI 写作小助手 · 类型定义
// Spec: docs/superpowers/specs/2026-07-15-ai-writing-assistant-design.md

/** 步骤 id（逻辑序号固定，不随开关重编号） */
export type WaStepId =
  | "topic"
  | "outline"
  | "body"
  | "humanize"
  | "illustrations"
  | "cover"
  | "finalize";

/** 大纲结构框架（内容模版） */
export type WaOutlineFramework =
  | "general"
  | "problemSolution"
  | "howto"
  | "storyCase"
  | "comparison"
  | "listicle"
  | "viral"
  | "contrarian"
  | "emotional";

/** @deprecated 已由 targetWords 取代；仅迁移用 */
export type WaLengthPreset = "short" | "medium" | "long";

/** @deprecated 已由 humanizeSkill 取代；仅迁移用 */
export type WaHumanizeStrength = "light" | "medium" | "heavy";

/** 配图版式 */
export type WaIllustrationLayout = "hero" | "split" | "bullets";

/** 色板 mood */
export type WaMood = "cool" | "warm" | "neutral";

/** 封面模板 id（精品三套） */
export type WaCoverTemplateId = "plain" | "grid" | "accent";

/** 封面来源 */
export type WaCoverSource = "template" | "upload" | "ai";

/** AI 封面风格预设 */
export type WaCoverAiStyle = "tech" | "comic" | "flat";


/** 单条结构化配图提示词（契约，见 spec §5.2） */
export interface WaIllustrationPrompt {
  sectionId: string;
  title: string;
  caption: string;
  keywords: string[];
  layout: WaIllustrationLayout;
  mood: WaMood;
  notes?: string;
  /** 用户可单节关闭 */
  enabled?: boolean;
  /** 落盘后的 asset ref，如 asset://xxx.png */
  assetRef?: string;
}

/** 选题候选 */
export interface WaTopicCandidate {
  title: string;
  angle: string;
}

/** 写作助手会话配置 */
export interface WaConfig {
  /** 大纲结构框架模版 */
  outlineFramework: WaOutlineFramework;
  /** 风格包 id（内置或 vault） */
  stylePackId: string;
  styleExtra?: string;
  /** 目标字数（约 100–6000） */
  targetWords: number;
  /**
   * 去 AI 味 Skill 名（如 humanizer-zh / /humanizer-zh）
   * 空字符串 = 仅用内置兜底规则
   */
  humanizeSkill: string;
  useRag: boolean;
  enableCover: boolean;
  enableIllustrations: boolean;
  defaultCoverTemplate: WaCoverTemplateId;
  defaultIllustrationLayout: WaIllustrationLayout;
}

/** 单步状态 */
export interface WaStepState<T = string> {
  /** 已采用的内容（采用门禁：有值才算 done） */
  adopted?: T;
  /** 当前编辑中内容（流式 / 手改） */
  draft?: T;
  /** 是否已采用过 */
  done: boolean;
  /** 下游失效标记 */
  stale: boolean;
}

/** 会话快照（草稿） */
export interface WaSessionSnapshot {
  config: WaConfig;
  currentStep: WaStepId;
  topic: WaStepState<string>;
  outline: WaStepState<string>;
  body: WaStepState<string>;
  humanize: WaStepState<string>;
  /** 选题候选列表 */
  topicCandidates: WaTopicCandidate[];
  /** 配图提示词列表 */
  illustrations: WaIllustrationPrompt[];
  /** 封面 asset ref */
  coverAssetRef?: string;
  /** 封面主标题（可改；空则回退选题） */
  coverTitle?: string;
  /** 封面来源 */
  coverSource: WaCoverSource;
  /** 上传 / AI 是否叠主副标题 */
  coverOverlayText: boolean;
  /** AI 生图风格 */
  coverAiStyle: WaCoverAiStyle;
  /** AI 生图 prompt（可改） */
  coverAiPrompt?: string;
  /** 封面模板选择 */
  coverTemplate: WaCoverTemplateId;
  coverSubtitle?: string;
  /** 封面色板（模板路径） */
  coverMood?: WaMood;
  /**
   * 最近一次落盘时的合成指纹（title|subtitle|overlay）
   * 用于无原图 blob 时判断是否可直接采用已落盘图
   */
  coverComposeKey?: string;
  /** 定稿落点 */
  finalizeMode: "create" | "replace";
}

export const WA_STEP_ORDER: WaStepId[] = [
  "topic",
  "outline",
  "body",
  "humanize",
  "illustrations",
  "cover",
  "finalize",
];

export const WA_TEXT_STEPS: WaStepId[] = ["topic", "outline", "body", "humanize"];

export const WA_STEP_LABELS: Record<WaStepId, string> = {
  topic: "选题",
  outline: "大纲",
  body: "正文",
  humanize: "去 AI 味",
  illustrations: "配图",
  cover: "封面",
  finalize: "定稿",
};
