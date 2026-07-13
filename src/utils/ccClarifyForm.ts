export interface LizhiClarifyOption {
  value: string;
  label: string;
}

export interface LizhiClarifyField {
  id: string;
  label: string;
  type: "select" | "text" | "textarea";
  required?: boolean;
  options?: LizhiClarifyOption[];
  placeholder?: string;
  default?: string;
}

export interface LizhiClarifyForm {
  title?: string;
  fields: LizhiClarifyField[];
}

const CLARIFY_BLOCK_RE = /```lizhi-clarify\s*\n([\s\S]*?)\n```/i;

/** guizang-ppt 澄清项（Agent 未输出结构化块时的 fallback，与 agent lizhi-clarify 模板一致） */
export const GUIZANG_PPT_CLARIFY_DEFAULT: LizhiClarifyForm = {
  title: "请补充以下信息，以便生成 PPT",
  fields: [
    {
      id: "style",
      label: "视觉风格",
      type: "select",
      required: true,
      options: [
        { value: "A · 电子杂志 × 电子墨水", label: "A · 电子杂志 × 电子墨水（衬线 + 流体背景）" },
        { value: "B · 瑞士国际主义", label: "B · 瑞士国际主义（无衬线 + 网格点阵）" },
      ],
    },
    {
      id: "audience",
      label: "受众与场景",
      type: "select",
      required: true,
      options: [
        { value: "行业内部 / 技术分享", label: "行业内部 / 技术分享" },
        { value: "商业发布 / 产品发布会", label: "商业发布 / 产品发布会" },
        { value: "demo day / 路演", label: "demo day / 路演" },
        { value: "私享会 / 线下分享", label: "私享会 / 线下分享" },
        { value: "其他", label: "其他（下方补充）" },
      ],
    },
    {
      id: "audience_detail",
      label: "场景补充",
      type: "text",
      placeholder: "例如：AI 创业者闭门分享",
      required: false,
    },
    {
      id: "duration",
      label: "时长 / 页数",
      type: "select",
      required: true,
      options: [
        { value: "15 分钟（约 10 页）", label: "15 分钟（约 10 页）" },
        { value: "30 分钟（约 20 页）", label: "30 分钟（约 20 页）" },
        { value: "45 分钟（约 25–30 页）", label: "45 分钟（约 25–30 页）" },
        { value: "更长", label: "更长（下方说明）" },
      ],
    },
    {
      id: "duration_detail",
      label: "时长补充",
      type: "text",
      placeholder: "若选更长，请说明目标页数",
      required: false,
    },
    {
      id: "materials",
      label: "原始素材",
      type: "textarea",
      placeholder: "文档、数据、旧 PPT、文章链接…没有可留空，我帮你搭大纲",
      required: false,
    },
    {
      id: "images",
      label: "图片 / 截图",
      type: "textarea",
      placeholder: "有无图片？截图处理方式（保真展示 / 美化 / 再设计）？文件路径？",
      required: false,
    },
    {
      id: "theme",
      label: "主题色",
      type: "select",
      required: true,
      options: [
        { value: "A·墨水经典", label: "A·墨水经典（杂志默认）" },
        { value: "A·靛蓝瓷", label: "A·靛蓝瓷（科技 / 研究）" },
        { value: "A·森林墨", label: "A·森林墨（自然 / 文化）" },
        { value: "A·牛皮纸", label: "A·牛皮纸（人文 / 怀旧）" },
        { value: "A·沙丘", label: "A·沙丘（艺术 / 设计）" },
        { value: "B·克莱因蓝 IKB", label: "B·克莱因蓝 IKB（瑞士默认）" },
        { value: "B·柠檬黄", label: "B·柠檬黄（活力 / 零售）" },
        { value: "B·柠檬绿", label: "B·柠檬绿（生态 / 新兴科技）" },
        { value: "B·安全橙", label: "B·安全橙（警示 / 高能量）" },
      ],
    },
    {
      id: "constraints",
      label: "硬约束",
      type: "textarea",
      placeholder: "必须包含的数据、不能出现的内容、品牌要求…",
      required: false,
    },
  ],
};

