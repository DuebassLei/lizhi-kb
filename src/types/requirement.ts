export type RequirementStatus = "todo" | "in_progress" | "suspended" | "done";
export type RequirementPriority = "low" | "medium" | "high";

export interface Requirement {
  id: string;
  number: string;
  content: string;
  status: RequirementStatus;
  priority?: RequirementPriority;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  dueAt?: number;
  /** 需求提出/提交时间（可与 createdAt 区分） */
  proposedAt?: number;
  /** 预计上线时间 */
  expectedLaunchAt?: number;
  /** 实际上线时间 */
  actualLaunchAt?: number;
  /** 需求标题（优先于 content 首行摘要） */
  title?: string;
  /** 进度说明 */
  progressDescription?: string;
  /** 备注 */
  remarks?: string;
  /** 需求提出人 */
  requester?: string;
  /** 需求负责人 */
  owner?: string;
  /** 需求来源 */
  source?: string;
  /** 关联知识库文档 ID */
  linkedDocumentIds?: string[];
}

export const REQUIREMENT_STATUSES: RequirementStatus[] = [
  "todo",
  "in_progress",
  "suspended",
  "done",
];

export const STATUS_LABELS: Record<RequirementStatus, string> = {
  todo: "待办",
  in_progress: "进行中",
  suspended: "挂起",
  done: "完成",
};

export const PRIORITY_LABELS: Record<RequirementPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

/** CSV 导入：中文标签 → 枚举 */
export const STATUS_BY_LABEL: Record<string, RequirementStatus> = {
  ...Object.fromEntries(
    (Object.entries(STATUS_LABELS) as [RequirementStatus, string][]).map(([k, v]) => [v, k]),
  ),
  todo: "todo",
  in_progress: "in_progress",
  suspended: "suspended",
  done: "done",
};

export const PRIORITY_BY_LABEL: Record<string, RequirementPriority> = {
  ...Object.fromEntries(
    (Object.entries(PRIORITY_LABELS) as [RequirementPriority, string][]).map(([k, v]) => [v, k]),
  ),
  low: "low",
  medium: "medium",
  high: "high",
};

/** SVG 图表用色（与 STATUS_THEME 语义一致） */
export const STATUS_CHART_COLORS: Record<RequirementStatus, string> = {
  todo: "#6b9fd8",
  in_progress: "#d4a574",
  suspended: "#a899c8",
  done: "#4ade9a",
};

export const PRIORITY_CHART_COLORS: Record<RequirementPriority | "none", string> = {
  high: "#f07070",
  medium: "#e8b86d",
  low: "#787f8c",
  none: "#363d4a",
};

/** 看板列 / 状态徽章配色 */
export const STATUS_THEME: Record<
  RequirementStatus,
  {
    accent: string;
    bg: string;
    dragOver: string;
    header: string;
    headerBg: string;
    dot: string;
    countBadge: string;
    pill: string;
    rowAccent: string;
  }
> = {
  todo: {
    accent: "border-t-link border-t-2",
    bg: "bg-link/[0.06]",
    dragOver: "border-link/40 bg-link/10 ring-1 ring-link/25",
    header: "text-link",
    headerBg: "bg-link/[0.08]",
    dot: "bg-link",
    countBadge: "bg-link/20 text-link",
    pill: "bg-link/12 text-link border border-link/25",
    rowAccent: "border-l-link/70",
  },
  in_progress: {
    accent: "border-t-paw border-t-2",
    bg: "bg-paw/[0.07]",
    dragOver: "border-paw/40 bg-paw/10 ring-1 ring-paw/25",
    header: "text-paw",
    headerBg: "bg-paw/[0.09]",
    dot: "bg-paw",
    countBadge: "bg-paw/20 text-paw",
    pill: "bg-paw/12 text-paw border border-paw/25",
    rowAccent: "border-l-paw/70",
  },
  suspended: {
    accent: "border-t-hold border-t-2",
    bg: "bg-hold/[0.07]",
    dragOver: "border-hold/40 bg-hold/10 ring-1 ring-hold/25",
    header: "text-hold",
    headerBg: "bg-hold/[0.09]",
    dot: "bg-hold",
    countBadge: "bg-hold/20 text-hold",
    pill: "bg-hold/12 text-hold border border-hold/25",
    rowAccent: "border-l-hold/70",
  },
  done: {
    accent: "border-t-secure border-t-2",
    bg: "bg-secure/[0.06]",
    dragOver: "border-secure/40 bg-secure/10 ring-1 ring-secure/25",
    header: "text-secure",
    headerBg: "bg-secure/[0.08]",
    dot: "bg-secure",
    countBadge: "bg-secure/20 text-secure",
    pill: "bg-secure/12 text-secure border border-secure/25",
    rowAccent: "border-l-secure/70",
  },
};

