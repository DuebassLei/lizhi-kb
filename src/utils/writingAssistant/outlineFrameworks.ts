import type { WaOutlineFramework } from "../../types/writingAssistant";
import { resolveTargetWords } from "./defaults";
import { LAYOUT_MODULE_SNIPPETS } from "../../services/wechatExport/moduleSnippets";

/** 大纲结构框架：预填小节骨架，生成时再填实质内容 */
export type OutlineSection = {
  title: string;
  /**
   * 叶子要点（`-` 列表）。若未声明 `children`，渲染时会把 bullets 提升为下一级标题。
   */
  bullets?: string[];
  /** 子章节（更深一级 Markdown 标题） */
  children?: OutlineSection[];
  /** 占全文目标字数比例 0–100（仅顶级节统计预算） */
  weightPct?: number;
  /** 建议 :::module 类型 id（与 moduleSnippets 对齐） */
  moduleHint?: string;
};

const FRAMEWORKS: Record<WaOutlineFramework, OutlineSection[]> = {
  general: [
    { title: "开篇：为什么现在要谈这个", bullets: ["读者痛点或场景", "本文能带走什么"], weightPct: 15, moduleHint: "hero" },
    { title: "核心观点 / 总述", bullets: ["一句话中心论点", "全文结构预告"], weightPct: 20, moduleHint: "lead" },
    { title: "分论点一", bullets: ["论据或案例", "小结"], weightPct: 25 },
    { title: "分论点二", bullets: ["论据或案例", "小结"], weightPct: 25 },
    { title: "落地建议与收束", bullets: ["可行动清单", "结尾金句"], weightPct: 15, moduleHint: "summary" },
  ],
  problemSolution: [
    { title: "现象：读者正在面对的麻烦", bullets: ["具体场景", "代价是什么"], weightPct: 20, moduleHint: "lead" },
    { title: "原因：问题从哪来", bullets: ["表层原因", "深层原因"], weightPct: 20 },
    { title: "方案：怎么解决", bullets: ["原则或路径", "关键步骤"], weightPct: 25, moduleHint: "steps" },
    { title: "验证：这样做会怎样", bullets: ["前后对比", "注意事项"], weightPct: 20 },
    { title: "行动清单", bullets: ["今天就能做的 3 件事"], weightPct: 15, moduleHint: "summary" },
  ],
  howto: [
    { title: "写在前面：适合谁、要准备什么", bullets: ["读者画像", "前置条件"], weightPct: 15, moduleHint: "hero" },
    {
      title: "步骤一",
      weightPct: 25,
      moduleHint: "steps",
      children: [
        { title: "做什么", bullets: ["关键动作"] },
        { title: "为什么", bullets: ["这一步的目的"] },
        { title: "常见坑", bullets: ["避坑提示"] },
      ],
    },
    {
      title: "步骤二",
      weightPct: 25,
      children: [
        { title: "做什么", bullets: ["关键动作"] },
        { title: "为什么", bullets: ["这一步的目的"] },
        { title: "常见坑", bullets: ["避坑提示"] },
      ],
    },
    {
      title: "步骤三",
      weightPct: 20,
      children: [
        { title: "做什么", bullets: ["关键动作"] },
        { title: "验收标准", bullets: ["怎样算做完"] },
      ],
    },
    { title: "复盘与进阶", bullets: ["Checklist", "下一阶段"], weightPct: 15, moduleHint: "faq" },
  ],
  storyCase: [
    { title: "故事开场", bullets: ["人物与冲突", "悬念"], weightPct: 20, moduleHint: "hero" },
    { title: "转折与洞察", bullets: ["关键事件", "可迁移结论"], weightPct: 25, moduleHint: "lead" },
    { title: "方法论抽离", bullets: ["步骤或原则", "适用边界"], weightPct: 20 },
    { title: "读者如何套用", bullets: ["对照自己的场景"], weightPct: 20 },
    { title: "结尾回响", bullets: ["呼应开场", "留一句行动号召"], weightPct: 15, moduleHint: "summary" },
  ],
  comparison: [
    { title: "选型背景：我们要比什么", bullets: ["评价维度说明"], weightPct: 15, moduleHint: "lead" },
    { title: "方案 A", bullets: ["优势", "短板", "适合谁"], weightPct: 25 },
    { title: "方案 B", bullets: ["优势", "短板", "适合谁"], weightPct: 25 },
    { title: "横向对比表（文字说明）", bullets: ["维度一", "维度二", "维度三"], weightPct: 20, moduleHint: "compare" },
    { title: "建议结论", bullets: ["推荐路径", "不同预算/阶段怎么选"], weightPct: 15, moduleHint: "summary" },
  ],
  listicle: [
    { title: "开篇：为什么要整理这份清单", bullets: ["读者收益"], weightPct: 10, moduleHint: "hero" },
    { title: "要点 1", bullets: ["是什么", "怎么用", "注意点"], weightPct: 20, moduleHint: "cards" },
    { title: "要点 2", bullets: ["是什么", "怎么用", "注意点"], weightPct: 20 },
    { title: "要点 3", bullets: ["是什么", "怎么用", "注意点"], weightPct: 20 },
    { title: "要点 4 / 补充", bullets: ["可选扩展"], weightPct: 15 },
    { title: "怎么选与怎么开始", bullets: ["优先级建议"], weightPct: 15, moduleHint: "summary" },
  ],
  viral: [
    { title: "钩子：你一定见过…", bullets: ["共鸣场景", "一句话抓住注意力"], weightPct: 10, moduleHint: "hero" },
    { title: "数据 / 现象：这事有多火", bullets: ["具体数字或时间线", "可信来源感"], weightPct: 10, moduleHint: "lead" },
    { title: "痛点：大部分人其实还不懂", bullets: ["常见误解", "读者卡点"], weightPct: 10 },
    { title: "承诺：今天用人话讲明白", bullets: ["本文收益", "阅读路径预告"], weightPct: 10 },
    { title: "比喻展开：先给结论再类比", bullets: ["一级比喻", "展开类比", "金句收束"], weightPct: 20, moduleHint: "golden" },
    { title: "反驳误解：我知道有人会说…", bullets: ["预判质疑", "正面回应差别"], weightPct: 15 },
    { title: "场景举例：和你有什么关系", bullets: ["2–3 类读者场景", "可行动切口"], weightPct: 15 },
    { title: "升华与号召", bullets: ["关系/认知升级", "今天就能做的一步"], weightPct: 10, moduleHint: "summary" },
  ],
  contrarian: [
    {
      title: "大胆陈述：反常识结论",
      bullets: ["一句颠覆观点", "避免人身攻击", "（开篇冲突约 20%）"],
      weightPct: 10,
      moduleHint: "lead",
    },
    { title: "意外数据 / 现象", bullets: ["数字或反差事实", "制造「为什么」"], weightPct: 10 },
    {
      title: "大众错在哪",
      bullets: ["常见信念", "错因分层", "（论证主体约 60%）"],
      weightPct: 15,
      moduleHint: "myth-fact",
    },
    { title: "真相逻辑", bullets: ["推演链条", "证据类型"], weightPct: 25 },
    { title: "案例佐证", bullets: ["人物/公司/事件", "可迁移点"], weightPct: 20 },
    {
      title: "行动与讨论",
      bullets: ["读者可怎么做", "邀请评论区讨论", "（CTA 约 20%）"],
      weightPct: 20,
      moduleHint: "summary",
    },
  ],
  emotional: [
    { title: "人物出场", bullets: ["身份锚定", "日常细节"], weightPct: 20, moduleHint: "hero" },
    { title: "冲突 / 困境", bullets: ["情绪词", "具体数字或场景"], weightPct: 25, moduleHint: "lead" },
    { title: "转折", bullets: ["契机", "关键决定或遇见"], weightPct: 20 },
    { title: "洞察", bullets: ["顿悟金句", "可迁移结论"], weightPct: 20, moduleHint: "golden" },
    { title: "呼应读者", bullets: ["回到「你」", "轻行动号召", "留白"], weightPct: 15, moduleHint: "summary" },
  ],
};

