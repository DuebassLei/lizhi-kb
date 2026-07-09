const KEY = "lizhi-kb-sidebar-width";

export const SIDEBAR_WIDTH_DEFAULT = 260;
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 480;

export function loadStoredSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SIDEBAR_WIDTH_DEFAULT;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return SIDEBAR_WIDTH_DEFAULT;
    return clampSidebarWidth(n);
  } catch {
    return SIDEBAR_WIDTH_DEFAULT;
  }
}

export function saveSidebarWidth(px: number): void {
  try {
    localStorage.setItem(KEY, String(clampSidebarWidth(px)));
  } catch {
    /* ignore quota */
  }
}

export function clampSidebarWidth(px: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(px)));
}
