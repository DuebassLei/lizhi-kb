const KEY = "lizhi-kb-split-editor-ratio";

/** 默认约等于原 flex 1.1 : 1 */
export const SPLIT_EDITOR_RATIO_DEFAULT = 0.524;
export const SPLIT_EDITOR_RATIO_MIN = 0.32;
export const SPLIT_EDITOR_RATIO_MAX = 0.78;

export function clampSplitEditorRatio(ratio: number): number {
  return Math.min(
    SPLIT_EDITOR_RATIO_MAX,
    Math.max(SPLIT_EDITOR_RATIO_MIN, ratio),
  );
}

export function loadStoredSplitEditorRatio(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SPLIT_EDITOR_RATIO_DEFAULT;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return SPLIT_EDITOR_RATIO_DEFAULT;
    return clampSplitEditorRatio(n);
  } catch {
    return SPLIT_EDITOR_RATIO_DEFAULT;
  }
}

export function saveSplitEditorRatio(ratio: number): void {
  try {
    localStorage.setItem(KEY, String(clampSplitEditorRatio(ratio)));
  } catch {
    /* ignore quota */
  }
}