/** 框架级整篇 :::module 建议顺序（snippet id） */
export const WA_FRAMEWORK_MODULE_SEQUENCE: Record<WaOutlineFramework, string[]> = {
  howto: ["hero", "steps", "golden", "faq"],
  comparison: ["lead", "compare", "summary"],
  listicle: ["hero", "cards", "summary"],
  viral: ["hero", "lead", "golden", "summary"],
  contrarian: ["lead", "myth-fact", "summary"],
  emotional: ["hero", "lead", "golden", "summary"],
  general: ["hero", "summary"],
  problemSolution: ["hero", "summary"],
  storyCase: ["hero", "summary"],
};

export type TopicFrameworkRule = {
  keywords: string[];
  framework: WaOutlineFramework;
  priority: number;
};

/** 选题关键词 → 框架（优先级高者优先） */
export const WA_TOPIC_FRAMEWORK_RULES: TopicFrameworkRule[] = [
  { keywords: ["对比", "评测", "vs", "哪个好", "横评"], framework: "comparison", priority: 10 },
  { keywords: ["步骤", "教程", "怎么做", "上手", "指南"], framework: "howto", priority: 10 },
  { keywords: ["清单", "盘点", "合集", "推荐", "必备"], framework: "listicle", priority: 9 },
  { keywords: ["其实", "误区", "真相", "颠覆", "反常识"], framework: "contrarian", priority: 10 },
  { keywords: ["故事", "经历", "我曾", "逆袭", "共鸣"], framework: "emotional", priority: 9 },
  { keywords: ["爆款", "刷屏", "全网", "火了"], framework: "viral", priority: 8 },
];