function isValidForm(raw: unknown): raw is LizhiClarifyForm {
  if (!raw || typeof raw !== "object") return false;
  const form = raw as LizhiClarifyForm;
  return Array.isArray(form.fields) && form.fields.every((f) => f.id && f.label && f.type);
}

export function parseClarifyBlock(content: string): LizhiClarifyForm | null {
  const match = content.match(CLARIFY_BLOCK_RE);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as unknown;
    return isValidForm(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function stripClarifyBlock(content: string): string {
  return content.replace(CLARIFY_BLOCK_RE, "").trim();
}

/** 带标签与选项的行，如 `1. **技术栈**：A) foo · B) bar` */
const CHOICE_QUESTION_LINE_RE =
  /^\s*(?:\d+\.\s*)?(?:[-*+]\s*)?\*{0,2}(.+?)\*{0,2}\s*[：:]\s*(.+)$/;

/** 分段选项标题，如 `方向 A：真·多智能体协作` */
const DIRECTION_SECTION_RE =
  /^\s*(?:#{1,4}\s+)?(?:\*{0,2})?(?:方向|选项|方案|选择)\s*([A-Z])[：:]\s*(.+?)(?:\*{0,2})?\s*$/u;

/** 行首字母选项，如 `A) 标题` */
const LETTER_PAREN_LINE_RE =
  /^\s*(?:#{1,4}\s+)?(?:\*{0,2})?([A-Z])\)\s*(.+?)(?:\*{0,2})?\s*$/u;

/** 选项行尾部的「请直接填写…」类引导语 */
const CHOICE_INSTRUCTION_TAIL_RE =
  /^(?:请(?:直接)?(?:填写|选择|确认|补充)|可以直接说|或者(?:直接)?说)/;

/** 分段选项末尾的引导语（保留正文，仅去掉重复提问） */
const SECTION_CHOICE_PROMPT_RE =
  /^(?:你倾向|选一个我就|请.*选一个|如果你拿不准|也可以组合)/;

function slugifyFieldId(label: string, index: number): string {
  const slug = label
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u4e00-\u9fff-]/g, "")
    .slice(0, 32);
  return slug || `field_${index + 1}`;
}

/** 从 `A) foo · B) bar` 片段解析选项列表 */
export function parseChoiceOptions(optionsText: string): LizhiClarifyOption[] {
  const trimmed = optionsText.trim();
  if (!trimmed) return [];

  const parts = trimmed
    .split(/\s*[·|/、]\s*(?=[A-Z][)）\.、·])|\s+(?=[A-Z][)）\.、·])/)
    .map((p) => p.trim())
    .filter(Boolean);

  const options: LizhiClarifyOption[] = [];
  for (const part of parts) {
    const match = part.match(/^([A-Z])[)）\.、·]\s*(.+)$/);
    if (!match) continue;
    const label = `${match[1]}) ${match[2].trim()}`;
    options.push({ value: label, label });
  }
  return options;
}

export interface ParsedChoiceLine {
  label: string;
  options: LizhiClarifyOption[];
  rawLine: string;
}

/** 解析单行 A/B/C 选择题 */
export function parseChoiceQuestionLine(line: string): ParsedChoiceLine | null {
  const match = line.match(CHOICE_QUESTION_LINE_RE);
  if (!match) return null;

  const label = match[1].trim();
  const options = parseChoiceOptions(match[2]);
  if (options.length < 2) return null;

  return { label, options, rawLine: line };
}

export interface ParsedSectionChoice {
  letter: string;
  title: string;
  rawLine: string;
}

/** 解析 `方向 A：标题` 类分段选项行 */
export function parseDirectionSectionLine(line: string): ParsedSectionChoice | null {
  const match = line.match(DIRECTION_SECTION_RE);
  if (!match) return null;

  const title = match[2].trim();
  if (!title || title.length > 240) return null;

  return { letter: match[1], title, rawLine: line };
}

