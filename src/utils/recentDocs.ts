import { schedulePersistVaultUiState } from "../services/vaultUiStateService";
import {
  readRecentDocIdsFromStorage,
  writeRecentDocIdsToStorage,
} from "./vaultUiStateLocalStorage";

const MAX_RECENT = 12;

export function loadRecentDocIds(): string[] {
  return readRecentDocIdsFromStorage();
}

export function touchRecentDocId(id: string): string[] {
  const prev = loadRecentDocIds().filter((x) => x !== id);
  const next = [id, ...prev].slice(0, MAX_RECENT);
  writeRecentDocIdsToStorage(next);
  schedulePersistVaultUiState();
  return next;
}

export function saveRecentDocIds(ids: string[]): void {
  writeRecentDocIdsToStorage(ids.slice(0, MAX_RECENT));
  schedulePersistVaultUiState();
}
