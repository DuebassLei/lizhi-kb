import { schedulePersistVaultUiState } from "../services/vaultUiStateService";
import {
  readPinnedDocIdsFromStorage,
  writePinnedDocIdsToStorage,
} from "./vaultUiStateLocalStorage";

export function loadPinnedIds(): string[] {
  return readPinnedDocIdsFromStorage();
}

export function savePinnedIds(ids: string[]): void {
  writePinnedDocIdsToStorage(ids);
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
