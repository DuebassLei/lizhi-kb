/** Word 导出模板偏好（localStorage） */

export type DocxThemeId = "tech" | "office" | "proposal";

const KEY = "lizhi-kb-docx-theme";

export const DEFAULT_DOCX_THEME: DocxThemeId = "tech";

export const DOCX_THEME_IDS: readonly DocxThemeId[] = ["tech", "office", "proposal"] as const;

export function isDocxThemeId(value: string | null | undefined): value is DocxThemeId {
  return value === "tech" || value === "office" || value === "proposal";
}

export function loadStoredDocxTheme(): DocxThemeId {
  const stored = localStorage.getItem(KEY);
  return isDocxThemeId(stored) ? stored : DEFAULT_DOCX_THEME;
}

export function saveDocxTheme(themeId: DocxThemeId) {
  localStorage.setItem(KEY, themeId);
}
