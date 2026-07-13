const KEY = "insights-motion-seen";

export function hasInsightsMotionPlayed(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markInsightsMotionPlayed(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}
