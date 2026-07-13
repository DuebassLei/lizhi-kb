import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "./vaultService";
import type {
  CreateCredentialInput,
  CredentialCategory,
  CredentialEntry,
  CredentialEntryListItem,
  CredentialEnvironment,
  UpdateCredentialPatch,
} from "../types/credential";

const STORAGE_KEY = "lizhi-kb-credentials";

interface StoredData {
  entries: CredentialEntry[];
}

export interface CredentialListFilter {
  category?: string;
  environment?: string;
  favoritesOnly?: boolean;
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

function toListItem(entry: CredentialEntry): CredentialEntryListItem {
  return {
    id: entry.id,
    title: entry.title,
    category: entry.category,
    environment: entry.environment,
    username: entry.username,
    passwordMasked: entry.password ? "••••••••" : "",
    url: entry.url,
    notes: entry.notes,
    isFavorite: entry.isFavorite,
    sortOrder: entry.sortOrder,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
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

  const existing = await tauriInvoke<CredentialEntryListItem[]>("list_credential_entries", {
    filter: {},
  });
  if (existing.length > 0) return;

  const local = loadStored();
  if (local.entries.length === 0) return;

  for (const entry of local.entries) {
    await tauriInvoke<CredentialEntry>("create_credential_entry", {
      input: {
        title: entry.title,
        category: entry.category,
        environment: entry.environment,
        username: entry.username,
        password: entry.password,
        url: entry.url ?? null,
        notes: entry.notes ?? null,
        isFavorite: entry.isFavorite,
        sortOrder: entry.sortOrder,
        id: entry.id,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
    });
  }
  clearStored();
}

function applyLocalFilter(
  entries: CredentialEntryListItem[],
  filter?: CredentialListFilter,
): CredentialEntryListItem[] {
  if (!filter) return entries;
  let result = entries;
  if (filter.category === "favorites" || filter.favoritesOnly) {
    result = result.filter((e) => e.isFavorite);
  } else if (filter.category && filter.category !== "all") {
    result = result.filter((e) => e.category === filter.category);
  }
  if (filter.environment && filter.environment !== "all") {
    result = result.filter((e) => e.environment === filter.environment);
  }
  return result;
}

function localListEntries(filter?: CredentialListFilter): CredentialEntryListItem[] {
  const data = loadStored();
  const sorted = [...data.entries].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
  return applyLocalFilter(sorted.map(toListItem), filter);
}

function localGetEntry(id: string): CredentialEntry {
  const entry = loadStored().entries.find((e) => e.id === id);
  if (!entry) throw new Error("凭据不存在");
  return entry;
}

function localCreateEntry(input: CreateCredentialInput): CredentialEntry {
  const data = loadStored();
  const now = Date.now();
  const entry: CredentialEntry = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    category: (input.category ?? "other") as CredentialCategory,
    environment: (input.environment ?? "local") as CredentialEnvironment,
    username: input.username?.trim() ?? "",
    password: input.password ?? "",
    url: input.url?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    isFavorite: input.isFavorite ?? false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  data.entries.push(entry);
  saveStored(data);
  return entry;
}

function localUpdateEntry(id: string, patch: UpdateCredentialPatch): CredentialEntry {
  const data = loadStored();
  const idx = data.entries.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error("凭据不存在");
  const prev = data.entries[idx];
  const updated: CredentialEntry = {
    ...prev,
    title: patch.title?.trim() ?? prev.title,
    category: (patch.category ?? prev.category) as CredentialCategory,
    environment: (patch.environment ?? prev.environment) as CredentialEnvironment,
    username: patch.username ?? prev.username,
    password: patch.password ?? prev.password,
    url: patch.url === undefined ? prev.url : patch.url.trim() || undefined,
    notes: patch.notes === undefined ? prev.notes : patch.notes.trim() || undefined,
    isFavorite: patch.isFavorite ?? prev.isFavorite,
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

export async function listCredentialEntries(
  filter?: CredentialListFilter,
): Promise<CredentialEntryListItem[]> {
  if (isTauriRuntime()) {
    await migrateFromLocalStorageIfNeeded();
    return tauriInvoke<CredentialEntryListItem[]>("list_credential_entries", { filter: filter ?? {} });
  }
  return localListEntries(filter);
}

export async function getCredentialEntry(id: string): Promise<CredentialEntry> {
  return withFallback("get_credential_entry", { id }, () => localGetEntry(id));
}

export async function createCredentialEntry(input: CreateCredentialInput): Promise<CredentialEntry> {
  return withFallback(
    "create_credential_entry",
    {
      input: {
        title: input.title,
        category: input.category ?? null,
        environment: input.environment ?? null,
        username: input.username ?? null,
        password: input.password ?? null,
        url: input.url ?? null,
        notes: input.notes ?? null,
        isFavorite: input.isFavorite ?? null,
      },
    },
    () => localCreateEntry(input),
  );
}

export async function updateCredentialEntry(
  id: string,
  patch: UpdateCredentialPatch,
): Promise<CredentialEntry> {
  return withFallback("update_credential_entry", { id, patch }, () => localUpdateEntry(id, patch));
}

export async function deleteCredentialEntry(id: string): Promise<void> {
  return withFallback(
    "delete_credential_entry",
    { id },
    () => {
      localDeleteEntry(id);
    },
  );
}
