import { schedulePersistVaultUiState } from "../services/vaultUiStateService";

const PINNED_KEY = "lizhi-kb-pinned";

export function loadPinnedIds(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function savePinnedIds(ids: string[]): void {
  localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
  schedulePersistVaultUiState();
}

export function togglePinnedId(id: string): string[] {
  const current = loadPinnedIds();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [id, ...current];
  savePinnedIds(next);
  return next;
}

export function isPinnedId(id: string): boolean {
  return loadPinnedIds().includes(id);
}
