import { tauriInvoke } from "../composables/useTauriCommand";
import type { Requirement, RequirementPriority, RequirementStatus } from "../types/requirement";

const STORAGE_KEY = "lizhi-kb-requirements";

interface StoredData {
  requirements: Requirement[];
}

type RequirementPatch = Partial<
  Pick<Requirement, "content" | "status" | "priority" | "sortOrder" | "number">
> & {
  dueAt?: number | null;
  proposedAt?: number | null;
  expectedLaunchAt?: number | null;
  actualLaunchAt?: number | null;
  title?: string | null;
  progressDescription?: string | null;
  remarks?: string | null;
  requester?: string | null;
  owner?: string | null;
  source?: string | null;
};

type CreateInput = {
  content: string;
  status?: RequirementStatus;
  priority?: RequirementPriority;
  dueAt?: number;
  proposedAt?: number;
  expectedLaunchAt?: number;
  actualLaunchAt?: number;
  title?: string;
  progressDescription?: string;
  remarks?: string;
  requester?: string;
  owner?: string;
  source?: string;
};

function isTauriRuntime(): boolean {
  return !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

function loadStored(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { requirements: [] };
    const parsed = JSON.parse(raw) as StoredData;
    return { requirements: parsed.requirements ?? [] };
  } catch {
    return { requirements: [] };
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

/** REQ-YYYYMMDD-001 格式，按日递增（浏览器 dev fallback） */
export function generateRequirementNumber(existing: Requirement[]): string {
  const prefix = `REQ-${datePrefix()}-`;
  let maxSeq = 0;
  for (const req of existing) {
    if (req.number.startsWith(prefix)) {
      const seq = parseInt(req.number.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
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

/** Tauri：DB 为空时从 localStorage 一次性导入并清空 */
async function migrateFromLocalStorageIfNeeded(): Promise<void> {
  if (!isTauriRuntime() || migrationDone) return;
  migrationDone = true;

  const existing = await tauriInvoke<Requirement[]>("list_requirements", {});
  if (existing.length > 0) return;

  const local = loadStored();
  if (local.requirements.length === 0) return;

  for (const req of local.requirements) {
    await tauriInvoke<Requirement>("create_requirement", {
      input: {
        content: req.content,
        status: req.status,
        priority: req.priority ?? null,
        dueAt: req.dueAt ?? null,
        proposedAt: req.proposedAt ?? req.createdAt ?? null,
        expectedLaunchAt: req.expectedLaunchAt ?? null,
        actualLaunchAt: req.actualLaunchAt ?? null,
        title: req.title ?? null,
        progressDescription: req.progressDescription ?? null,
        remarks: req.remarks ?? null,
        requester: req.requester ?? null,
        owner: req.owner ?? null,
        source: req.source ?? null,
        id: req.id,
        number: req.number,
        sortOrder: req.sortOrder,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
      },
    });
  }
  clearStored();
}

function localListRequirements(): Requirement[] {
  const data = loadStored();
  return [...data.requirements].sort((a, b) => {
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return a.sortOrder - b.sortOrder;
  });
}

function localCreateRequirement(input: CreateInput): Requirement {
  const data = loadStored();
  const now = Date.now();
  const status = input.status ?? "todo";
  const sortOrder = data.requirements.filter((r) => r.status === status).length;
  const req: Requirement = {
    id: crypto.randomUUID(),
    number: generateRequirementNumber(data.requirements),
    content: input.content.trim(),
    status,
    priority: input.priority,
    sortOrder,
    createdAt: now,
    updatedAt: now,
    dueAt: input.dueAt,
    proposedAt: input.proposedAt ?? now,
    expectedLaunchAt: input.expectedLaunchAt,
    actualLaunchAt: input.actualLaunchAt,
    title: input.title?.trim() || undefined,
    progressDescription: input.progressDescription?.trim() || undefined,
    remarks: input.remarks?.trim() || undefined,
    requester: input.requester?.trim() || undefined,
    owner: input.owner?.trim() || undefined,
    source: input.source?.trim() || undefined,
  };
  data.requirements.push(req);
  saveStored(data);
  return req;
}

function localUpdateRequirement(id: string, patch: RequirementPatch): Requirement {
  const data = loadStored();
  const idx = data.requirements.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("需求不存在");
  const current = data.requirements[idx];
  if ("number" in patch && patch.number !== undefined) {
    const trimmed = patch.number.trim();
    if (!trimmed) throw new Error("需求单号不能为空");
    if (data.requirements.some((r) => r.id !== id && r.number === trimmed)) {
      throw new Error(`需求单号「${trimmed}」已存在`);
    }
  }
  const updated: Requirement = {
    ...current,
    ...("number" in patch && patch.number !== undefined ? { number: patch.number.trim() } : {}),
    ...("content" in patch && patch.content !== undefined ? { content: patch.content } : {}),
    ...("status" in patch && patch.status !== undefined ? { status: patch.status } : {}),
    ...("priority" in patch && patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...("sortOrder" in patch && patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
    ...("dueAt" in patch ? { dueAt: patch.dueAt ?? undefined } : {}),
    ...("proposedAt" in patch ? { proposedAt: patch.proposedAt ?? undefined } : {}),
    ...("expectedLaunchAt" in patch
      ? { expectedLaunchAt: patch.expectedLaunchAt ?? undefined }
      : {}),
    ...("actualLaunchAt" in patch ? { actualLaunchAt: patch.actualLaunchAt ?? undefined } : {}),
    ...("title" in patch ? { title: patch.title?.trim() || undefined } : {}),
    ...("progressDescription" in patch
      ? { progressDescription: patch.progressDescription?.trim() || undefined }
      : {}),
    ...("remarks" in patch ? { remarks: patch.remarks?.trim() || undefined } : {}),
    ...("requester" in patch ? { requester: patch.requester?.trim() || undefined } : {}),
    ...("owner" in patch ? { owner: patch.owner?.trim() || undefined } : {}),
    ...("source" in patch ? { source: patch.source?.trim() || undefined } : {}),
    updatedAt: Date.now(),
  };
  data.requirements[idx] = updated;
  saveStored(data);
  return updated;
}

function localDeleteRequirement(id: string): void {
  const data = loadStored();
  data.requirements = data.requirements.filter((r) => r.id !== id);
  saveStored(data);
}

export async function listRequirements(): Promise<Requirement[]> {
  if (isTauriRuntime()) {
    await migrateFromLocalStorageIfNeeded();
    return tauriInvoke<Requirement[]>("list_requirements", {});
  }
  return localListRequirements();
}

export async function createRequirement(input: CreateInput): Promise<Requirement> {
  return withFallback(
    "create_requirement",
    {
      input: {
        content: input.content,
        status: input.status ?? null,
        priority: input.priority ?? null,
        dueAt: input.dueAt ?? null,
        proposedAt: input.proposedAt ?? null,
        expectedLaunchAt: input.expectedLaunchAt ?? null,
        actualLaunchAt: input.actualLaunchAt ?? null,
        title: input.title ?? null,
        progressDescription: input.progressDescription ?? null,
        remarks: input.remarks ?? null,
        requester: input.requester ?? null,
        owner: input.owner ?? null,
        source: input.source ?? null,
      },
    },
    () => localCreateRequirement(input),
  );
}

export async function updateRequirement(id: string, patch: RequirementPatch): Promise<Requirement> {
  return withFallback("update_requirement", { id, patch }, () => localUpdateRequirement(id, patch));
}

export async function deleteRequirement(id: string): Promise<void> {
  return withFallback(
    "delete_requirement",
    { id },
    () => {
      localDeleteRequirement(id);
    },
  );
}

export async function moveRequirement(
  id: string,
  status: RequirementStatus,
  sortOrder: number,
): Promise<Requirement> {
  return updateRequirement(id, { status, sortOrder });
}

export async function reorderRequirements(
  updates: Array<{ id: string; status: RequirementStatus; sortOrder: number }>,
): Promise<void> {
  return withFallback(
    "reorder_requirements",
    { updates },
    () => {
      const data = loadStored();
      const now = Date.now();
      for (const item of updates) {
        const idx = data.requirements.findIndex((r) => r.id === item.id);
        if (idx === -1) throw new Error("需求不存在");
        data.requirements[idx] = {
          ...data.requirements[idx],
          status: item.status,
          sortOrder: item.sortOrder,
          updatedAt: now,
        };
      }
      saveStored(data);
    },
  );
}
