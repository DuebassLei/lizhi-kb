const KEY = "lizhi-kb-cc-workbench-drawer-width";

/** 对齐原 max-w-3xl (768px) */
export const CC_WORKBENCH_DRAWER_WIDTH_DEFAULT = 768;
export const CC_WORKBENCH_DRAWER_WIDTH_MIN = 520;
export const CC_WORKBENCH_DRAWER_WIDTH_MAX = 1200;

function viewportMaxWidth(): number {
  if (typeof window === "undefined") return CC_WORKBENCH_DRAWER_WIDTH_MAX;
  return Math.floor(window.innerWidth * 0.92);
}

export function clampCcWorkbenchDrawerWidth(px: number): number {
  const max = Math.min(CC_WORKBENCH_DRAWER_WIDTH_MAX, viewportMaxWidth());
  return Math.min(max, Math.max(CC_WORKBENCH_DRAWER_WIDTH_MIN, Math.round(px)));
}

export function loadStoredCcWorkbenchDrawerWidth(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clampCcWorkbenchDrawerWidth(CC_WORKBENCH_DRAWER_WIDTH_DEFAULT);
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return clampCcWorkbenchDrawerWidth(CC_WORKBENCH_DRAWER_WIDTH_DEFAULT);
    return clampCcWorkbenchDrawerWidth(n);
  } catch {
    return clampCcWorkbenchDrawerWidth(CC_WORKBENCH_DRAWER_WIDTH_DEFAULT);
  }
}

export function saveCcWorkbenchDrawerWidth(px: number): void {
  try {
    localStorage.setItem(KEY, String(clampCcWorkbenchDrawerWidth(px)));
  } catch {
    /* ignore quota */
  }
}
