import { schedulePersistVaultUiState } from "../services/vaultUiStateService";

const KEY = "lizhi-kb-insights-hero-bg";

export function loadInsightsHeroBackground(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    if (!v || !v.startsWith("data:image/")) return null;
    return v;
  } catch {
    return null;
  }
}

export function saveInsightsHeroBackground(dataUrl: string): void {
  localStorage.setItem(KEY, dataUrl);
  schedulePersistVaultUiState();
}

export function clearInsightsHeroBackground(): void {
  localStorage.removeItem(KEY);
  schedulePersistVaultUiState();
}