export const WA_OUTLINE_FRAMEWORK_ORDER: WaOutlineFramework[] = [
  "general",
  "problemSolution",
  "howto",
  "storyCase",
  "comparison",
  "listicle",
  "viral",
  "contrarian",
  "emotional",
];

export const WA_OUTLINE_FRAMEWORK_GENERAL: WaOutlineFramework[] = [
  "general",
  "problemSolution",
  "howto",
  "storyCase",
  "comparison",
  "listicle",
];

export const WA_OUTLINE_FRAMEWORK_STYLE_ORIENTED: WaOutlineFramework[] = [
  "viral",
  "contrarian",
  "emotional",
];

export const WA_STYLE_FRAMEWORK_SUGGESTIONS: Record<string, WaOutlineFramework> = {
  default: "howto",
  viral: "viral",
  checklist: "listicle",
  resourceRoundup: "listicle",
  toolReview: "howto",
  contrarian: "contrarian",
  identity: "emotional",
  storyEmotional: "emotional",
  personalEssay: "storyCase",
};

export function suggestFrameworkForStyle(stylePackId: string): WaOutlineFramework | undefined {
  return WA_STYLE_FRAMEWORK_SUGGESTIONS[stylePackId];
}

/** 根据选题文本推荐框架（无命中返回 undefined） */
export function recommendFrameworkFromTopic(text: string): WaOutlineFramework | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  let best: TopicFrameworkRule | undefined;
  for (const rule of WA_TOPIC_FRAMEWORK_RULES) {
    const hit = rule.keywords.some((k) => t.includes(k.toLowerCase()));
    if (!hit) continue;
    if (!best || rule.priority > best.priority) best = rule;
  }
  return best?.framework;
}

/**
 * 综合建议：关键词 > 风格软绑定
 */
export function resolveSuggestedFramework(opts: {
  topicText?: string;
  stylePackId?: string;
}): WaOutlineFramework | undefined {
  const fromTopic = opts.topicText ? recommendFrameworkFromTopic(opts.topicText) : undefined;
  if (fromTopic) return fromTopic;
  if (opts.stylePackId) return suggestFrameworkForStyle(opts.stylePackId);
  return undefined;
}

export function getFrameworkSections(framework: WaOutlineFramework): OutlineSection[] {
  return FRAMEWORKS[framework] ?? FRAMEWORKS.general;
}

export type SectionWordBudget = {
  title: string;
  weightPct: number;
  words: number;
};

export function buildSectionWordBudgets(
  framework: WaOutlineFramework,
  targetWords: number,
): SectionWordBudget[] {
  const total = resolveTargetWords(targetWords);
  const sections = getFrameworkSections(framework);
  return sections.map((s) => {
    const weightPct = s.weightPct ?? Math.round(100 / sections.length);
    return {
      title: s.title,
      weightPct,
      words: Math.max(50, Math.round((total * weightPct) / 100)),
    };
  });
}

export function formatWordBudgetForPrompt(budgets: SectionWordBudget[]): string {
  if (budgets.length === 0) return "";
  const lines = budgets.map(
    (b) => `- 「${b.title}」约 ${b.words} 字（占全文约 ${b.weightPct}%）`,
  );
  return `各节字数预算（请大致遵守，可微调）：\n${lines.join("\n")}`;
}

