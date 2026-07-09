import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";
import type { Requirement, RequirementPriority, RequirementStatus } from "../types/requirement";
import {
  parseRequirementDate,
  PRIORITY_BY_LABEL,
  STATUS_BY_LABEL,
} from "../types/requirement";
import { readFileAsText } from "./importMarkdown";
import { CSV_HEADERS } from "./exportRequirements";

export type RequirementImportInput = {
  content: string;
  status?: RequirementStatus;
  priority?: RequirementPriority;
  dueAt?: number;
  proposedAt?: number;
  expectedLaunchAt?: number;
  actualLaunchAt?: number;
  number?: string;
  title?: string;
  progressDescription?: string;
  remarks?: string;
  requester?: string;
  owner?: string;
  source?: string;
};

export interface RequirementImportResult {
  rows: RequirementImportInput[];
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

function parseStatus(raw: string): RequirementStatus | undefined {
  const key = raw.trim();
  if (!key || key === "—") return undefined;
  return STATUS_BY_LABEL[key] ?? (key as RequirementStatus);
}

function parsePriority(raw: string): RequirementPriority | undefined {
  const key = raw.trim();
  if (!key || key === "—") return undefined;
  return PRIORITY_BY_LABEL[key];
}

export function parseRequirementsCsv(content: string): RequirementImportResult {
  const table = parseCsvRows(content);
  const errors: string[] = [];
  const rows: RequirementImportInput[] = [];

  if (table.length === 0) {
    return { rows, errors: ["文件为空"] };
  }

  const header = table[0].map((h) => h.trim());
  const hasKnownHeader = CSV_HEADERS.every((h, i) => header[i] === h);
  const hasLegacyHeader =
    header[0] === "需求单号" &&
    header[1] === "内容" &&
    !header.includes("需求标题");
  const dataRows = hasKnownHeader || hasLegacyHeader ? table.slice(1) : table;

  dataRows.forEach((cells, index) => {
    const lineNo = hasKnownHeader || hasLegacyHeader ? index + 2 : index + 1;

    let number = "";
    let title = "";
    let body = "";
    let statusRaw = "";
    let priorityRaw = "";
    let progressRaw = "";
    let remarksRaw = "";
    let requesterRaw = "";
    let ownerRaw = "";
    let sourceRaw = "";
    let proposedRaw = "";
    let expectedRaw = "";
    let actualRaw = "";

    if (hasKnownHeader) {
      [
        number = "",
        title = "",
        body = "",
        statusRaw = "",
        priorityRaw = "",
        progressRaw = "",
        remarksRaw = "",
        requesterRaw = "",
        ownerRaw = "",
        sourceRaw = "",
        proposedRaw = "",
        expectedRaw = "",
        actualRaw = "",
      ] = cells;
    } else if (hasLegacyHeader) {
      [
        number = "",
        body = "",
        statusRaw = "",
        priorityRaw = "",
        proposedRaw = "",
        expectedRaw = "",
        actualRaw = "",
      ] = cells;
    } else {
      [number = "", body = "", statusRaw = "", priorityRaw = "", proposedRaw = "", expectedRaw = "", actualRaw = ""] =
        cells;
    }

    const contentText = body.trim();
    if (!contentText) {
      errors.push(`第 ${lineNo} 行：内容为空，已跳过`);
      return;
    }

    const status = parseStatus(statusRaw);
    if (statusRaw.trim() && statusRaw.trim() !== "—" && !status) {
      errors.push(`第 ${lineNo} 行：未知状态「${statusRaw.trim()}」`);
      return;
    }

    const priority = parsePriority(priorityRaw);
    if (priorityRaw.trim() && priorityRaw.trim() !== "—" && !priority) {
      errors.push(`第 ${lineNo} 行：未知优先级「${priorityRaw.trim()}」`);
      return;
    }

    rows.push({
      number: number.trim() || undefined,
      title: title.trim() || undefined,
      content: contentText,
      status: status ?? "todo",
      priority,
      progressDescription: progressRaw.trim() || undefined,
      remarks: remarksRaw.trim() || undefined,
      requester: requesterRaw.trim() || undefined,
      owner: ownerRaw.trim() || undefined,
      source: sourceRaw.trim() || undefined,
      proposedAt: parseRequirementDate(proposedRaw),
      expectedLaunchAt: parseRequirementDate(expectedRaw),
      actualLaunchAt: parseRequirementDate(actualRaw),
    });
  });

  return { rows, errors };
}

export function filterDuplicateImports(
  rows: RequirementImportInput[],
  existing: Requirement[],
): { toImport: RequirementImportInput[]; skipped: number } {
  const existingNumbers = new Set(existing.map((r) => r.number));
  const toImport: RequirementImportInput[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (row.number && existingNumbers.has(row.number)) {
      skipped += 1;
      continue;
    }
    toImport.push(row);
    if (row.number) existingNumbers.add(row.number);
  }

  return { toImport, skipped };
}

export async function pickRequirementsCsvFile(): Promise<string | null> {
  if (isTauriRuntime()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({
      title: "导入需求清单",
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