/** 解析 `A) 标题` 独立成行 */
export function parseLetterParenLine(line: string): ParsedSectionChoice | null {
  const match = line.match(LETTER_PAREN_LINE_RE);
  if (!match) return null;

  const title = match[2].trim();
  if (!title || title.length > 240) return null;

  return { letter: match[1], title, rawLine: line };
}

function sectionChoiceToOption(section: ParsedSectionChoice): LizhiClarifyOption {
  const label = `${section.letter}) ${section.title}`;
  return { value: label, label };
}

function inferInlineChoicesForm(content: string): LizhiClarifyForm | null {
  const lines = content.split("\n");
  const parsedLines: ParsedChoiceLine[] = [];
  let firstLineIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseChoiceQuestionLine(lines[i]);
    if (!parsed) continue;
    if (firstLineIndex < 0) firstLineIndex = i;
    parsedLines.push(parsed);
  }

  if (!parsedLines.length) return null;

  const fields: LizhiClarifyField[] = parsedLines.map((item, index) => ({
    id: slugifyFieldId(item.label, index),
    label: item.label,
    type: "select" as const,
    required: true,
    options: item.options,
  }));

  return {
    title: inferChoiceFormTitle(content, firstLineIndex),
    fields,
  };
}

function inferSectionChoiceTitle(content: string): string | undefined {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/请.*选择.*方向/.test(trimmed)) {
      return trimmed.replace(/[，,：:]\s*我来.*$/u, "").replace(/[：:]\s*$/, "");
    }
    if (/你倾向哪个方向/.test(trimmed)) return "请选择发展方向";
    if (/请.*(确认|选择|挑选|决定)/.test(trimmed)) {
      return trimmed.replace(/[：:]\s*$/, "");
    }
  }
  return "请选择一个选项";
}

function inferSectionFieldLabel(content: string): string {
  if (/方向/.test(content)) return "发展方向";
  if (/选项/.test(content)) return "选项";
  return "请选择";
}

function buildSectionChoicesForm(
  sections: ParsedSectionChoice[],
  content: string,
): LizhiClarifyForm {
  const fields: LizhiClarifyField[] = [
    {
      id: "choice",
      label: inferSectionFieldLabel(content),
      type: "select",
      required: true,
      options: sections.map(sectionChoiceToOption),
    },
  ];

  if (/也可以组合|可以组合/.test(content)) {
    fields.push({
      id: "combo",
      label: "组合说明（可选）",
      type: "textarea",
      placeholder: "例如 A+C 或 B+E",
      required: false,
    });
  }

  return {
    title: inferSectionChoiceTitle(content),
    fields,
  };
}

/** 解析 `方向 A：` / `A) 标题` 分段式单选题 */
export function inferSectionChoicesForm(content: string): LizhiClarifyForm | null {
  const lines = content.split("\n");
  const directionSections: ParsedSectionChoice[] = [];
  const letterSections: ParsedSectionChoice[] = [];

  for (const line of lines) {
    const direction = parseDirectionSectionLine(line);
    if (direction) {
      directionSections.push(direction);
      continue;
    }
    const letter = parseLetterParenLine(line);
    if (letter) letterSections.push(letter);
  }

  if (directionSections.length >= 2) {
    return buildSectionChoicesForm(directionSections, content);
  }
  if (letterSections.length >= 2) {
    return buildSectionChoicesForm(letterSections, content);
  }
  return null;
}

