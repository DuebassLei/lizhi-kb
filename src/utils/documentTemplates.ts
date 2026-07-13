/** 文档新建模板配置（用户可在设置中维护） */

export interface DocTemplateConfig {
  id: string;
  label: string;
  description: string;
  /** Markdown 骨架；`{{title}}` 会替换为文档标题 */
  content: string;
}

export const TEMPLATE_TITLE_PLACEHOLDER = "{{title}}";

export const DEFAULT_DOC_TEMPLATES: DocTemplateConfig[] = [
  {
    id: "blank",
    label: "空白",
    description: "仅标题",
    content: `# ${TEMPLATE_TITLE_PLACEHOLDER}\n\n`,
  },
  {
    id: "journal",
    label: "日记",
    description: "记录与反思",
    content: `# ${TEMPLATE_TITLE_PLACEHOLDER}\n\n## 今日记录\n\n- \n\n## 反思\n\n`,
  },
  {
    id: "tech",
    label: "技术笔记",
    description: "背景 / 方案 / 参考",
    content: `# ${TEMPLATE_TITLE_PLACEHOLDER}\n\n## 背景\n\n## 方案\n\n## 参考\n\n`,
  },
  {
    id: "wechat",
    label: "公众号",
    description: "导语 + 正文结构",
    content: `# ${TEMPLATE_TITLE_PLACEHOLDER}\n\n> 导语：一句话抓住读者。\n\n## 正文\n\n`,
  },
  {
    id: "meeting",
    label: "会议纪要",
    description: "议题 / 结论 / 待办（可在需求详情从关联文档创建需求）",
    content: `# ${TEMPLATE_TITLE_PLACEHOLDER}\n\n> 使用说明：在「待办事项」中填写「- [ ]」任务；保存后可在需求看板关联本文档并一键生成需求。\n\n## 基本信息\n\n- **时间**：\n- **地点**：\n- **参与人**：\n\n## 议题与结论\n\n### 议题一\n\n- **讨论要点**：\n- **结论**：\n\n## 待办事项\n\n- [ ] \n\n## 备注\n\n`,
  },
  {
    id: "requirement",
    label: "需求记录",
    description: "背景 / 描述 / 验收",
    content: `# ${TEMPLATE_TITLE_PLACEHOLDER}\n\n## 背景\n\n## 需求描述\n\n## 验收标准\n\n- [ ] \n\n## 关联与备注\n\n`,
  },
  {
    id: "essay",
    label: "随笔",
    description: "引子 / 正文 / 小结",
    content: `# ${TEMPLATE_TITLE_PLACEHOLDER}\n\n> 引子：从一个具体场景或问题切入。\n\n## 正文\n\n## 小结\n\n`,
  },
];

const ID_RE = /^[a-z][a-z0-9_-]{0,47}$/;

export function sanitizeTemplateId(raw: string, fallback = "custom"): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const id = slug || fallback;
  return ID_RE.test(id) ? id : fallback;
}

export function cloneDefaultTemplates(): DocTemplateConfig[] {
  return DEFAULT_DOC_TEMPLATES.map((item) => ({ ...item }));
}

/** 将内置模板中尚未存在的项追加到用户列表（不覆盖已有配置） */
export function mergeMissingDefaultTemplates(stored: DocTemplateConfig[]): DocTemplateConfig[] {
  const ids = new Set(stored.map((item) => item.id));
  const merged = stored.map((item) => ({ ...item }));
  for (const def of DEFAULT_DOC_TEMPLATES) {
    if (!ids.has(def.id)) merged.push({ ...def });
  }
  return merged;
}

export function normalizeTemplateList(raw: unknown): DocTemplateConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) return cloneDefaultTemplates();

  const seen = new Set<string>();
  const out: DocTemplateConfig[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<DocTemplateConfig>;
    const id = sanitizeTemplateId(String(row.id ?? ""), `template-${out.length + 1}`);
    if (seen.has(id)) continue;
    seen.add(id);

    const label = String(row.label ?? "未命名模板").trim() || "未命名模板";
    const description = String(row.description ?? "").trim();
    const content =
      typeof row.content === "string" && row.content.trim()
        ? row.content
        : `# ${TEMPLATE_TITLE_PLACEHOLDER}\n\n`;

    out.push({ id, label, description, content });
  }

  return out.length > 0 ? out : cloneDefaultTemplates();
}

export function buildTemplateContent(
  templates: DocTemplateConfig[],
  templateId: string,
  title: string,
): string {
  const template = templates.find((item) => item.id === templateId) ?? templates[0];
  if (!template) return `# ${title}\n\n`;
  return template.content.split(TEMPLATE_TITLE_PLACEHOLDER).join(title);
}

export function defaultTemplateId(templates: DocTemplateConfig[]): string {
  return templates.find((item) => item.id === "blank")?.id ?? templates[0]?.id ?? "blank";
}
