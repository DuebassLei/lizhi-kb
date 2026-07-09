import { schedulePersistVaultUiState } from "../services/vaultUiStateService";

const STORAGE_KEY = "lizhi-kb-recent-docs";
const MAX_RECENT = 12;

export function loadRecentDocIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function touchRecentDocId(id: string): string[] {
  const prev = loadRecentDocIds().filter((x) => x !== id);
  const next = [id, ...prev].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  schedulePersistVaultUiState();
  return next;
}

export function saveRecentDocIds(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  schedulePersistVaultUiState();
}
