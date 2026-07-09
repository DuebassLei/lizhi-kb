import {
  DEFAULT_QUICK_NAV_VISIBILITY,
  QUICK_NAV_ITEMS,
  type QuickNavId,
  type QuickNavVisibility,
} from "../constants/quickNav";

const KEY = "lizhi-kb-quick-nav";

const VALID_IDS = new Set<QuickNavId>(QUICK_NAV_ITEMS.map((item) => item.id));

function isQuickNavId(value: unknown): value is QuickNavId {
  return typeof value === "string" && VALID_IDS.has(value as QuickNavId);
}

export function loadStoredQuickNavVisibility(): QuickNavVisibility {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_QUICK_NAV_VISIBILITY };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_QUICK_NAV_VISIBILITY };

    const next = { ...DEFAULT_QUICK_NAV_VISIBILITY };
    for (const [key, value] of Object.entries(parsed)) {
      if (isQuickNavId(key) && typeof value === "boolean") {
        next[key] = value;
      }
    }
    return next;
  } catch {
    return { ...DEFAULT_QUICK_NAV_VISIBILITY };
  }
}

export function saveQuickNavVisibility(visibility: QuickNavVisibility): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(visibility));
  } catch {
    /* ignore */
  }
}
