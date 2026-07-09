/** 公众号排版模块片段（插入编辑器） */
export const LAYOUT_MODULE_SNIPPETS: { label: string; snippet: string }[] = [
  { label: "提示 tip", snippet: `:::tip[提示]\n在此输入提示内容\n:::\n\n` },
  { label: "说明 note", snippet: `:::note[说明]\ntitle: 标题\n正文内容\n:::\n\n` },
  { label: "信息 info", snippet: `:::info[信息]\n补充说明内容\n:::\n\n` },
  { label: "警告 warning", snippet: `:::warning[注意]\n在此输入警告内容\n:::\n\n` },
  { label: "危险 danger", snippet: `:::danger[危险]\n请勿执行此操作\n:::\n\n` },
  { label: "成功 success", snippet: `:::success[成功]\n操作已完成\n:::\n\n` },
  { label: "重点 highlight", snippet: `:::highlight\ntitle: 核心观点\n在此输入强调内容\n:::\n\n` },
  { label: "引用卡片", snippet: `:::quote-card\nbody: 引用正文\nauthor: 作者\n:::\n\n` },
  { label: "步骤 steps", snippet: `:::steps\ntitle: 三步流程\n步骤一 | 说明\n步骤二 | 说明\n步骤三 | 说明\n:::\n\n` },
  { label: "时间线 timeline", snippet: `:::timeline\n2024-01 | 事件一\n2024-06 | 事件二\n:::\n\n` },
  { label: "对比 compare", snippet: `:::compare[对比]\nleft-title: 方案A\nright-title: 方案B\n内容左 | 内容右\n:::\n\n` },
  { label: "多列 columns", snippet: `:::columns\ntitle: 三列布局\n列一 | 列二 | 列三\n内容1 | 内容2 | 内容3\n:::\n\n` },
  { label: "分隔线 divider", snippet: `:::divider\n章节分隔\n:::\n\n` },
  {
    label: "代码卡片",
    snippet: `:::code-card\ntitle: 示例代码\ncaption: 说明文字\nshow-label: true\n\`\`\`javascript\nconst hello = 'world';\n\`\`\`\n:::\n\n`,
  },
  {
    label: "表格卡片",
    snippet: `:::table-card\ntitle: 数据对比\n| 项目 | 数值 |\n| --- | --- |\n| A | 100 |\n| B | 200 |\n:::\n\n`,
  },
];

export function insertModuleSnippet(content: string, snippet: string): string {
  const trimmed = content.trimEnd();
  if (!trimmed) return snippet;
  return `${trimmed}\n\n${snippet}`;
}
