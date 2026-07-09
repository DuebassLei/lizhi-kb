/**
 * 公众号 Markdown 主题（自 md-wechat-editor 完整迁移）
 */
import blue from "./markdownThemes/blue";
import blueCyan from "./markdownThemes/blueCyan";
import cyan from "./markdownThemes/cyan";
import green from "./markdownThemes/green";
import ink from "./markdownThemes/ink";
import normal from "./markdownThemes/normal";
import orangeHeart from "./markdownThemes/orangeHeart";
import red from "./markdownThemes/red";
import shanchui from "./markdownThemes/shanchui";
import simple from "./markdownThemes/simple";
import rose from "./markdownThemes/rose";
import cuteGreen from "./markdownThemes/cuteGreen";
import fullStackBlue from "./markdownThemes/fullStackBlue";
import nightPurple from "./markdownThemes/nightPurple";
import extremeBlack from "./markdownThemes/extremeBlack";
import cupidBusy from "./markdownThemes/cupidBusy";
import aiIndigo from "./markdownThemes/aiIndigo";
import { PRO_THEME_DEFINITIONS, PRO_THEMES } from "./markdownThemes/pro/generated";
import {
  EDITORIAL_THEME_DEFINITIONS,
  EDITORIAL_THEMES,
} from "./markdownThemes/editorial/generated";
import {
  CREATIVE_THEME_DEFINITIONS,
  CREATIVE_THEMES,
} from "./markdownThemes/creative/generated";
import {
  DRAFT_THEME_DEFINITIONS,
  DRAFT_THEMES,
} from "./markdownThemes/drafts/generated";
import { sanitizeDraftThemeCssForWechat } from "./markdownThemes/drafts/sanitizeWechatCss";
import { DRAFT_THEME_IDS, DRAFT_WECHAT_DECOR } from "./markdownThemes/drafts/wechatDecor";
import { applyDraftWechatDecor } from "./markdownThemes/drafts/applyDraftWechatDecor";
import { groupThemeOptions, type ThemeGroup } from "./themeGroups";

export type WechatThemeId = string;
export type ThemeTier = "basic" | "pro";
export type WechatThemeCategory = string;

export interface WechatThemeMeta {
  id: WechatThemeId;
  name: string;
  accent: string;
  bg: string;
  tier: ThemeTier;
  series?: string;
  description?: string;
}

const BASIC_THEME_IDS = new Set([
  "normal",
  "simple",
  "green",
  "blue",
  "cyan",
  "red",
  "orangeHeart",
]);

function tierFor(id: string): ThemeTier {
  return BASIC_THEME_IDS.has(id) ? "basic" : "pro";
}

/** 经典主题色板（布局模块强调色） */
const BASE_THEME_COLORS: Record<string, { accent: string; bg: string }> = {
  normal: { accent: "#78716c", bg: "#fafaf9" },
  shanchui: { accent: "#b8860b", bg: "#fffbeb" },
  rose: { accent: "#7c5cad", bg: "#f6eeff" },
  fullStackBlue: { accent: "#2563eb", bg: "#eff6ff" },
  nightPurple: { accent: "#5b4b8a", bg: "#f5f3ff" },
  cuteGreen: { accent: "#5c8a5c", bg: "#f0fdf4" },
  extremeBlack: { accent: "#292524", bg: "#f5f5f4" },
  orangeHeart: { accent: "#ea580c", bg: "#fff7ed" },
  ink: { accent: "#1c1917", bg: "#f5f5f4" },
  green: { accent: "#16a34a", bg: "#f0fdf4" },
  blue: { accent: "#2563eb", bg: "#eff6ff" },
  cyan: { accent: "#0891b2", bg: "#ecfeff" },
  red: { accent: "#dc2626", bg: "#fef2f2" },
  blueCyan: { accent: "#0e7490", bg: "#ecfeff" },
  simple: { accent: "#a8a29e", bg: "#fafaf9" },
  cupidBusy: { accent: "#e11d48", bg: "#fff1f2" },
  aiIndigo: { accent: "#4f46e5", bg: "#eef2ff" },
};

const BASE_THEME_OPTIONS = [
  { id: "normal", name: "默认主题" },
  { id: "shanchui", name: "山吹" },
  { id: "rose", name: "蔷薇紫" },
  { id: "fullStackBlue", name: "全栈蓝" },
  { id: "nightPurple", name: "凝夜紫" },
  { id: "cuteGreen", name: "萌绿" },
  { id: "extremeBlack", name: "极简黑" },
  { id: "orangeHeart", name: "橙心" },
  { id: "ink", name: "墨黑" },
  { id: "green", name: "绿意" },
  { id: "blue", name: "蓝色" },
  { id: "cyan", name: "青色" },
  { id: "red", name: "红色" },
  { id: "blueCyan", name: "蓝青" },
  { id: "simple", name: "简洁" },
  { id: "cupidBusy", name: "丘比特忙" },
  { id: "aiIndigo", name: "AI 靛紫" },
] as const;

