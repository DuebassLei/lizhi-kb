export type LaunchEnvironment = "production" | "staging" | "preview" | "other";
export type LaunchStatus =
  | "planned"
  | "in_progress"
  | "live"
  | "rolled_back"
  | "cancelled";
export type VerificationStatus = "pending" | "passed" | "failed";
export type LaunchRiskLevel = "low" | "medium" | "high";

export interface LaunchRecord {
  id: string;
  recordNumber: string;
  title: string;
  version?: string;
  environment: LaunchEnvironment;
  status: LaunchStatus;
  riskLevel?: LaunchRiskLevel;
  clientName?: string;
  projectName?: string;
  scheduledAt?: number;
  launchedAt?: number;
  rolledBackAt?: number;
  operator?: string;
  owner?: string;
  approver?: string;
  changeSummary?: string;
  releaseNotes?: string;
  rollbackReason?: string;
  verificationStatus?: VerificationStatus;
  verificationNotes?: string;
  linkedRequirementIds?: string[];
  linkedDocumentIds?: string[];
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export const LAUNCH_STATUSES: LaunchStatus[] = [
  "planned",
  "in_progress",
  "live",
  "rolled_back",
  "cancelled",
];

export const LAUNCH_ENVIRONMENTS: LaunchEnvironment[] = [
  "production",
  "staging",
  "preview",
  "other",
];

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  "pending",
  "passed",
  "failed",
];

export const RISK_LEVELS: LaunchRiskLevel[] = ["low", "medium", "high"];

export const STATUS_LABELS: Record<LaunchStatus, string> = {
  planned: "计划中",
  in_progress: "上线中",
  live: "已上线",
  rolled_back: "已回滚",
  cancelled: "已取消",
};

export const ENVIRONMENT_LABELS: Record<LaunchEnvironment, string> = {
  production: "生产",
  staging: "预发",
  preview: "预览",
  other: "其他",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  pending: "待验证",
  passed: "通过",
  failed: "失败",
};

export const RISK_LABELS: Record<LaunchRiskLevel, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export const STATUS_BY_LABEL: Record<string, LaunchStatus> = {
  ...Object.fromEntries(
    (Object.entries(STATUS_LABELS) as [LaunchStatus, string][]).map(([k, v]) => [v, k]),
  ),
  planned: "planned",
  in_progress: "in_progress",
  live: "live",
  rolled_back: "rolled_back",
  cancelled: "cancelled",
};

export const ENVIRONMENT_BY_LABEL: Record<string, LaunchEnvironment> = {
  ...Object.fromEntries(
    (Object.entries(ENVIRONMENT_LABELS) as [LaunchEnvironment, string][]).map(([k, v]) => [v, k]),
  ),
  production: "production",
  staging: "staging",
  preview: "preview",
  other: "other",
};

export const RISK_BY_LABEL: Record<string, LaunchRiskLevel> = {
  ...Object.fromEntries(
    (Object.entries(RISK_LABELS) as [LaunchRiskLevel, string][]).map(([k, v]) => [v, k]),
  ),
  low: "low",
  medium: "medium",
  high: "high",
};

export const VERIFICATION_BY_LABEL: Record<string, VerificationStatus> = {
  ...Object.fromEntries(
    (Object.entries(VERIFICATION_LABELS) as [VerificationStatus, string][]).map(([k, v]) => [
      v,
      k,
    ]),
  ),
  pending: "pending",
  passed: "passed",
  failed: "failed",
};

export const STATUS_THEME: Record<
  LaunchStatus,
  {
    pill: string;
    dot: string;
    headerBg: string;
    rowAccent: string;
  }
> = {
  planned: {
    pill: "bg-link/12 text-link border border-link/25",
    dot: "bg-link",
    headerBg: "bg-link/[0.08]",
    rowAccent: "border-l-link/70",
  },
  in_progress: {
    pill: "bg-paw/12 text-paw border border-paw/25",
    dot: "bg-paw",
    headerBg: "bg-paw/[0.09]",
    rowAccent: "border-l-paw/70",
  },
  live: {
    pill: "bg-secure/12 text-secure border border-secure/25",
    dot: "bg-secure",
    headerBg: "bg-secure/[0.08]",
    rowAccent: "border-l-secure/70",
  },
  rolled_back: {
    pill: "bg-danger/12 text-danger border border-danger/25",
    dot: "bg-danger",
    headerBg: "bg-danger/[0.08]",
    rowAccent: "border-l-danger/70",
  },
  cancelled: {
    pill: "bg-surface-2 text-muted border border-border",
    dot: "bg-muted",
    headerBg: "bg-surface-1",
    rowAccent: "border-l-muted/50",
  },
};

export function formatLaunchDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLaunchCompactDate(ts?: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const md = d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  const hm = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${md} ${hm}`;
}

export function parseLaunchDate(value: string): number | undefined {
  const v = value.trim();
  if (!v || v === "—" || v === "-") return undefined;
  const ts = Date.parse(v.replace(/\//g, "-"));
  return Number.isNaN(ts) ? undefined : ts;
}

/** 时间线排序/分组用：实际上线 > 计划 > 创建 */
export function launchRecordSortTime(record: LaunchRecord): number {
  return record.launchedAt ?? record.scheduledAt ?? record.createdAt;
}

export function launchRecordMonthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatLaunchMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y} 年 ${parseInt(m, 10)} 月`;
}

export function isLiveThisMonth(record: LaunchRecord): boolean {
  if (record.status !== "live" || !record.launchedAt) return false;
  const now = new Date();
  const d = new Date(record.launchedAt);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
