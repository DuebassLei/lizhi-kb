export type PreviewThemeId = "classic" | "document" | "compact" | "mono";

const KEY = "lizhi-kb-preview-theme";

const VALID: PreviewThemeId[] = ["classic", "document", "compact", "mono"];

export function loadStoredPreviewTheme(): PreviewThemeId {
  const v = localStorage.getItem(KEY);
  if (VALID.includes(v as PreviewThemeId)) return v as PreviewThemeId;
  return "classic";
}

export function savePreviewTheme(theme: PreviewThemeId) {
  localStorage.setItem(KEY, theme);
}
