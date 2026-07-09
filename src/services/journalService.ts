import { tauriInvoke } from "../composables/useTauriCommand";
import type { JournalEntry } from "../types/journal";
import { todayDayDate } from "../utils/journalDates";

const STORAGE_KEY = "lizhi-kb-journal";

interface StoredData {
  entries: JournalEntry[];
}

type CreateInput = {
  content: string;
  dayDate?: string;
};

function isTauriRuntime(): boolean {
  return !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

function loadStored(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw) as StoredData;
    return { entries: parsed.entries ?? [] };
  } catch {
    return { entries: [] };
  }
}

function saveStored(data: StoredData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearStored(): void {
  localStorage.removeItem(STORAGE_KEY);
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

  const existing = await tauriInvoke<JournalEntry[]>("list_journal_entries", {});
  if (existing.length > 0) return;

  const local = loadStored();
  if (local.entries.length === 0) return;

  for (const entry of local.entries) {
    await tauriInvoke<JournalEntry>("create_journal_entry", {
      input: {
        content: entry.content,
        dayDate: entry.dayDate,
        id: entry.id,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
    });
  }
  clearStored();
}

function localListEntries(): JournalEntry[] {
  const data = loadStored();
  return [...data.entries].sort((a, b) => {
    if (a.dayDate !== b.dayDate) return b.dayDate.localeCompare(a.dayDate);
    return b.createdAt - a.createdAt;
  });
}

function localCreateEntry(input: CreateInput): JournalEntry {
  const data = loadStored();
  const now = Date.now();
  const entry: JournalEntry = {
    id: crypto.randomUUID(),
    dayDate: input.dayDate ?? todayDayDate(),
    content: input.content.trim(),
    createdAt: now,
    updatedAt: now,
  };
  data.entries.push(entry);
  saveStored(data);
  return entry;
}

function localUpdateEntry(id: string, content: string): JournalEntry {
  const data = loadStored();
  const idx = data.entries.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error("小记不存在");
  const updated: JournalEntry = {
    ...data.entries[idx],
    content: content.trim(),
    updatedAt: Date.now(),
  };
  data.entries[idx] = updated;
  saveStored(data);
  return updated;
}

function localDeleteEntry(id: string): void {
  const data = loadStored();
  data.entries = data.entries.filter((e) => e.id !== id);
  saveStored(data);
}

export async function listJournalEntries(): Promise<JournalEntry[]> {
  if (isTauriRuntime()) {
    await migrateFromLocalStorageIfNeeded();
    return tauriInvoke<JournalEntry[]>("list_journal_entries", {});
  }
  return localListEntries();
}

export async function createJournalEntry(input: CreateInput): Promise<JournalEntry> {
  return withFallback(
    "create_journal_entry",
    {
      input: {
        content: input.content,
        dayDate: input.dayDate ?? null,
      },
    },
    () => localCreateEntry(input),
  );
}

export async function updateJournalEntry(id: string, content: string): Promise<JournalEntry> {
  return withFallback(
    "update_journal_entry",
    { id, patch: { content } },
    () => localUpdateEntry(id, content),
  );
}

export async function deleteJournalEntry(id: string): Promise<void> {
  return withFallback(
    "delete_journal_entry",
    { id },
    () => {
      localDeleteEntry(id);
    },
  );
}
