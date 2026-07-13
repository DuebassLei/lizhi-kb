export const INSIGHTS_HERO_BG_KEY = "lizhi-kb-insights-hero-bg";

export function readInsightsHeroBackgroundFromStorage(): string | null {
  try {
    const v = localStorage.getItem(INSIGHTS_HERO_BG_KEY);
    if (!v || !v.startsWith("data:image/")) return null;
    return v;
  } catch {
    return null;
  }
}

export function writeInsightsHeroBackgroundToStorage(dataUrl: string): void {
  localStorage.setItem(INSIGHTS_HERO_BG_KEY, dataUrl);
}

export function removeInsightsHeroBackgroundFromStorage(): void {
  localStorage.removeItem(INSIGHTS_HERO_BG_KEY);
}
