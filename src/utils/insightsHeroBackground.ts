import { schedulePersistVaultUiState } from "../services/vaultUiStateService";
import {
  readInsightsHeroBackgroundFromStorage,
  removeInsightsHeroBackgroundFromStorage,
  writeInsightsHeroBackgroundToStorage,
} from "./insightsHeroBackgroundStorage";

export function loadInsightsHeroBackground(): string | null {
  return readInsightsHeroBackgroundFromStorage();
}

export function saveInsightsHeroBackground(dataUrl: string): void {
  writeInsightsHeroBackgroundToStorage(dataUrl);
  schedulePersistVaultUiState();
}

export function clearInsightsHeroBackground(): void {
  removeInsightsHeroBackgroundFromStorage();
  schedulePersistVaultUiState();
}