function inferChoiceFormTitle(content: string, firstLineIndex: number): string | undefined {
  const before = content.split("\n").slice(0, firstLineIndex);
  for (let i = before.length - 1; i >= Math.max(0, before.length - 6); i -= 1) {
    const line = before[i]?.trim() ?? "";
    if (!line) continue;
    if (/请.*(确认|选择|补充|填写|偏好|决定)/.test(line)) {
      return line.replace(/[：:]\s*$/, "");
    }
    if (/^#{1,3}\s+/.test(line)) {
      return line.replace(/^#{1,3}\s+/, "").trim();
    }
  }
  return "请确认以下选项";
}

/**
 * Agent 用纯文本 A/B/C 提问时的启发式解析（类似 Cursor AskQuestion 的 fallback）。
 * 支持：
 * - 同行多选：`1. **标签**：A) … · B) …`
 * - 分段标题：`方向 A：…` / `方向 B：…`
 * - 独立行：`A) …` / `B) …`
 */
export function inferPlainTextChoicesForm(content: string): LizhiClarifyForm | null {
  if (parseClarifyBlock(content)) return null;

  return inferInlineChoicesForm(content) ?? inferSectionChoicesForm(content);
}

function stripSectionChoicePrompts(content: string): string {
  const kept = content.split("\n").filter((line) => {
    const trimmed = line.trim();
    return !trimmed || !SECTION_CHOICE_PROMPT_RE.test(trimmed);
  });
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** 从正文中移除已解析为澄清表单的选项行 */
export function stripPlainTextChoiceLines(content: string): string {
  const lines = content.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    if (parseChoiceQuestionLine(line)) continue;
    const trimmed = line.trim();
    if (trimmed && CHOICE_INSTRUCTION_TAIL_RE.test(trimmed)) continue;
    kept.push(line);
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** 移除 lizhi-clarify 块及已解析的纯文本选项行 */
export function stripClarifyContent(content: string): string {
  const withoutBlock = stripClarifyBlock(content);
  if (inferInlineChoicesForm(withoutBlock)) {
    return stripPlainTextChoiceLines(withoutBlock);
  }
  if (inferSectionChoicesForm(withoutBlock)) {
    return stripSectionChoicePrompts(withoutBlock);
  }
  return withoutBlock;
}

/** guizang-ppt 等 Agent 用纯文本提问时的启发式 fallback */
export function inferGuizangClarifyFallback(content: string): LizhiClarifyForm | null {
  if (parseClarifyBlock(content)) return null;
  const hasStyle = /风格|杂志|瑞士/.test(content);
  const hasAudience = /受众|场景/.test(content);
  const hasDuration = /时长|页数/.test(content);
  const hasTheme = /主题色|主题/.test(content);
  const looksLikeClarify =
    hasStyle && hasAudience && hasDuration && hasTheme && /补充|确认|请/.test(content);
  return looksLikeClarify ? GUIZANG_PPT_CLARIFY_DEFAULT : null;
}

export function resolveClarifyForm(content: string, agentId?: string | null): LizhiClarifyForm | null {
  const fromBlock = parseClarifyBlock(content);
  if (fromBlock) return fromBlock;

  const fromPlainText = inferPlainTextChoicesForm(content);
  if (fromPlainText) return fromPlainText;

  if (agentId === "guizang-ppt" || agentId === "guizhang-ppt") {
    return inferGuizangClarifyFallback(content);
  }
  return inferGuizangClarifyFallback(content);
}

export function initialClarifyValues(form: LizhiClarifyForm): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of form.fields) {
    values[field.id] = field.default ?? "";
  }
  return values;
}

export function formatClarifyReply(form: LizhiClarifyForm, values: Record<string, string>): string {
  const lines: string[] = [];
  for (const field of form.fields) {
    const value = values[field.id]?.trim();
    if (!value) continue;
    if (field.type === "select" && value === "其他") continue;
    if (field.type === "select" && value === "更长") continue;
    lines.push(`${field.label}：${value}`);
  }
  return lines.join("\n");
}

export function validateClarifyForm(form: LizhiClarifyForm, values: Record<string, string>): string | null {
  for (const field of form.fields) {
    if (!field.required) continue;
    if (!values[field.id]?.trim()) {
      return `请填写「${field.label}」`;
    }
  }
  return null;
}
