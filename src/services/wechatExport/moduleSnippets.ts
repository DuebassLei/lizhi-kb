/** 公众号排版模块片段（插入编辑器）+ 菜单迷你预览元数据 */

import { AI_PRIVATE_SNIPPET } from "../../utils/aiPrivacy";

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
  | "support"
  | "hero"
  | "card"
  | "path"
  | "chart"
  | "practical"
  | "privacy";

export type LayoutModuleGroupId =
  | "writing"
  | "express"
  | "layout"
  | "basic"
  | "opening"
  | "judgment"
  | "evidence"
  | "brand"
  | "extension"
  | "chart"
  | "practical"
  | "security";

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
  { id: "opening", label: "开篇封面" },
  { id: "writing", label: "写作结构" },
  { id: "express", label: "表达增强" },
  { id: "judgment", label: "观点判断" },
  { id: "chart", label: "图表" },
  { id: "practical", label: "实用增强" },
  { id: "layout", label: "版式组件" },
  { id: "evidence", label: "证据图文" },
  { id: "brand", label: "品牌作者" },
  { id: "extension", label: "排版扩展" },
  { id: "basic", label: "基础提示" },
  { id: "security", label: "安全" },
];

export const LAYOUT_MODULE_SNIPPETS: LayoutModuleSnippet[] = [
  {
    id: "ai-private",
    title: "隐藏信息",
    hint: "账号密码等；预览提示、导出删除、不进 AI",
    label: "隐藏信息",
    accent: "#64748b",
    icon: "🔒",
    kind: "privacy",
    group: "security",
    snippet: AI_PRIVATE_SNIPPET,
  },
  /* ── 开篇封面 ── */
  {
    id: "hero",
    title: "封面 Hero",
    hint: "标签 + 主标题 + 副标题 + chips",
    label: "封面 Hero",
    accent: "#ea580c",
    icon: "▣",
    kind: "hero",
    group: "opening",
    snippet: `:::hero
eyebrow: TOOL · 知识库
title: 狸知知识库：把双链和加密装进同一个猫窝
subtitle: 本地优先、端到端加密；双链图谱与零网络默认，装进同一个桌面应用
chips: 狸知|Tauri|双链笔记|本地加密
:::

`,
  },
  {
    id: "title-da01",
    title: "标题卡 DA01",
    hint: "经典标题 + 阅读时长",
    label: "标题卡",
    accent: "#2563eb",
    icon: "▤",
    kind: "hero",
    group: "opening",
    snippet: `:::title-da01
badge: GUIDE
title: 文章主标题
subtitle: 一句话副标题
chips: 标签一|标签二
:::

`,
  },
  {
    id: "cards",
    title: "要点卡片",
    hint: "竖向多卡片要点预览",
    label: "要点卡片",
    accent: "#7c3aed",
    icon: "▦",
    kind: "card",
    group: "opening",
    snippet: `:::cards
双链成网 | Wiki + 图谱 | 补全、反向链接、局部力导向图
本地加密 | 端到端 | 密钥不出本地，默认零网络
桌面一体 | Tauri 壳 | 编辑、图谱、导出装进同一应用
:::

`,
  },
  {
    id: "label-title",
    title: "标签标题",
    hint: "带 eyebrow 的章节标题",
    label: "标签标题",
    accent: "#0891b2",
    icon: "≡",
    kind: "lead",
    group: "opening",
    snippet: `:::label-title
eyebrow: CHAPTER
title: 章节标签标题
subtitle: 副标题说明
:::

`,
  },
  {
    id: "part",
    title: "分篇标识",
    hint: "系列连载分篇",
    label: "分篇",
    accent: "#64748b",
    icon: "◉",
    kind: "divider",
    group: "opening",
    snippet: `:::part
num: 02
title: 系列第二篇
subtitle: 连载 / 分篇标识
:::

`,
  },
  {
    id: "toc",
    title: "目录导航",
    hint: "文内章节目录",
    label: "目录",
    accent: "#0ea5e9",
    icon: "☰",
    kind: "summary",
    group: "opening",
    snippet: `:::toc
开篇导读 | 为什么值得读
核心观点 | 三个关键判断
行动建议 | 读完怎么做
:::

`,
  },

  /* ── 写作结构 ── */
  {
    id: "lead",
    title: "开场钩子",
    hint: "抓住前 3 秒注意力",
    label: "开场钩子",
    accent: "#ea580c",
    icon: "🎣",
    kind: "lead",
    group: "writing",
    snippet: `:::lead[读者为什么要读下去？]
如果你也遇到过……这篇把答案讲清楚。
:::

`,
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
    snippet: `:::summary[本期要点]
先记住这个结论
再学会这个方法
最后带走这个清单
:::

`,
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
    snippet: `:::faq[常见问题]
这个问题值不值得做？ | 如果你关心效率和复利，值得。
需要什么基础？ | 会用基础工具即可，正文有示例。
多久能见效？ | 按步骤做，通常 1～2 周能看到反馈。
:::

`,
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
    snippet: `:::checklist[读完马上做]
复述本文一个核心观点
挑一个方法今天试一次
把结果记到笔记里
:::

`,
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
    snippet: `:::cta[觉得有用？]
action: 点个「在看」+ 转发给需要的人
desc: 我会持续分享可落地的写作与效率方法
:::

`,
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
    snippet: `:::author-note[作者说]
author: 狸知
写这篇时我也卡过同一关——把过程留下来，是为了下次少绕路。
:::

`,
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
    snippet: `:::engage[聊聊你的看法]
question: 你最近在哪一步卡住了？
hint: 留言聊聊，我挑共性问题下一篇拆解
:::

`,
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
    snippet: `:::support
title: 喜欢就支持一下吧！
subtitle: 你的每一次互动，都是我持续创作的动力～
bubble: 有你真好！
thanks: 谢谢你
like-tag: 点赞
like-desc: 喜欢就点个赞吧！感谢你的支持！
share-tag: 转发
share-desc: 分享给更多朋友，让美好一起传递！
rec-tag: 推荐
rec-desc: 推荐给身边的人，让更多人看到！
:::

`,
  },
  {
    id: "subscribe",
    title: "订阅引导",
    hint: "关注/订阅号召",
    label: "订阅",
    accent: "#db2777",
    icon: "☆",
    kind: "cta",
    group: "writing",
    snippet: `:::subscribe
label: 订阅
title: 不错过下一篇
subtitle: 持续分享可落地的方法
primary: 继续关注
secondary: 收藏这篇
:::

`,
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
    snippet: `:::golden
source: 本文
少即是多，清晰胜过复杂。
:::

`,
  },
  {
    id: "statement",
    title: "居中强调",
    hint: "核心观点居中强调",
    label: "强调语",
    accent: "#7c3aed",
    icon: "〃",
    kind: "golden",
    group: "express",
    snippet: `:::statement
这是一段居中的金句强调，适合核心观点。
:::

`,
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
    snippet: `:::myth[先澄清一个误区]
myth: 只要写得够多，自然会有读者
truth: 读者留下，是因为你稳定地解决他的具体问题
:::

`,
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
    snippet: `:::stats[关键数字]
3× | 效率提升 | 改造后
80% | 可复用模板 | 减少重写
15min | 日均投入 | 贵在坚持
:::

`,
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
    snippet: `:::highlight
title: 核心观点
在此输入强调内容
:::

`,
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
    snippet: `:::quote-card
body: 引用正文
author: 作者
:::

`,
  },
  {
    id: "tweet",
    title: "推文卡",
    hint: "社交媒体引用样式",
    label: "推文",
    accent: "#0f172a",
    icon: "𝕏",
    kind: "quote",
    group: "express",
    snippet: `:::tweet
author: @lizhi
text: 排版不是装饰，而是让读者更快抓住结构。
:::

`,
  },

  /* ── 观点判断 ── */
  {
    id: "verdict",
    title: "最终判断",
    hint: "作者立场与结论",
    label: "判断",
    accent: "#dc2626",
    icon: "⚖",
    kind: "callout",
    group: "judgment",
    snippet: `:::verdict
eyebrow: 最终判断
title: 核心结论
body: 用一两句话给出你的判断与立场。
:::

`,
  },
  {
    id: "manifesto",
    title: "宣言",
    hint: "品牌/观点宣言块",
    label: "宣言",
    accent: "#7c3aed",
    icon: "⚑",
    kind: "callout",
    group: "judgment",
    snippet: `:::manifesto
eyebrow: 宣言
title: 我们相信什么
body: 用简洁有力的句子表达品牌立场。
:::

`,
  },
  {
    id: "bridge",
    title: "过渡桥接",
    hint: "章节间承上启下",
    label: "过渡",
    accent: "#0891b2",
    icon: "↝",
    kind: "lead",
    group: "judgment",
    snippet: `:::bridge
eyebrow: 过渡
title: 接下来我们看
body: 承上启下，把读者带入下一节。
:::

`,
  },
  {
    id: "audience-fit",
    title: "读者适配",
    hint: "说明适合谁读",
    label: "读者适配",
    accent: "#059669",
    icon: "◎",
    kind: "compare",
    group: "judgment",
    snippet: `:::audience-fit
title: 这篇适合谁
fit: 想做双链笔记的人|关心本地加密的人
avoid: 只想要纯云端协作的人
:::

`,
  },
  {
    id: "myth-fact",
    title: "误区 vs 事实",
    hint: "对照澄清",
    label: "误区事实",
    accent: "#e11d48",
    icon: "⇄",
    kind: "myth",
    group: "judgment",
    snippet: `:::myth-fact
误区：排版越花哨越好 | 事实：结构清晰比装饰更重要
:::

`,
  },
  {
    id: "definition",
    title: "术语定义",
    hint: "概念解释卡",
    label: "术语",
    accent: "#475569",
    icon: "◇",
    kind: "callout",
    group: "judgment",
    snippet: `:::definition
term: 双链
def: 文档之间通过 WikiLink 互相引用，形成知识网络。
:::

`,
  },
  {
    id: "infographic",
    title: "信息图",
    hint: "结构化信息图块",
    label: "信息图",
    accent: "#2563eb",
    icon: "◈",
    kind: "stats",
    group: "judgment",
    snippet: `:::infographic
type: flow
eyebrow: FLOW
title: 一条清晰路径
flow: 收集|整理|连接|回顾
:::

`,
  },

  /* ── 图表（CSS，可复制到微信） ── */
  {
    id: "bar-chart",
    title: "横向条形图",
    hint: "标签 | 数值",
    label: "条形图",
    accent: "#ea580c",
    icon: "▬",
    kind: "chart",
    group: "chart",
    snippet: `:::bar-chart[阅读来源]
搜索 | 42
朋友圈 | 28
订阅号 | 18
其他 | 12
:::

`,
  },
  {
    id: "column-chart",
    title: "柱状图",
    hint: "纵向对比数值",
    label: "柱状图",
    accent: "#2563eb",
    icon: "▮",
    kind: "chart",
    group: "chart",
    snippet: `:::column-chart[近四周阅读]
第1周 | 1200
第2周 | 1580
第3周 | 1420
第4周 | 2100
:::

`,
  },
  {
    id: "progress",
    title: "进度条",
    hint: "标签 | 0–100",
    label: "进度条",
    accent: "#059669",
    icon: "═",
    kind: "chart",
    group: "chart",
    snippet: `:::progress[完成度]
选题 | 100
初稿 | 70
排版 | 40
发布 | 10
:::

`,
  },
  {
    id: "donut",
    title: "环形占比",
    hint: "标签 | 占比",
    label: "环形图",
    accent: "#7c3aed",
    icon: "◯",
    kind: "chart",
    group: "chart",
    snippet: `:::donut[读者构成]
center: 100%
核心读者 | 55
路过读者 | 30
新粉 | 15
:::

`,
  },
  {
    id: "line-chart",
    title: "折线趋势",
    hint: "点名 | 数值 + 趋势摘要",
    label: "折线图",
    accent: "#0891b2",
    icon: "╱",
    kind: "chart",
    group: "chart",
    snippet: `:::line-chart[完读率趋势]
1月 | 48
2月 | 52
3月 | 57
4月 | 61
:::

`,
  },
  {
    id: "radar-chart",
    title: "多维度雷达",
    hint: "单系列或多系列对比",
    label: "雷达图",
    accent: "#db2777",
    icon: "◈",
    kind: "chart",
    group: "chart",
    snippet: `:::radar-chart[能力对比]
维度 | 狸知 | 竞品
安全 | 95 | 70
双链 | 90 | 60
导出 | 80 | 85
本地优先 | 98 | 55
写作辅助 | 75 | 80
:::

`,
  },
  {
    id: "stack-bar",
    title: "堆叠条",
    hint: "分段名 | 数值",
    label: "堆叠条",
    accent: "#d97706",
    icon: "▭",
    kind: "chart",
    group: "chart",
    snippet: `:::stack-bar[流量构成]
自然搜索 | 40
社交转发 | 25
订阅打开 | 20
其他 | 15
:::

`,
  },
  {
    id: "heatmap",
    title: "热力表",
    hint: "表头 + 数据行，色深表大小",
    label: "热力表",
    accent: "#ea580c",
    icon: "▦",
    kind: "chart",
    group: "chart",
    snippet: `:::heatmap[活跃时段]
时段 | 一 | 二 | 三 | 四 | 五
上午 | 2 | 5 | 8 | 6 | 3
下午 | 4 | 7 | 9 | 8 | 5
晚上 | 6 | 8 | 10 | 9 | 7
:::

`,
  },
  {
    id: "grouped-bar",
    title: "分组柱状",
    hint: "类别 | 系列A | 系列B",
    label: "分组柱",
    accent: "#2563eb",
    icon: "▥",
    kind: "chart",
    group: "chart",
    snippet: `:::grouped-bar[阅读对比]
类别 | 本月 | 上月
推文A | 1200 | 900
推文B | 800 | 1100
推文C | 1500 | 1300
:::

`,
  },
  {
    id: "waterfall",
    title: "瀑布增减",
    hint: "项目 | 增减值",
    label: "瀑布图",
    accent: "#059669",
    icon: "〰",
    kind: "chart",
    group: "chart",
    snippet: `:::waterfall[完读贡献]
start: 100
选题优化 | 20
标题改写 | 15
配图增强 | -5
文末 CTA | 10
:::

`,
  },

  /* ── 实用增强 ── */
  {
    id: "before-after",
    title: "前后对比",
    hint: "改造前 | 改造后",
    label: "前后对比",
    accent: "#ea580c",
    icon: "⇄",
    kind: "compare",
    group: "practical",
    snippet: `:::before-after[体验对比]
before-label: 之前
after-label: 之后
排版靠手工调 | 一键插入模块
样式难统一 | 主题色自动对齐
复制常丢格式 | 微信兼容内联样式
:::

`,
  },
  {
    id: "pros-cons",
    title: "优缺点",
    hint: "优点 | 缺点 双列",
    label: "优缺点",
    accent: "#16a34a",
    icon: "±",
    kind: "compare",
    group: "practical",
    snippet: `:::pros-cons[方案评估]
本地加密、可离线 | 不能实时多人协作
双链图谱清晰 | 学习成本略高
导出友好 | 移动端能力有限
:::

`,
  },
  {
    id: "number-callout",
    title: "大数字结论",
    hint: "单点冲击数字 + 说明",
    label: "大数字",
    accent: "#db2777",
    icon: "＃",
    kind: "stats",
    group: "practical",
    snippet: `:::number-callout
value: 3×
label: 完读率提升
note: 改版后 4 周相对基线的中位数
:::

`,
  },
  {
    id: "quote-thread",
    title: "对话访谈",
    hint: "角色 | 内容",
    label: "对话",
    accent: "#7c3aed",
    icon: "💬",
    kind: "quote",
    group: "practical",
    snippet: `:::quote-thread[用户访谈]
采访 | 你为什么选本地优先？
用户 | 公司资料不能上云，但我仍要双链。
采访 | 加密会不会太麻烦？
用户 | 解锁一次就好，比丢文件安心。
:::

`,
  },
  {
    id: "checklist-done",
    title: "完成/待办",
    hint: "[x] 完成 · [ ] 待办",
    label: "双态清单",
    accent: "#059669",
    icon: "☑",
    kind: "checklist",
    group: "practical",
    snippet: `:::checklist-done[本周复盘]
[x] 定题与大纲
[x] 初稿完成
[ ] 配图与排版
[ ] 发布与复盘
:::

`,
  },
  {
    id: "footnote-box",
    title: "文末备注",
    hint: "免责声明 / 引用出处",
    label: "备注",
    accent: "#64748b",
    icon: "※",
    kind: "callout",
    group: "practical",
    snippet: `:::footnote-box[备注]
本文示例数据仅供演示；实际效果因主题与读者环境略有差异。
引用请标注出处，欢迎转载并保留署名。
:::

`,
  },
  {
    id: "chapter-nav",
    title: "章节导读",
    hint: "手动章节目录",
    label: "章节导读",
    accent: "#0ea5e9",
    icon: "☰",
    kind: "summary",
    group: "practical",
    snippet: `:::chapter-nav[本章导读]
01 | 问题从哪来 | 为什么旧流程拖慢写作
02 | 怎么改 | 三个可落地的改法
03 | 效果如何 | 数据和反馈
:::

`,
  },
  {
    id: "key-takeaway",
    title: "读完带走",
    hint: "一句话结论框",
    label: "带走结论",
    accent: "#ea580c",
    icon: "★",
    kind: "golden",
    group: "practical",
    snippet: `:::key-takeaway
label: 读完带走
少改工具，多改结构：把「可复制的模块」变成写作肌肉记忆。
:::

`,
  },
  {
    id: "alert-banner",
    title: "通知条",
    hint: "活动/版本/截止提醒",
    label: "通知条",
    accent: "#d97706",
    icon: "!",
    kind: "callout",
    group: "practical",
    snippet: `:::alert-banner
tone: warn
title: 注意
正文：本周五 24:00 截止征集，逾期不再收录。
:::

`,
  },
  {
    id: "score-card",
    title: "评分卡",
    hint: "总分 + 分项进度",
    label: "评分卡",
    accent: "#7c3aed",
    icon: "◎",
    kind: "stats",
    group: "practical",
    snippet: `:::score-card
title: 综合评分
score: 8.6
max: 10
verdict: 值得入手，适合本地知识工作者
安全 | 9.5
双链 | 9.0
导出 | 8.0
上手 | 7.5
:::

`,
  },
  {
    id: "recipe-meta",
    title: "信息条",
    hint: "难度 / 耗时 / 工具",
    label: "信息条",
    accent: "#0891b2",
    icon: "ⓘ",
    kind: "card",
    group: "practical",
    snippet: `:::recipe-meta
difficulty: 入门
time: 15 分钟
tools: 狸知 · 公众号工作室
audience: 想提升排版效率的作者
:::

`,
  },
  {
    id: "image-caption",
    title: "配图图注",
    hint: "图片 + 强制图注",
    label: "图注",
    accent: "#475569",
    icon: "🖼",
    kind: "card",
    group: "practical",
    snippet: `:::image-caption
image: https://picsum.photos/800/400
caption: 图：公众号工作室分栏预览示意
alt: 工作室界面截图
:::

`,
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
    snippet: `:::steps
title: 三步流程
步骤一 | 说明
步骤二 | 说明
步骤三 | 说明
:::

`,
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
    snippet: `:::timeline
2024-01 | 事件一
2024-06 | 事件二
:::

`,
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
    snippet: `:::compare[对比]
left-title: 方案A
right-title: 方案B
内容左 | 内容右
:::

`,
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
    snippet: `:::columns
title: 三列布局
列一 | 列二 | 列三
内容1 | 内容2 | 内容3
:::

`,
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
    snippet: `:::divider
章节分隔
:::

`,
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
    snippet: `:::code-card
title: 示例代码
caption: 说明文字
show-label: true
\`\`\`javascript
const hello = 'world';
\`\`\`
:::

`,
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
    snippet: `:::table-card
title: 数据对比
| 项目 | 数值 |
| --- | --- |
| A | 100 |
| B | 200 |
:::

`,
  },
  {
    id: "pricing",
    title: "价格方案",
    hint: "套餐/定价对比",
    label: "定价",
    accent: "#db2777",
    icon: "¥",
    kind: "card",
    group: "layout",
    snippet: `:::pricing
基础版 | 免费 | 核心排版
专业版 | ¥99/月 | 全部主题与模块
:::

`,
  },
  {
    id: "comparison-table",
    title: "对比表",
    hint: "多列功能对比",
    label: "对比表",
    accent: "#334155",
    icon: "⊞",
    kind: "table",
    group: "layout",
    snippet: `:::comparison-table
功能 | 方案A | 方案B
双链 | ✓ | ✓
加密 | ✓ | —
:::

`,
  },
  {
    id: "stat-row",
    title: "数据条",
    hint: "横向关键数据",
    label: "数据条",
    accent: "#c026d3",
    icon: "▦",
    kind: "stats",
    group: "layout",
    snippet: `:::stat-row
12.8万 | 阅读量
68% | 完读率
2400 | 转发
:::

`,
  },
  {
    id: "specs",
    title: "规格参数",
    hint: "键值规格表",
    label: "规格",
    accent: "#475569",
    icon: "☰",
    kind: "table",
    group: "layout",
    snippet: `:::specs
平台 | Windows / macOS
加密 | AES-256
默认网络 | 零出站
:::

`,
  },
  {
    id: "changelog",
    title: "更新日志",
    hint: "版本变更记录",
    label: "更新日志",
    accent: "#0891b2",
    icon: "◷",
    kind: "timeline",
    group: "layout",
    snippet: `:::changelog
2026-07 | v1.2 | 新增排版模块
2026-06 | v1.1 | 主题预览增强
:::

`,
  },

  /* ── 证据图文 ── */
  {
    id: "image-text",
    title: "图文",
    hint: "图 + 说明文字",
    label: "图文",
    accent: "#2563eb",
    icon: "🖼",
    kind: "card",
    group: "evidence",
    snippet: `:::image-text
title: 配图说明
body: 在此写图注与要点。
image: https://picsum.photos/800/400
:::

`,
  },
  {
    id: "image-compare",
    title: "图片对比",
    hint: "前后/左右图对比",
    label: "图对比",
    accent: "#ea580c",
    icon: "◫",
    kind: "compare",
    group: "evidence",
    snippet: `:::image-compare
title: 前后对比
before: https://picsum.photos/600/300?random=1
after: https://picsum.photos/600/300?random=2
:::

`,
  },
  {
    id: "image-steps",
    title: "步骤截图",
    hint: "分步截图说明",
    label: "步骤图",
    accent: "#0891b2",
    icon: "①",
    kind: "steps",
    group: "evidence",
    snippet: `:::image-steps
打开设置 | https://picsum.photos/600/300?random=3 | 进入偏好
选择主题 | https://picsum.photos/600/300?random=4 | 切换预览
:::

`,
  },
  {
    id: "image-annotate",
    title: "标注图",
    hint: "带标注点的配图",
    label: "标注图",
    accent: "#7c3aed",
    icon: "◎",
    kind: "card",
    group: "evidence",
    snippet: `:::image-annotate
title: 界面标注
image: https://picsum.photos/800/400?random=5
points: 侧栏|编辑区|预览
:::

`,
  },
  {
    id: "gallery",
    title: "图库",
    hint: "多图横向并排",
    label: "图库",
    accent: "#64748b",
    icon: "▣",
    kind: "card",
    group: "evidence",
    snippet: `:::gallery
![图1](https://picsum.photos/400/200?random=1) ![图2](https://picsum.photos/400/200?random=2)
:::

`,
  },
  {
    id: "quote",
    title: "引用",
    hint: "人物/文献引用",
    label: "引用",
    accent: "#a855f7",
    icon: "❝",
    kind: "quote",
    group: "evidence",
    snippet: `:::quote
quote: 排版不是装饰，而是让读者更快抓住结构。
source: 墨韵简排
:::

`,
  },
  {
    id: "resource-list",
    title: "资源列表",
    hint: "链接/资料清单",
    label: "资源",
    accent: "#0ea5e9",
    icon: "⛓",
    kind: "summary",
    group: "evidence",
    snippet: `:::resource-list
官方文档 | 快速上手与 API
社区模板 | 可复用排版骨架
:::

`,
  },
  {
    id: "toolbox",
    title: "工具箱",
    hint: "推荐工具列表",
    label: "工具箱",
    accent: "#059669",
    icon: "⚒",
    kind: "summary",
    group: "evidence",
    snippet: `:::toolbox
编辑 | CodeMirror | Markdown 源码编辑
图谱 | SVG | 局部力导向
:::

`,
  },
  {
    id: "cases",
    title: "案例展示",
    hint: "客户/项目案例卡",
    label: "案例",
    accent: "#db2777",
    icon: "★",
    kind: "card",
    group: "evidence",
    snippet: `:::cases
个人知识库 | 三周效率翻倍 | 用双链串起周报与项目笔记
团队归档 | 加密合规 | 本地 vault 满足不出网要求
:::

`,
  },

  /* ── 品牌作者 ── */
  {
    id: "author-card",
    title: "作者卡",
    hint: "作者介绍与关注",
    label: "作者卡",
    accent: "#78716c",
    icon: "☺",
    kind: "author",
    group: "brand",
    snippet: `:::author-card
name: 狸知
role: 产品作者
bio: 做本地优先的加密知识库。
tags: 双链|加密|桌面
:::

`,
  },
  {
    id: "people",
    title: "人物卡",
    hint: "多人物介绍",
    label: "人物",
    accent: "#64748b",
    icon: "👥",
    kind: "author",
    group: "brand",
    snippet: `:::people
张三 | 产品负责人 | 负责选题与结构
李四 | 主笔 | 负责正文与排版
:::

`,
  },
  {
    id: "series",
    title: "系列专栏",
    hint: "连载入口",
    label: "专栏",
    accent: "#7c3aed",
    icon: "▤",
    kind: "cta",
    group: "brand",
    snippet: `:::series
label: 系列专栏
title: 狸知写作手册
body: 从选题到排版的完整路径。
link: 查看全部
:::

`,
  },
  {
    id: "logos",
    title: "Logo 墙",
    hint: "合作方/客户名",
    label: "Logo墙",
    accent: "#94a3b8",
    icon: "▣",
    kind: "columns",
    group: "brand",
    snippet: `:::logos
合作方 A
合作方 B
合作方 C
:::

`,
  },
  {
    id: "notice",
    title: "公告提示",
    hint: "重要通知/免责",
    label: "公告",
    accent: "#d97706",
    icon: "!",
    kind: "callout",
    group: "brand",
    snippet: `:::notice
title: 重要提示
body: 本文示例仅供参考，请以实际产品为准。
:::

`,
  },

  /* ── 排版扩展 ── */
  {
    id: "reading-path",
    title: "阅读路线",
    hint: "根据 p-title 自动生成导航",
    label: "阅读路线",
    accent: "#ea580c",
    icon: "⇢",
    kind: "path",
    group: "extension",
    snippet: `:::reading-path
:::

`,
  },
  {
    id: "p-title",
    title: "段落标题",
    hint: "带编号的章节标题",
    label: "段落标题",
    accent: "#2563eb",
    icon: "§",
    kind: "lead",
    group: "extension",
    snippet: `:::p-title
num: 01
title: 章节标题
subtitle: SECTION · 副标题
level: 1
:::

`,
  },
  {
    id: "badges",
    title: "徽章行",
    hint: "标签徽章组",
    label: "徽章",
    accent: "#0ea5e9",
    icon: "🏷",
    kind: "columns",
    group: "extension",
    snippet: `:::badges tone="accent"
Vue|TypeScript|公众号排版
:::

`,
  },
  {
    id: "breaking",
    title: "分隔强调",
    hint: "突发/更新摘要卡",
    label: "突发卡",
    accent: "#dc2626",
    icon: "⚡",
    kind: "callout",
    group: "extension",
    snippet: `:::breaking
badge: NEW
title: 突发摘要标题
subtitle: 一句话说明背景
chips: 高效|美观
正文摘要段落，适合快讯或更新说明。
:::

`,
  },
  {
    id: "case-flow",
    title: "案例流程",
    hint: "案例步骤流",
    label: "案例流",
    accent: "#e11d48",
    icon: "→",
    kind: "steps",
    group: "extension",
    snippet: `:::case-flow
- [案例 01] 标题：详细说明与结果
- [案例 02] 标题：详细说明与结果
:::

`,
  },
  {
    id: "question",
    title: "提问块",
    hint: "向读者抛出问题",
    label: "提问",
    accent: "#0ea5e9",
    icon: "?",
    kind: "engage",
    group: "extension",
    snippet: `:::question
question: 你更在意加密，还是双链体验？
:::

`,
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
    snippet: `:::tip[提示]
在此输入提示内容
:::

`,
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
    snippet: `:::note[说明]
title: 标题
正文内容
:::

`,
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
    snippet: `:::info[信息]
补充说明内容
:::

`,
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
    snippet: `:::warning[注意]
在此输入警告内容
:::

`,
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
    snippet: `:::danger[危险]
请勿执行此操作
:::

`,
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
    snippet: `:::success[成功]
操作已完成
:::

`,
  },
];

export function insertModuleSnippet(content: string, snippet: string): string {
  const trimmed = content.trimEnd();
  if (!trimmed) return snippet;
  return `${trimmed}\n\n${snippet}`;
}
