/** 公众号排版模块片段（插入编辑器）+ 菜单迷你预览元数据 */

export type LayoutModuleKind =
  | "callout"
  | "quote"
  | "steps"
  | "timeline"
  | "compare"
  | "columns"
  | "divider"
  | "code"
  | "table"
  | "lead"
  | "summary"
  | "faq"
  | "cta"
  | "checklist"
  | "stats"
  | "myth"
  | "author"
  | "engage"
  | "golden"
  | "support";

export type LayoutModuleGroupId = "writing" | "express" | "layout" | "basic";

export interface LayoutModuleSnippet {
  id: string;
  title: string;
  hint: string;
  label: string;
  snippet: string;
  accent: string;
  icon: string;
  kind: LayoutModuleKind;
  group: LayoutModuleGroupId;
}

export const LAYOUT_MODULE_GROUPS: { id: LayoutModuleGroupId; label: string }[] = [
  { id: "writing", label: "写作结构" },
  { id: "express", label: "表达增强" },
  { id: "layout", label: "版式组件" },
  { id: "basic", label: "基础提示" },
];

export const LAYOUT_MODULE_SNIPPETS: LayoutModuleSnippet[] = [
  /* ── 写作结构：自媒体文章骨架 ── */
  {
    id: "lead",
    title: "开场钩子",
    hint: "抓住前 3 秒注意力",
    label: "开场钩子",
    accent: "#ea580c",
    icon: "🎣",
    kind: "lead",
    group: "writing",
    snippet: `:::lead[读者为什么要读下去？]\n如果你也遇到过……这篇把答案讲清楚。\n:::\n\n`,
  },
  {
    id: "summary",
    title: "本期要点",
    hint: "文首/文末快速摘要",
    label: "本期要点",
    accent: "#2563eb",
    icon: "📋",
    kind: "summary",
    group: "writing",
    snippet: `:::summary[本期要点]\n先记住这个结论\n再学会这个方法\n最后带走这个清单\n:::\n\n`,
  },
  {
    id: "faq",
    title: "问答 FAQ",
    hint: "预判读者常见问题",
    label: "问答 FAQ",
    accent: "#7c3aed",
    icon: "❓",
    kind: "faq",
    group: "writing",
    snippet: `:::faq[常见问题]\n这个问题值不值得做？ | 如果你关心效率和复利，值得。\n需要什么基础？ | 会用基础工具即可，正文有示例。\n多久能见效？ | 按步骤做，通常 1～2 周能看到反馈。\n:::\n\n`,
  },
  {
    id: "checklist",
    title: "行动清单",
    hint: "读完就能动手的 Todo",
    label: "行动清单",
    accent: "#059669",
    icon: "☑️",
    kind: "checklist",
    group: "writing",
    snippet: `:::checklist[读完马上做]\n复述本文一个核心观点\n挑一个方法今天试一次\n把结果记到笔记里\n:::\n\n`,
  },
  {
    id: "cta",
    title: "行动号召",
    hint: "文末引导关注/转发",
    label: "行动号召",
    accent: "#dc2626",
    icon: "🚀",
    kind: "cta",
    group: "writing",
    snippet: `:::cta[觉得有用？]\naction: 点个「在看」+ 转发给需要的人\ndesc: 我会持续分享可落地的写作与效率方法\n:::\n\n`,
  },
  {
    id: "author-note",
    title: "作者说",
    hint: "私人语气的编后语",
    label: "作者说",
    accent: "#78716c",
    icon: "✍️",
    kind: "author",
    group: "writing",
    snippet: `:::author-note[作者说]\nauthor: 狸知\n写这篇时我也卡过同一关——把过程留下来，是为了下次少绕路。\n:::\n\n`,
  },
  {
    id: "engage",
    title: "互动提问",
    hint: "拉高评论区回复",
    label: "互动提问",
    accent: "#0ea5e9",
    icon: "💬",
    kind: "engage",
    group: "writing",
    snippet: `:::engage[聊聊你的看法]\nquestion: 你最近在哪一步卡住了？\nhint: 留言聊聊，我挑共性问题下一篇拆解\n:::\n\n`,
  },
  {
    id: "support",
    title: "三连支持",
    hint: "点赞·转发·推荐水彩卡片",
    label: "三连支持",
    accent: "#E8919A",
    icon: "🐱",
    kind: "support",
    group: "writing",
    snippet: `:::support\ntitle: 喜欢就支持一下吧！\nsubtitle: 你的每一次互动，都是我持续创作的动力～\nbubble: 有你真好！\nthanks: 谢谢你\nlike-tag: 点赞\nlike-desc: 喜欢就点个赞吧！感谢你的支持！\nshare-tag: 转发\nshare-desc: 分享给更多朋友，让美好一起传递！\nrec-tag: 推荐\nrec-desc: 推荐给身边的人，让更多人看到！\n:::\n\n`,
  },

  /* ── 表达增强 ── */
  {
    id: "golden",
    title: "金句",
    hint: "适合截图传播的一句话",
    label: "金句",
    accent: "#a855f7",
    icon: "✦",
    kind: "golden",
    group: "express",
    snippet: `:::golden\nsource: 本文\n少即是多，清晰胜过复杂。\n:::\n\n`,
  },
  {
    id: "myth",
    title: "误区纠正",
    hint: "先破后立，记忆更深",
    label: "误区纠正",
    accent: "#e11d48",
    icon: "🧭",
    kind: "myth",
    group: "express",
    snippet: `:::myth[先澄清一个误区]\nmyth: 只要写得够多，自然会有读者\ntruth: 读者留下，是因为你稳定地解决他的具体问题\n:::\n\n`,
  },
  {
    id: "stats",
    title: "数据亮点",
    hint: "大数字制造记忆点",
    label: "数据亮点",
    accent: "#c026d3",
    icon: "📊",
    kind: "stats",
    group: "express",
    snippet: `:::stats[关键数字]\n3× | 效率提升 | 改造后\n80% | 可复用模板 | 减少重写\n15min | 日均投入 | 贵在坚持\n:::\n\n`,
  },
  {
    id: "highlight",
    title: "重点",
    hint: "突出核心观点",
    label: "重点 highlight",
    accent: "#7c3aed",
    icon: "✦",
    kind: "callout",
    group: "express",
    snippet: `:::highlight\ntitle: 核心观点\n在此输入强调内容\n:::\n\n`,
  },
  {
    id: "quote-card",
    title: "引用卡片",
    hint: "引言 + 作者署名",
    label: "引用卡片",
    accent: "#a855f7",
    icon: "❝",
    kind: "quote",
    group: "express",
    snippet: `:::quote-card\nbody: 引用正文\nauthor: 作者\n:::\n\n`,
  },

  /* ── 版式组件 ── */
  {
    id: "steps",
    title: "步骤",
    hint: "分步流程说明",
    label: "步骤 steps",
    accent: "#2563eb",
    icon: "①",
    kind: "steps",
    group: "layout",
    snippet: `:::steps\ntitle: 三步流程\n步骤一 | 说明\n步骤二 | 说明\n步骤三 | 说明\n:::\n\n`,
  },
  {
    id: "timeline",
    title: "时间线",
    hint: "按时间排列事件",
    label: "时间线 timeline",
    accent: "#0891b2",
    icon: "◷",
    kind: "timeline",
    group: "layout",
    snippet: `:::timeline\n2024-01 | 事件一\n2024-06 | 事件二\n:::\n\n`,
  },
  {
    id: "compare",
    title: "对比",
    hint: "左右两方案对照",
    label: "对比 compare",
    accent: "#ea580c",
    icon: "◫",
    kind: "compare",
    group: "layout",
    snippet: `:::compare[对比]\nleft-title: 方案A\nright-title: 方案B\n内容左 | 内容右\n:::\n\n`,
  },
  {
    id: "columns",
    title: "多列",
    hint: "并排多栏内容",
    label: "多列 columns",
    accent: "#475569",
    icon: "▦",
    kind: "columns",
    group: "layout",
    snippet: `:::columns\ntitle: 三列布局\n列一 | 列二 | 列三\n内容1 | 内容2 | 内容3\n:::\n\n`,
  },
  {
    id: "divider",
    title: "分隔线",
    hint: "章节之间的分隔",
    label: "分隔线 divider",
    accent: "#94a3b8",
    icon: "—",
    kind: "divider",
    group: "layout",
    snippet: `:::divider\n章节分隔\n:::\n\n`,
  },
  {
    id: "code-card",
    title: "代码卡片",
    hint: "带标题的代码块",
    label: "代码卡片",
    accent: "#0f172a",
    icon: "</>",
    kind: "code",
    group: "layout",
    snippet: `:::code-card\ntitle: 示例代码\ncaption: 说明文字\nshow-label: true\n\`\`\`javascript\nconst hello = 'world';\n\`\`\`\n:::\n\n`,
  },
  {
    id: "table-card",
    title: "表格卡片",
    hint: "数据表格展示",
    label: "表格卡片",
    accent: "#334155",
    icon: "⊞",
    kind: "table",
    group: "layout",
    snippet: `:::table-card\ntitle: 数据对比\n| 项目 | 数值 |\n| --- | --- |\n| A | 100 |\n| B | 200 |\n:::\n\n`,
  },

  /* ── 基础提示 ── */
  {
    id: "tip",
    title: "提示",
    hint: "温馨提示、补充说明",
    label: "提示 tip",
    accent: "#059669",
    icon: "💡",
    kind: "callout",
    group: "basic",
    snippet: `:::tip[提示]\n在此输入提示内容\n:::\n\n`,
  },
  {
    id: "note",
    title: "说明",
    hint: "备注与补充信息",
    label: "说明 note",
    accent: "#64748b",
    icon: "📌",
    kind: "callout",
    group: "basic",
    snippet: `:::note[说明]\ntitle: 标题\n正文内容\n:::\n\n`,
  },
  {
    id: "info",
    title: "信息",
    hint: "一般性说明",
    label: "信息 info",
    accent: "#0ea5e9",
    icon: "ℹ️",
    kind: "callout",
    group: "basic",
    snippet: `:::info[信息]\n补充说明内容\n:::\n\n`,
  },
  {
    id: "warning",
    title: "警告",
    hint: "需要注意的风险点",
    label: "警告 warning",
    accent: "#d97706",
    icon: "⚠️",
    kind: "callout",
    group: "basic",
    snippet: `:::warning[注意]\n在此输入警告内容\n:::\n\n`,
  },
  {
    id: "danger",
    title: "危险",
    hint: "严重警告或禁止操作",
    label: "危险 danger",
    accent: "#dc2626",
    icon: "🚨",
    kind: "callout",
    group: "basic",
    snippet: `:::danger[危险]\n请勿执行此操作\n:::\n\n`,
  },
  {
    id: "success",
    title: "成功",
    hint: "完成状态与正向反馈",
    label: "成功 success",
    accent: "#16a34a",
    icon: "✅",
    kind: "callout",
    group: "basic",
    snippet: `:::success[成功]\n操作已完成\n:::\n\n`,
  },
];

export function insertModuleSnippet(content: string, snippet: string): string {
  const trimmed = content.trimEnd();
  if (!trimmed) return snippet;
  return `${trimmed}\n\n${snippet}`;
}