/** 卡片左边框与优先级徽章配色 */
export const PRIORITY_THEME: Record<
  RequirementPriority,
  { border: string; pill: string; pillActive: string }
> = {
  high: {
    border: "border-l-danger",
    pill: "bg-danger/12 text-danger border border-danger/25",
    pillActive: "bg-danger/20 text-danger border-danger/50 ring-1 ring-danger/30",
  },
  medium: {
    border: "border-l-warning",
    pill: "bg-warning/12 text-warning border border-warning/25",
    pillActive: "bg-warning/20 text-warning border-warning/50 ring-1 ring-warning/30",
  },
  low: {
    border: "border-l-muted/60",
    pill: "bg-surface-2 text-muted border border-border",
    pillActive: "bg-surface-2 text-[var(--color-text)] border-border-strong ring-1 ring-border-strong",
  },
};

/** 未完成且已过截止时间 */
export function isRequirementOverdue(req: Requirement): boolean {
  if (!req.dueAt || req.status === "done") return false;
  return req.dueAt < Date.now();
}

/** 卡片/列表用的截止提示文案 */
export function formatDueHint(ts?: number): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return `逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return "今天截止";
  if (diffDays === 1) return "明天截止";
  if (diffDays <= 7) return `${diffDays} 天后截止`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

/** 取内容首行作为卡片标题摘要 */
export function requirementTitle(content: string): string {
  const line = content.trim().split(/\r?\n/)[0]?.trim();
  return line || "未命名需求";
}

/** 展示用标题：优先 title 字段，否则回退 content 首行 */
export function getRequirementDisplayTitle(
  req: Pick<Requirement, "title" | "content">,
): string {
  const t = req.title?.trim();
  if (t) return t;
  return requirementTitle(req.content);
}

/** 列表标题列：仅展示单行标题 */
export function getRequirementListTitle(
  req: Pick<Requirement, "title" | "content">,
): string {
  const t = req.title?.trim();
  if (t) {
    return t.split(/\r?\n/)[0]?.trim() || t;
  }
  return requirementTitle(req.content);
}

/** 列表内容列：展示正文；无 title 时去掉与标题重复的首行 */
export function getRequirementListContent(
  req: Pick<Requirement, "title" | "content">,
): string {
  const body = req.content?.trim();
  if (body) {
    if (!req.title?.trim()) {
      const lines = body.split(/\r?\n/);
      if (lines.length > 1) {
        const rest = lines.slice(1).join("\n").trim();
        if (rest) return rest;
      }
    }
    return body;
  }

  const title = req.title?.trim();
  if (!title) return "";
  const lines = title.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) return "";
  return lines.slice(1).join("\n");
}

/** 列表用紧凑日期：月/日 时:分 */
export function formatRequirementCompactDate(ts?: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const md = d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  const hm = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${md} ${hm}`;
}

/** 格式化时间戳为中文日期时间，空值显示 — */
export function formatRequirementDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 解析 CSV 导出的中文日期或 ISO 字符串 */
export function parseRequirementDate(value: string): number | undefined {
  const v = value.trim();
  if (!v || v === "—" || v === "-") return undefined;
  const ts = Date.parse(v.replace(/\//g, "-"));
  return Number.isNaN(ts) ? undefined : ts;
}
