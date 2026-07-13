import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "./vaultService";
import type {
  LaunchEnvironment,
  LaunchRecord,
  LaunchRiskLevel,
  LaunchStatus,
  VerificationStatus,
} from "../types/launchRecord";

const STORAGE_KEY = "lizhi-kb-launch-records";

interface StoredData {
  launchRecords: LaunchRecord[];
}

export type CreateLaunchInput = {
  title: string;
  version?: string;
  environment?: LaunchEnvironment;
  status?: LaunchStatus;
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
};

export type LaunchRecordPatch = {
  title?: string;
  environment?: LaunchEnvironment;
  status?: LaunchStatus;
  version?: string | null;
  riskLevel?: LaunchRiskLevel | null;
  clientName?: string | null;
  projectName?: string | null;
  scheduledAt?: number | null;
  launchedAt?: number | null;
  rolledBackAt?: number | null;
  operator?: string | null;
  owner?: string | null;
  approver?: string | null;
  changeSummary?: string | null;
  releaseNotes?: string | null;
  rollbackReason?: string | null;
  verificationStatus?: VerificationStatus | null;
  verificationNotes?: string | null;
  linkedRequirementIds?: string[] | null;
  linkedDocumentIds?: string[] | null;
  tags?: string[] | null;
};

function loadStored(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { launchRecords: [] };
    const parsed = JSON.parse(raw) as StoredData;
    return { launchRecords: parsed.launchRecords ?? [] };
  } catch {
    return { launchRecords: [] };
  }
}

