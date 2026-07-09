import type { ThemeId } from "../stores/ui";

const KEY = "lizhi-kb-theme";

const SHARED_ACCENTS = {
  "--color-paw": "#d4a574",
  "--color-secure": "#4ade9a",
  "--color-warning": "#e8b86d",
  "--color-hold": "#a899c8",
};

const LINK_DARK = {
  "--color-link": "#6b9fd8",
  "--color-link-hover": "#8ab4e8",
};

/** 浅色底上提高链接对比度（WCAG AA 友好） */
const LINK_LIGHT = {
  "--color-link": "#3a6fa8",
  "--color-link-hover": "#4d84bc",
};

const SHADOW_DARK = {
  "--shadow-float": "0 8px 32px rgba(0, 0, 0, 0.45)",
  "--shadow-inset": "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
};

const SHADOW_LIGHT = {
  "--shadow-float": "0 8px 32px rgba(0, 0, 0, 0.12)",
  "--shadow-inset": "inset 0 1px 0 rgba(0, 0, 0, 0.04)",
};

const SHADOW_WARM = {
  "--shadow-float": "0 8px 32px rgba(42, 38, 32, 0.16)",
  "--shadow-inset": "inset 0 1px 0 rgba(0, 0, 0, 0.05)",
};

const THEMES: Record<ThemeId, Record<string, string>> = {
  dark: {
    ...SHARED_ACCENTS,
    ...LINK_DARK,
    ...SHADOW_DARK,
    "--color-base": "#1a1d23",
    "--color-canvas": "#1e2128",
    "--color-surface-0": "#252932",
    "--color-surface-1": "#2d333f",
    "--color-surface-2": "#363d4a",
    "--color-surface-3": "#3f4756",
    "--color-text": "#e3e5e8",
    "--color-text-secondary": "#a0a6b0",
    "--color-muted": "#787f8c",
    "--color-danger": "#f07070",
  },
  light: {
    ...SHARED_ACCENTS,
    ...LINK_LIGHT,
    ...SHADOW_LIGHT,
    "--color-base": "#f5f6f8",
    "--color-canvas": "#ffffff",
    "--color-surface-0": "#ffffff",
    "--color-surface-1": "#f0f1f3",
    "--color-surface-2": "#e4e7ed",
    "--color-surface-3": "#d8dce4",
    "--color-text": "#1a1d23",
    "--color-text-secondary": "#5c6370",
    "--color-muted": "#787f8c",
    "--color-danger": "#dc2626",
  },
  warm: {
    ...SHARED_ACCENTS,
    ...LINK_LIGHT,
    ...SHADOW_WARM,
    "--color-base": "#e4ddd0",
    "--color-canvas": "#eae3d6",
    "--color-surface-0": "#eae3d6",
    "--color-surface-1": "#ded6c8",
    "--color-surface-2": "#d1c9bb",
    "--color-surface-3": "#c4bcae",
    "--color-text": "#2a2620",
    "--color-text-secondary": "#574f44",
    "--color-muted": "#7a7166",
    "--color-danger": "#b85444",
  },
  eye: {
    ...SHARED_ACCENTS,
    ...LINK_DARK,
    ...SHADOW_DARK,
    "--color-base": "#1a1814",
    "--color-canvas": "#1e1b16",
    "--color-surface-0": "#221f1a",
    "--color-surface-1": "#2a2620",
    "--color-surface-2": "#332e27",
    "--color-surface-3": "#3d3730",
    "--color-text": "#e8e0d4",
    "--color-text-secondary": "#a89e8e",
    "--color-muted": "#8a8070",
    "--color-danger": "#e07a6a",
  },
};

export const THEME_OPTIONS: { id: ThemeId; label: string; preview: string }[] = [
  { id: "dark", label: "深色 · 墨巢", preview: THEMES.dark["--color-base"] },
  { id: "light", label: "浅色", preview: THEMES.light["--color-base"] },
  { id: "warm", label: "米白 · 暖色", preview: THEMES.warm["--color-base"] },
  { id: "eye", label: "护眼", preview: THEMES.eye["--color-base"] },
];

function isLightTheme(theme: ThemeId): boolean {
  return theme === "light" || theme === "warm";
}

export { isLightTheme };

/** Sync derived tokens after theme vars are applied. */
function syncDerivedTokens(root: HTMLElement) {
  root.style.setProperty("--color-ink", "var(--color-base)");
  root.style.setProperty("--color-surface", "var(--color-surface-0)");
  root.style.setProperty("--color-elevated", "var(--color-surface-1)");
  root.style.setProperty("--color-panel", "var(--color-surface-1)");
  root.style.setProperty(
    "--color-border",
    "color-mix(in srgb, var(--color-text) 8%, transparent)",
  );
  root.style.setProperty(
    "--color-border-strong",
    "color-mix(in srgb, var(--color-text) 14%, transparent)",
  );
  root.style.setProperty(
    "--color-divider",
    "color-mix(in srgb, var(--color-text) 5%, transparent)",
  );
  root.style.setProperty(
    "--color-overlay",
    "color-mix(in srgb, var(--color-base) 72%, transparent)",
  );
  root.style.setProperty(
    "--color-link-muted",
    "color-mix(in srgb, var(--color-link) 18%, transparent)",
  );
  root.style.setProperty(
    "--color-paw-muted",
    "color-mix(in srgb, var(--color-paw) 22%, transparent)",
  );
}

export function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = isLightTheme(theme) ? "light" : "dark";
  const vars = THEMES[theme];
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
  syncDerivedTokens(root);
  localStorage.setItem(KEY, theme);
}

export function loadStoredTheme(): ThemeId {
  const v = localStorage.getItem(KEY);
  if (v === "light" || v === "warm" || v === "eye" || v === "dark") return v;
  return "dark";
}