function lightTint(hex: string): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return "#f8fafc";
  const r = Math.min(255, Math.round(parseInt(m[1], 16) * 0.12 + 255 * 0.88));
  const g = Math.min(255, Math.round(parseInt(m[2], 16) * 0.12 + 255 * 0.88));
  const b = Math.min(255, Math.round(parseInt(m[3], 16) * 0.12 + 255 * 0.88));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export const WECHAT_THEMES: WechatThemeMeta[] = [
  ...BASE_THEME_OPTIONS.map((t) => {
    const colors = BASE_THEME_COLORS[t.id] ?? { accent: "#78716c", bg: "#fafaf9" };
    return {
      id: t.id,
      name: t.name,
      accent: colors.accent,
      bg: colors.bg,
      tier: tierFor(t.id),
    };
  }),
  ...DRAFT_THEME_DEFINITIONS.map((t) => ({
    id: t.id,
    name: t.name,
    accent: t.primary,
    bg: lightTint(t.primary),
    tier: "pro" as const,
    series: t.series,
    description: t.description,
  })),
  ...CREATIVE_THEME_DEFINITIONS.map((t) => ({
    id: t.id,
    name: t.name,
    accent: t.primary,
    bg: lightTint(t.primary),
    tier: "pro" as const,
    series: t.series,
    description: t.description,
  })),
  ...EDITORIAL_THEME_DEFINITIONS.map((t) => ({
    id: t.id,
    name: t.name,
    accent: t.primary,
    bg: t.background?.toLowerCase() === "#ffffff" ? lightTint(t.primary) : t.background,
    tier: "pro" as const,
    series: t.series,
    description: t.description,
  })),
  ...PRO_THEME_DEFINITIONS.map((t) => ({
    id: t.id,
    name: t.name,
    accent: t.accent,
    bg: t.bg,
    tier: "pro" as const,
    series: t.series,
  })),
];

const THEME_BY_ID = new Map(WECHAT_THEMES.map((t) => [t.id, t]));

export const THEME_CSS: Record<string, string> = {
  blue,
  blueCyan,
  normal,
  cyan,
  green,
  ink,
  orangeHeart,
  red,
  shanchui,
  simple,
  rose,
  cuteGreen,
  fullStackBlue,
  nightPurple,
  extremeBlack,
  cupidBusy,
  aiIndigo,
  ...DRAFT_THEMES,
  ...CREATIVE_THEMES,
  ...EDITORIAL_THEMES,
  ...PRO_THEMES,
};

const THEME_PATCHES: Record<string, string> = {
  rose: `
#nice h1 .content,
#nice h2 .content,
#nice h3 .content,
#nice h4 .content,
#nice strong {
  color: #664D9D !important;
}
#nice a {
  color: #664D9D !important;
  border-bottom-color: #664D9D !important;
}
#nice blockquote {
  border-color: #DEC6FB !important;
  background: #F6EEFF !important;
}
`,
};

/** 旧版狸知简化主题 → 完整主题映射 */
const LEGACY_THEME_MAP: Record<string, WechatThemeId> = {
  lizhiClassic: "orangeHeart",
  lizhiClean: "simple",
  lizhiTech: "fullStackBlue",
  lizhiForest: "green",
  lizhiRose: "rose",
  lizhiAmber: "orangeHeart",
  lizhiOcean: "cyan",
  lizhiPurple: "nightPurple",
  lizhiInk: "ink",
  lizhiWarm: "proElegant01",
  lizhiMidnight: "aiIndigo",
  lizhiEditorial: "newspaperColumn",
  lizhiMint: "cuteGreen",
  lizhiCoral: "cupidBusy",
  lizhiSlate: "blueCyan",
};

export const DEFAULT_WECHAT_THEME: WechatThemeId = "normal";

export function normalizeThemeId(id: string | null | undefined): WechatThemeId {
  if (!id) return DEFAULT_WECHAT_THEME;
  const mapped = LEGACY_THEME_MAP[id] ?? id;
  if (mapped in THEME_CSS) return mapped;
  return DEFAULT_WECHAT_THEME;
}

export function getThemeCss(themeId: WechatThemeId, rootSelector = "#nice"): string {
  const id = normalizeThemeId(themeId);
  let baseCss = THEME_CSS[id] || THEME_CSS.normal || "";
  if (DRAFT_THEME_IDS.has(id)) {
    baseCss = sanitizeDraftThemeCssForWechat(baseCss);
  }
  baseCss = baseCss.replace(/#nice/g, rootSelector);
  const patchCss = (THEME_PATCHES[id] || "").replace(/#nice/g, rootSelector);
  return `${baseCss}\n${patchCss}`;
}

/** 草案主题注入微信兼容 DOM 装饰（替代 ::before/::after） */
export function applyThemeWechatDecor(html: string, themeId: WechatThemeId): string {
  const id = normalizeThemeId(themeId);
  const decor = DRAFT_WECHAT_DECOR[id];
  if (!decor) return html;
  return applyDraftWechatDecor(html, decor);
}

export function getWechatThemeGroups(): ThemeGroup<WechatThemeMeta>[] {
  return groupThemeOptions(WECHAT_THEMES);
}

/** @deprecated 分组标签由 themeGroups 管理，保留兼容导出 */
export const WECHAT_THEME_GROUP_LABELS: Record<string, string> = Object.fromEntries(
  getWechatThemeGroups().map((g) => [g.label, g.label]),
);

const STORAGE_KEY = "lizhi-kb-wechat-theme";

export function loadStoredWechatTheme(): WechatThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeThemeId(raw);
  } catch {
    return DEFAULT_WECHAT_THEME;
  }
}

export function saveWechatTheme(id: WechatThemeId): void {
  localStorage.setItem(STORAGE_KEY, normalizeThemeId(id));
}

export function getThemeAccent(themeId: WechatThemeId): string {
  const id = normalizeThemeId(themeId);
  return THEME_BY_ID.get(id)?.accent ?? "#78716c";
}

export function getThemeBg(themeId: WechatThemeId): string {
  const id = normalizeThemeId(themeId);
  return THEME_BY_ID.get(id)?.bg ?? "#fafaf9";
}

export {
  DRAFT_THEME_IDS,
  DRAFT_WECHAT_DECOR,
  applyDraftWechatDecor,
  sanitizeDraftThemeCssForWechat,
};
