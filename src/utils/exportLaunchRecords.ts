import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";
import type { LaunchRecord } from "../types/launchRecord";
import {
  ENVIRONMENT_LABELS,
  formatLaunchDate,
  RISK_LABELS,
  STATUS_LABELS,
  VERIFICATION_LABELS,
} from "../types/launchRecord";
import { downloadTextFile } from "./exportFile";

export const CSV_HEADERS = [
  "记录单号",
  "标题",
  "版本",
  "环境",
  "状态",
  "风险等级",
  "客户名称",
  "项目名称",
  "计划上线",
  "实际上线",
  "回滚时间",
  "负责人",
  "操作人",
  "审批人",
  "变更摘要",
  "发布说明",
  "回滚原因",
  "验证状态",
  "验证备注",
  "关联需求",
  "关联文档",
  "标签",
  "创建时间",
  "更新时间",
] as const;

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function joinList(values?: string[]): string {
  if (!values?.length) return "—";
  return values.join("; ");
}

function recordToCsvRow(record: LaunchRecord, requirementNumbers?: Map<string, string>): string {
  const linkedReqs =
    record.linkedRequirementIds
      ?.map((id) => requirementNumbers?.get(id) ?? id)
      .join("; ") ?? "—";

  const fields = [
    record.recordNumber,
    record.title,
    record.version?.trim() || "—",
    ENVIRONMENT_LABELS[record.environment],
    STATUS_LABELS[record.status],
    record.riskLevel ? RISK_LABELS[record.riskLevel] : "—",
    record.clientName?.trim() || "—",
    record.projectName?.trim() || "—",
    formatLaunchDate(record.scheduledAt),
    formatLaunchDate(record.launchedAt),
    formatLaunchDate(record.rolledBackAt),
    record.owner?.trim() || "—",
    record.operator?.trim() || "—",
    record.approver?.trim() || "—",
    record.changeSummary?.trim() || "—",
    record.releaseNotes?.trim() || "—",
    record.rollbackReason?.trim() || "—",
    record.verificationStatus ? VERIFICATION_LABELS[record.verificationStatus] : "—",
    record.verificationNotes?.trim() || "—",
    linkedReqs,
    joinList(record.linkedDocumentIds),
    joinList(record.tags),
    formatLaunchDate(record.createdAt),
    formatLaunchDate(record.updatedAt),
  ];
  return fields.map(escapeCsvField).join(",");
}

export function buildLaunchRecordsCsv(
  items: LaunchRecord[],
  requirementNumbers?: Map<string, string>,
): string {
  const rows = [CSV_HEADERS.join(","), ...items.map((r) => recordToCsvRow(r, requirementNumbers))];
  return `\uFEFF${rows.join("\r\n")}`;
}

export function buildLaunchRecordsMarkdown(items: LaunchRecord[]): string {
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const liveCount = items.filter((r) => r.status === "live").length;
  const rollbackCount = items.filter((r) => r.status === "rolled_back").length;

  const lines: string[] = [
    "# 上线记录报告",
    "",
    `导出时间：${exportedAt}`,
    "",
    "## 概览",
    "",
    `- 记录条数：${items.length}`,
    `- 已上线：${liveCount}`,
    `- 已回滚：${rollbackCount}`,
    "",
    "## 记录明细",
    "",
  ];

  if (items.length === 0) {
    lines.push("_（暂无记录）_");
    return lines.join("\n");
  }

  for (const record of items) {
    lines.push(
      `### ${record.recordNumber} · ${record.title}`,
      "",
      "| 项 | 值 |",
      "|----|-----|",
      `| 环境 | ${ENVIRONMENT_LABELS[record.environment]} |`,
      `| 状态 | ${STATUS_LABELS[record.status]} |`,
      `| 版本 | ${record.version ?? "—"} |`,
      `| 计划上线 | ${formatLaunchDate(record.scheduledAt)} |`,
      `| 实际上线 | ${formatLaunchDate(record.launchedAt)} |`,
      `| 操作人 | ${record.operator ?? "—"} |`,
      "",
    );
    if (record.changeSummary?.trim()) {
      lines.push(`**变更摘要**：${record.changeSummary.trim()}`, "");
    }
    if (record.releaseNotes?.trim()) {
      lines.push("**发布说明**：", "", record.releaseNotes.trim(), "");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function launchRecordsExportFilename(ext: "csv" | "md"): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return ext === "csv" ? `上线记录-${y}${m}${day}.csv` : `上线记录-${y}${m}${day}.md`;
}

export function buildLaunchRecordsCsvTemplate(): string {
  return buildLaunchRecordsCsv([]);
}

async function saveExportFile(filename: string, content: string, filterName: string, extensions: string[]) {
  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const dest = await save({
      title: "导出上线记录",
      defaultPath: filename,
      filters: [{ name: filterName, extensions }],
    });
    if (!dest) return false;
    await tauriInvoke<void>("write_export_file", { path: dest, content });
    return true;
  }
  const mime = extensions[0] === "csv" ? "text/csv;charset=utf-8" : "text/markdown;charset=utf-8";
  downloadTextFile(filename, content, mime);
  return true;
}

export async function exportLaunchRecordsCsv(
  items: LaunchRecord[],
  requirementNumbers?: Map<string, string>,
): Promise<boolean> {
  if (items.length === 0) return false;
  const content = buildLaunchRecordsCsv(items, requirementNumbers);
  return saveExportFile(launchRecordsExportFilename("csv"), content, "CSV", ["csv"]);
}

export async function exportLaunchRecordsMarkdown(items: LaunchRecord[]): Promise<boolean> {
  if (items.length === 0) return false;
  const content = buildLaunchRecordsMarkdown(items);
  return saveExportFile(launchRecordsExportFilename("md"), content, "Markdown", ["md"]);
}

export async function downloadLaunchRecordsCsvTemplate(): Promise<boolean> {
  const content = buildLaunchRecordsCsvTemplate();
  const filename = "上线记录-导入模板.csv";
  return saveExportFile(filename, content, "CSV", ["csv"]);
}