function saveStored(data: StoredData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearStored(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function datePrefix(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function generateLaunchRecordNumber(existing: LaunchRecord[]): string {
  const prefix = `REL-${datePrefix()}-`;
  let maxSeq = 0;
  for (const record of existing) {
    if (record.recordNumber.startsWith(prefix)) {
      const seq = parseInt(record.recordNumber.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

function trimOptional(value?: string): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

function normalizeCreate(input: CreateLaunchInput): LaunchRecord {
  const data = loadStored();
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    recordNumber: generateLaunchRecordNumber(data.launchRecords),
    title: input.title.trim(),
    version: trimOptional(input.version),
    environment: input.environment ?? "production",
    status: input.status ?? "planned",
    riskLevel: input.riskLevel,
    clientName: trimOptional(input.clientName),
    projectName: trimOptional(input.projectName),
    scheduledAt: input.scheduledAt,
    launchedAt: input.launchedAt,
    rolledBackAt: input.rolledBackAt,
    operator: trimOptional(input.operator),
    owner: trimOptional(input.owner),
    approver: trimOptional(input.approver),
    changeSummary: trimOptional(input.changeSummary),
    releaseNotes: trimOptional(input.releaseNotes),
    rollbackReason: trimOptional(input.rollbackReason),
    verificationStatus: input.verificationStatus,
    verificationNotes: trimOptional(input.verificationNotes),
    linkedRequirementIds: input.linkedRequirementIds?.length
      ? [...input.linkedRequirementIds]
      : undefined,
    linkedDocumentIds: input.linkedDocumentIds?.length
      ? [...input.linkedDocumentIds]
      : undefined,
    tags: input.tags?.filter((t) => t.trim()).length ? input.tags.map((t) => t.trim()) : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

async function withFallback<T>(
  cmd: string,
  args: Record<string, unknown>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (!isTauriRuntime()) return fallback();
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch {
    return fallback();
  }
}

let migrationDone = false;

async function migrateFromLocalStorageIfNeeded(): Promise<void> {
  if (!isTauriRuntime() || migrationDone) return;
  migrationDone = true;

  const existing = await tauriInvoke<LaunchRecord[]>("list_launch_records", {});
  if (existing.length > 0) return;

  const local = loadStored();
  if (local.launchRecords.length === 0) return;

  for (const record of local.launchRecords) {
    await tauriInvoke<LaunchRecord>("create_launch_record", {
      input: {
        title: record.title,
        version: record.version ?? null,
        environment: record.environment,
        status: record.status,
        riskLevel: record.riskLevel ?? null,
        clientName: record.clientName ?? null,
        projectName: record.projectName ?? null,
        scheduledAt: record.scheduledAt ?? null,
        launchedAt: record.launchedAt ?? null,
        rolledBackAt: record.rolledBackAt ?? null,
        operator: record.operator ?? null,
        owner: record.owner ?? null,
        approver: record.approver ?? null,
        changeSummary: record.changeSummary ?? null,
        releaseNotes: record.releaseNotes ?? null,
        rollbackReason: record.rollbackReason ?? null,
        verificationStatus: record.verificationStatus ?? null,
        verificationNotes: record.verificationNotes ?? null,
        linkedRequirementIds: record.linkedRequirementIds ?? null,
        linkedDocumentIds: record.linkedDocumentIds ?? null,
        tags: record.tags ?? null,
        id: record.id,
        recordNumber: record.recordNumber,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
  }
  clearStored();
}

function localListLaunchRecords(): LaunchRecord[] {
  const data = loadStored();
  return [...data.launchRecords].sort(
    (a, b) =>
      (b.launchedAt ?? b.scheduledAt ?? b.createdAt) -
      (a.launchedAt ?? a.scheduledAt ?? a.createdAt),
  );
}

function localCreateLaunchRecord(input: CreateLaunchInput): LaunchRecord {
  const data = loadStored();
  const record = normalizeCreate(input);
  data.launchRecords.push(record);
  saveStored(data);
  return record;
}

function localUpdateLaunchRecord(id: string, patch: LaunchRecordPatch): LaunchRecord {
  const data = loadStored();
  const idx = data.launchRecords.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("上线记录不存在");

  const current = data.launchRecords[idx];
  const updated: LaunchRecord = {
    ...current,
    ...("title" in patch && patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...("environment" in patch && patch.environment !== undefined
      ? { environment: patch.environment }
      : {}),
    ...("status" in patch && patch.status !== undefined ? { status: patch.status } : {}),
    ...("version" in patch ? { version: patch.version?.trim() || undefined } : {}),
    ...("riskLevel" in patch ? { riskLevel: patch.riskLevel ?? undefined } : {}),
    ...("clientName" in patch ? { clientName: patch.clientName?.trim() || undefined } : {}),
    ...("projectName" in patch ? { projectName: patch.projectName?.trim() || undefined } : {}),
    ...("scheduledAt" in patch ? { scheduledAt: patch.scheduledAt ?? undefined } : {}),
    ...("launchedAt" in patch ? { launchedAt: patch.launchedAt ?? undefined } : {}),
    ...("rolledBackAt" in patch ? { rolledBackAt: patch.rolledBackAt ?? undefined } : {}),
    ...("operator" in patch ? { operator: patch.operator?.trim() || undefined } : {}),
    ...("owner" in patch ? { owner: patch.owner?.trim() || undefined } : {}),
    ...("approver" in patch ? { approver: patch.approver?.trim() || undefined } : {}),
    ...("changeSummary" in patch
      ? { changeSummary: patch.changeSummary?.trim() || undefined }
      : {}),
    ...("releaseNotes" in patch
      ? { releaseNotes: patch.releaseNotes?.trim() || undefined }
      : {}),
    ...("rollbackReason" in patch
      ? { rollbackReason: patch.rollbackReason?.trim() || undefined }
      : {}),
    ...("verificationStatus" in patch
      ? { verificationStatus: patch.verificationStatus ?? undefined }
      : {}),
    ...("verificationNotes" in patch
      ? { verificationNotes: patch.verificationNotes?.trim() || undefined }
      : {}),
    ...("linkedRequirementIds" in patch
      ? {
          linkedRequirementIds: patch.linkedRequirementIds?.length
            ? [...patch.linkedRequirementIds]
            : undefined,
        }
      : {}),
    ...("linkedDocumentIds" in patch
      ? {
          linkedDocumentIds: patch.linkedDocumentIds?.length
            ? [...patch.linkedDocumentIds]
            : undefined,
        }
      : {}),
    ...("tags" in patch
      ? {
          tags: patch.tags?.filter((t) => t.trim()).length
            ? patch.tags.map((t) => t.trim())
            : undefined,
        }
      : {}),
    updatedAt: Date.now(),
  };

  if (!updated.title.trim()) throw new Error("标题不能为空");
  data.launchRecords[idx] = updated;
  saveStored(data);
  return updated;
}

function localDeleteLaunchRecord(id: string): void {
  const data = loadStored();
  data.launchRecords = data.launchRecords.filter((r) => r.id !== id);
  saveStored(data);
}

function toCreatePayload(input: CreateLaunchInput) {
  return {
    title: input.title,
    version: input.version ?? null,
    environment: input.environment ?? null,
    status: input.status ?? null,
    riskLevel: input.riskLevel ?? null,
    clientName: input.clientName ?? null,
    projectName: input.projectName ?? null,
    scheduledAt: input.scheduledAt ?? null,
    launchedAt: input.launchedAt ?? null,
    rolledBackAt: input.rolledBackAt ?? null,
    operator: input.operator ?? null,
    owner: input.owner ?? null,
    approver: input.approver ?? null,
    changeSummary: input.changeSummary ?? null,
    releaseNotes: input.releaseNotes ?? null,
    rollbackReason: input.rollbackReason ?? null,
    verificationStatus: input.verificationStatus ?? null,
    verificationNotes: input.verificationNotes ?? null,
    linkedRequirementIds: input.linkedRequirementIds ?? null,
    linkedDocumentIds: input.linkedDocumentIds ?? null,
    tags: input.tags ?? null,
  };
}

function toUpdatePayload(patch: LaunchRecordPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("title" in patch) out.title = patch.title;
  if ("environment" in patch) out.environment = patch.environment;
  if ("status" in patch) out.status = patch.status;
  if ("version" in patch) out.version = patch.version ?? null;
  if ("riskLevel" in patch) out.riskLevel = patch.riskLevel ?? null;
  if ("clientName" in patch) out.clientName = patch.clientName ?? null;
  if ("projectName" in patch) out.projectName = patch.projectName ?? null;
  if ("scheduledAt" in patch) out.scheduledAt = patch.scheduledAt ?? null;
  if ("launchedAt" in patch) out.launchedAt = patch.launchedAt ?? null;
  if ("rolledBackAt" in patch) out.rolledBackAt = patch.rolledBackAt ?? null;
  if ("operator" in patch) out.operator = patch.operator ?? null;
  if ("owner" in patch) out.owner = patch.owner ?? null;
  if ("approver" in patch) out.approver = patch.approver ?? null;
  if ("changeSummary" in patch) out.changeSummary = patch.changeSummary ?? null;
  if ("releaseNotes" in patch) out.releaseNotes = patch.releaseNotes ?? null;
  if ("rollbackReason" in patch) out.rollbackReason = patch.rollbackReason ?? null;
  if ("verificationStatus" in patch) out.verificationStatus = patch.verificationStatus ?? null;
  if ("verificationNotes" in patch) out.verificationNotes = patch.verificationNotes ?? null;
  if ("linkedRequirementIds" in patch)
    out.linkedRequirementIds = patch.linkedRequirementIds ?? null;
  if ("linkedDocumentIds" in patch) out.linkedDocumentIds = patch.linkedDocumentIds ?? null;
  if ("tags" in patch) out.tags = patch.tags ?? null;
  return out;
}

export async function listLaunchRecords(): Promise<LaunchRecord[]> {
  if (isTauriRuntime()) {
    await migrateFromLocalStorageIfNeeded();
    return tauriInvoke<LaunchRecord[]>("list_launch_records", {});
  }
  return localListLaunchRecords();
}

export async function createLaunchRecord(input: CreateLaunchInput): Promise<LaunchRecord> {
  return withFallback(
    "create_launch_record",
    { input: toCreatePayload(input) },
    () => localCreateLaunchRecord(input),
  );
}

export async function updateLaunchRecord(
  id: string,
  patch: LaunchRecordPatch,
): Promise<LaunchRecord> {
  return withFallback(
    "update_launch_record",
    { id, patch: toUpdatePayload(patch) },
    () => localUpdateLaunchRecord(id, patch),
  );
}

export async function deleteLaunchRecord(id: string): Promise<void> {
  return withFallback(
    "delete_launch_record",
    { id },
    () => {
      localDeleteLaunchRecord(id);
    },
  );
}

export async function createLaunchRecordWithMigrationFields(
  input: CreateLaunchInput & {
    id?: string;
    recordNumber?: string;
    createdAt?: number;
    updatedAt?: number;
  },
): Promise<LaunchRecord> {
  if (!isTauriRuntime()) return localCreateLaunchRecord(input);
  return tauriInvoke<LaunchRecord>("create_launch_record", {
    input: {
      ...toCreatePayload(input),
      id: input.id ?? null,
      recordNumber: input.recordNumber ?? null,
      createdAt: input.createdAt ?? null,
      updatedAt: input.updatedAt ?? null,
    },
  });
}
