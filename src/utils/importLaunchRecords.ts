import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";
import type { Requirement } from "../types/requirement";
import type { LaunchRecord } from "../types/launchRecord";
import {
  ENVIRONMENT_BY_LABEL,
  parseLaunchDate,
  RISK_BY_LABEL,
  STATUS_BY_LABEL,
  VERIFICATION_BY_LABEL,
  type LaunchEnvironment,
  type LaunchRiskLevel,
  type LaunchStatus,
  type VerificationStatus,
} from "../types/launchRecord";
import { readFileAsText } from "./importMarkdown";
import { CSV_HEADERS } from "./exportLaunchRecords";
import type { CreateLaunchInput } from "../services/launchRecordService";

export type LaunchImportInput = CreateLaunchInput & {
  recordNumber?: string;
  linkedRequirementNumbers?: string[];
};

export interface LaunchImportResult {
  rows: LaunchImportInput[];
  errors: string[];
}

function parseCsvRows(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function parseEnum<T extends string>(
  raw: string,
  map: Record<string, T>,
  fallback?: T,
): T | undefined {
  const key = raw.trim();
  if (!key || key === "—") return fallback;
  return map[key] ?? (key as T);
}

function parseTags(raw: string): string[] | undefined {
  const v = raw.trim();
  if (!v || v === "—") return undefined;
  return v
    .split(/[;；]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseRequirementNumbers(raw: string): string[] | undefined {
  const v = raw.trim();
  if (!v || v === "—") return undefined;
  return v
    .split(/[;；]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function parseLaunchRecordsCsv(content: string): LaunchImportResult {
  const table = parseCsvRows(content);
  const errors: string[] = [];
  const rows: LaunchImportInput[] = [];

  if (table.length === 0) {
    return { rows, errors: ["文件为空"] };
  }

  const header = table[0].map((h) => h.trim());
  const hasKnownHeader = CSV_HEADERS.every((h, i) => header[i] === h);
  const dataRows = hasKnownHeader ? table.slice(1) : table;

  dataRows.forEach((cells, index) => {
    const lineNo = hasKnownHeader ? index + 2 : index + 1;

    let recordNumber = "";
    let title = "";
    let version = "";
    let envRaw = "";
    let statusRaw = "";
    let riskRaw = "";
    let clientName = "";
    let projectName = "";
    let scheduledRaw = "";
    let launchedRaw = "";
    let rolledBackRaw = "";
    let owner = "";
    let operator = "";
    let approver = "";
    let changeSummary = "";
    let releaseNotes = "";
    let rollbackReason = "";
    let verificationRaw = "";
    let verificationNotes = "";
    let linkedReqsRaw = "";
    let tagsRaw = "";

    if (hasKnownHeader) {
      [
        recordNumber = "",
        title = "",
        version = "",
        envRaw = "",
        statusRaw = "",
        riskRaw = "",
        clientName = "",
        projectName = "",
        scheduledRaw = "",
        launchedRaw = "",
        rolledBackRaw = "",
        owner = "",
        operator = "",
        approver = "",
        changeSummary = "",
        releaseNotes = "",
        rollbackReason = "",
        verificationRaw = "",
        verificationNotes = "",
        linkedReqsRaw = "",
        ,
        tagsRaw = "",
      ] = cells;
    } else {
      [title = "", statusRaw = ""] = cells;
    }

    const titleText = title.trim();
    if (!titleText) {
      errors.push(`第 ${lineNo} 行：标题为空，已跳过`);
      return;
    }

    const environment = parseEnum<LaunchEnvironment>(envRaw, ENVIRONMENT_BY_LABEL, "production");
    const status = parseEnum<LaunchStatus>(statusRaw, STATUS_BY_LABEL, "planned");
    const riskLevel = parseEnum<LaunchRiskLevel>(riskRaw, RISK_BY_LABEL);
    const verificationStatus = parseEnum<VerificationStatus>(verificationRaw, VERIFICATION_BY_LABEL);

    if (envRaw.trim() && envRaw.trim() !== "—" && !ENVIRONMENT_BY_LABEL[envRaw.trim()]) {
      errors.push(`第 ${lineNo} 行：未知环境「${envRaw.trim()}」`);
      return;
    }
    if (statusRaw.trim() && statusRaw.trim() !== "—" && !STATUS_BY_LABEL[statusRaw.trim()]) {
      errors.push(`第 ${lineNo} 行：未知状态「${statusRaw.trim()}」`);
      return;
    }

    rows.push({
      recordNumber: recordNumber.trim() || undefined,
      title: titleText,
      version: version.trim() || undefined,
      environment,
      status,
      riskLevel,
      clientName: clientName.trim() || undefined,
      projectName: projectName.trim() || undefined,
      scheduledAt: parseLaunchDate(scheduledRaw),
      launchedAt: parseLaunchDate(launchedRaw),
      rolledBackAt: parseLaunchDate(rolledBackRaw),
      owner: owner.trim() || undefined,
      operator: operator.trim() || undefined,
      approver: approver.trim() || undefined,
      changeSummary: changeSummary.trim() || undefined,
      releaseNotes: releaseNotes.trim() || undefined,
      rollbackReason: rollbackReason.trim() || undefined,
      verificationStatus,
      verificationNotes: verificationNotes.trim() || undefined,
      linkedRequirementNumbers: parseRequirementNumbers(linkedReqsRaw),
      tags: parseTags(tagsRaw),
    });
  });

  return { rows, errors };
}

export function filterDuplicateLaunchImports(
  rows: LaunchImportInput[],
  existing: LaunchRecord[],
): { toImport: LaunchImportInput[]; skipped: number } {
  const existingNumbers = new Set(existing.map((r) => r.recordNumber));
  const toImport: LaunchImportInput[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (row.recordNumber && existingNumbers.has(row.recordNumber)) {
      skipped += 1;
      continue;
    }
    toImport.push(row);
    if (row.recordNumber) existingNumbers.add(row.recordNumber);
  }

  return { toImport, skipped };
}

export function resolveRequirementIds(
  numbers: string[] | undefined,
  requirements: Requirement[],
): string[] | undefined {
  if (!numbers?.length) return undefined;
  const byNumber = new Map(requirements.map((r) => [r.number, r.id]));
  const ids: string[] = [];
  for (const num of numbers) {
    const id = byNumber.get(num);
    if (id) ids.push(id);
  }
  return ids.length ? ids : undefined;
}

export async function pickLaunchRecordsCsvFile(): Promise<string | null> {
  if (isTauriRuntime()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({
      title: "导入上线记录",
      multiple: false,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!path || Array.isArray(path)) return null;
    return tauriInvoke<string>("read_text_file", { path });
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve(await readFileAsText(file));
    };
    input.click();
  });
}
