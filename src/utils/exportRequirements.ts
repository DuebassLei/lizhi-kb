import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";
import type { Requirement } from "../types/requirement";
import {
  formatRequirementDate,
  getRequirementDisplayTitle,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "../types/requirement";
import { downloadTextFile } from "./exportFile";

export const CSV_HEADERS = [
  "需求单号",
  "需求标题",
  "内容",
  "状态",
  "优先级",
  "进度说明",
  "备注",
  "提出人",
  "负责人",
  "需求来源",
  "提出时间",
  "预计上线",
  "实际上线",
  "创建时间",
  "更新时间",
] as const;

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function requirementToCsvRow(req: Requirement): string {
  const fields = [
    req.number,
    req.title?.trim() || getRequirementDisplayTitle(req),
    req.content.trim(),
    STATUS_LABELS[req.status],
    req.priority ? PRIORITY_LABELS[req.priority] : "—",
    req.progressDescription?.trim() || "—",
    req.remarks?.trim() || "—",
    req.requester?.trim() || "—",
    req.owner?.trim() || "—",
    req.source?.trim() || "—",
    formatRequirementDate(req.proposedAt),
    formatRequirementDate(req.expectedLaunchAt),
    formatRequirementDate(req.actualLaunchAt),
    formatRequirementDate(req.createdAt),
    formatRequirementDate(req.updatedAt),
  ];
  return fields.map(escapeCsvField).join(",");
}

export function buildRequirementsCsv(items: Requirement[]): string {
  const rows = [CSV_HEADERS.join(","), ...items.map(requirementToCsvRow)];
  return `\uFEFF${rows.join("\r\n")}`;
}

export function requirementsExportFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `需求清单-${y}${m}${day}.csv`;
}

export async function exportRequirementsCsv(items: Requirement[]): Promise<boolean> {
  if (items.length === 0) return false;
  const content = buildRequirementsCsv(items);
  const filename = requirementsExportFilename();
  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const dest = await save({
      title: "导出清单",
      defaultPath: filename,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!dest) return false;
    await tauriInvoke<void>("write_export_file", { path: dest, content });
    return true;
  }
  downloadTextFile(filename, content, "text/csv;charset=utf-8");
  return true;
}
