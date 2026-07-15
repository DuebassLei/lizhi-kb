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

/** 大纲格式预设（书写形式） */
export type WaOutlineFormat = "h2h3" | "cn" | "list" | "custom";

/** 大纲结构框架（内容模版） */
export type WaOutlineFramework =
  | "general"
  | "problemSolution"
  | "howto"
  | "storyCase"
  | "comparison"
  | "listicle";

/** 写作风格预设 */
export type WaStylePreset = "clear" | "story" | "rigorous" | "casual";

/** 目标字数预设 */
export type WaLengthPreset = "short" | "medium" | "long";

/** 去 AI 味强度 */
export type WaHumanizeStrength = "light" | "medium" | "heavy";

/** 配图版式 */
export type WaIllustrationLayout = "hero" | "split" | "bullets";

/** 色板 mood */
export type WaMood = "cool" | "warm" | "neutral";

/** 封面模板 id */
export type WaCoverTemplateId = "plain" | "grid" | "accent";

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
  outlineFormat: WaOutlineFormat;
  outlineFormatCustom?: string;
  /** 大纲结构框架模版 */
  outlineFramework: WaOutlineFramework;
  stylePreset: WaStylePreset;
  styleExtra?: string;
  length: WaLengthPreset;
  humanizeStrength: WaHumanizeStrength;
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
  /** 封面用户上传 / 模板选择 */
  coverTemplate: WaCoverTemplateId;
  coverSubtitle?: string;
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