export type ModuleSuggestItem = {
  id: string;
  title: string;
  snippet: string;
  fallbackComment: string;
};

/** 定稿步：按框架取可复制的 module 建议 */
export function getFrameworkModuleSuggestions(
  framework: WaOutlineFramework,
  opts?: { topicTitle?: string },
): ModuleSuggestItem[] {
  const ids = WA_FRAMEWORK_MODULE_SEQUENCE[framework] ?? WA_FRAMEWORK_MODULE_SEQUENCE.general;
  const title = (opts?.topicTitle ?? "文章标题").trim() || "文章标题";
  return ids.map((id) => {
    const sn = LAYOUT_MODULE_SNIPPETS.find((s) => s.id === id);
    if (sn) {
      let snippet = sn.snippet;
      // 轻量占位：常见主标题行
      snippet = snippet.replace(/主标题[^\n]*/u, title).replace(/这里是主标题/g, title);
      return {
        id,
        title: sn.label || sn.title,
        snippet,
        fallbackComment: "",
      };
    }
    return {
      id,
      title: id,
      snippet: "",
      fallbackComment: `<!-- 建议插入 ::: ${id} 模块（当前主题未收录该片段） -->`,
    };
  });
}

export function isOutlineSkeletonOrEmpty(text: string | undefined | null): boolean {
  if (isOutlineEffectivelyEmpty(text)) return true;
  const t = text ?? "";
  return t.includes("<!-- 框架") || t.includes("<!-- 预设结构");
}

export function renderOutlineFramework(
  framework: WaOutlineFramework,
  opts?: { title?: string },
): string {
  const sections = getFrameworkSections(framework);
  const title = opts?.title?.trim();
  const header =
    title != null && title.length > 0
      ? `<!-- 框架基于选题「${title}」，可改标题后点「生成」充实要点 -->\n`
      : `<!-- 预设结构框架，可改章节后点「生成」让 AI 充实 -->\n`;

  const body = sections.map((s) => renderSectionTree(s, OUTLINE_HEADING_MIN)).join("\n\n");
  return `${header}${body}`.trim() + "\n";
}

/** 大纲标题层级：文章标题占 `#`，骨架从 `##` 起，最深到 `####` */
const OUTLINE_HEADING_MIN = 2;
const OUTLINE_HEADING_MAX = 4;

function headingMarks(level: number): string {
  const n = Math.min(Math.max(level, OUTLINE_HEADING_MIN), OUTLINE_HEADING_MAX);
  return "#".repeat(n);
}

function isWeightNote(text: string): boolean {
  return /约占全文/.test(text);
}

/**
 * 解析一节的子树：显式 children 优先；否则把非字数备注的 bullets 提升为下一级标题。
 */
export function resolveSectionChildren(s: OutlineSection): OutlineSection[] {
  if (s.children && s.children.length > 0) return s.children;
  return (s.bullets ?? [])
    .filter((b) => !isWeightNote(b))
    .map((title) => ({ title }));
}

function leafBulletsFor(s: OutlineSection, level: number): string[] {
  const tips: string[] = [];
  // 有显式 children 时，bullets 仍作为本级要点保留
  if (s.children && s.children.length > 0 && s.bullets?.length) {
    tips.push(...s.bullets.filter((b) => !isWeightNote(b)));
  }
  if (s.weightPct != null && level === OUTLINE_HEADING_MIN) {
    tips.push(`（建议约占全文 ${s.weightPct}%）`);
  } else if (s.bullets) {
    tips.push(...s.bullets.filter(isWeightNote));
  }
  return tips;
}

function renderSectionTree(s: OutlineSection, level: number): string {
  const parts: string[] = [`${headingMarks(level)} ${s.title}`];
  for (const child of resolveSectionChildren(s)) {
    parts.push(renderSectionTree(child, level + 1));
  }
  for (const tip of leafBulletsFor(s, level)) {
    parts.push(`- ${tip}`);
  }
  return parts.join("\n");
}

export function isOutlineEffectivelyEmpty(text: string | undefined | null): boolean {
  if (text == null) return true;
  const stripped = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, "")
    .trim();
  return stripped.length === 0;
}
