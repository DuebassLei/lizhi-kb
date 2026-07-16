import type { CardFormatId } from "../../types/knowledgeCards";

/**
 * 皮肤仅作可选基底；画廊主题一律 plain，外壳+MD 写在本主题 CSS。
 */
export type CardSkin = "plain" | "default";

export const CARD_SKIN_LABELS: Record<CardSkin, string> = {
  plain: "一体样式",
  default: "默认",
};

export const CARD_SKIN_OPTIONS = (
  Object.entries(CARD_SKIN_LABELS) as [CardSkin, string][]
).map(([id, label]) => ({ id, label }));

export type ThemeGroupId =
  | "cartoon"
  | "pro"
  | "fun"
  | "cute"
  | "tech"
  | "custom";

export interface CardTheme {
  id: string;
  name: string;
  group?: ThemeGroupId;
  description?: string;
  format: CardFormatId;
  colors: {
    background: string;
    text: string;
    heading: string;
    accent: string;
    codeBackground: string;
    codeText: string;
    blockquoteBorder: string;
    blockquoteBackground: string;
    frame?: string;
    headingGradient?: string;
    highlight?: string;
  };
  typography: {
    fontFamily: string;
    headingFontFamily: string;
    baseFontSize: number;
    headingScale: [number, number, number, number, number, number];
    lineHeight: number;
    headingWeight: number;
    textWeight: number;
    textAlign?: "left" | "center";
  };
  spacing: {
    padding: [number, number, number, number];
    blockGap: number;
    paragraphGap: number;
  };
  border: {
    width: number;
    style: "solid" | "dashed" | "dotted" | "double" | "none";
    color: string;
    radius: number;
    doubleInset?: boolean;
  };
  decorations: {
    corners?: "none" | "flower" | "triangle" | "dot" | "wave";
    watermark?: string;
    watermarkPosition?: "none" | "footer-left" | "footer-right" | "footer-center";
    headerStyle?: "none" | "minimal" | "banner" | "badge";
    footerStyle?: "none" | "page-number" | "dots" | "progress-bar" | "letter-meta" | "brand";
    backgroundImage?: string;
    backgroundMode?: "cover" | "contain" | "repeat";
    brandLabel?: string;
    mascot?: "none" | "stamp" | "pixel";
    topAccentBar?: boolean;
    heroMode?: "first-h1" | "off";
    /** 画廊主题固定 plain；一体样式在 customCSS */
    skin?: CardSkin;
  };
  /** 外壳 + MD 语法，通常来自同名 .css?raw */
  customCSS?: string;
  builtin?: boolean;
}

/** 剥离遗留 chrome / windowTitle */
export function normalizeThemeShell(theme: CardTheme): CardTheme {
  if (!theme || typeof theme !== "object") {
    throw new Error("invalid custom theme");
  }
  const decorations = {
    ...(theme.decorations && typeof theme.decorations === "object"
      ? theme.decorations
      : {}),
  } as CardTheme["decorations"] & {
    chrome?: unknown;
    windowTitle?: unknown;
  };
  delete decorations.chrome;
  delete decorations.windowTitle;
  return {
    ...theme,
    decorations: {
      ...decorations,
      skin: decorations.skin ?? "plain",
    },
    customCSS: typeof theme.customCSS === "string" ? theme.customCSS : "",
  };
}

export const THEME_GROUP_LABELS: Record<ThemeGroupId, string> = {
  cartoon: "卡通",
  pro: "专业",
  fun: "趣味",
  cute: "可爱",
  tech: "科技",
  custom: "自定义",
};

export function themeToCssVars(theme: CardTheme): Record<string, string> {
  const [pt, pr, pb, pl] = theme.spacing.padding;
  const [h1, h2, h3, h4, h5, h6] = theme.typography.headingScale;
  return {
    "--card-bg": theme.colors.background,
    "--card-text": theme.colors.text,
    "--card-heading": theme.colors.heading,
    "--card-accent": theme.colors.accent,
    "--card-code-bg": theme.colors.codeBackground,
    "--card-code-text": theme.colors.codeText,
    "--card-quote-border": theme.colors.blockquoteBorder,
    "--card-quote-bg": theme.colors.blockquoteBackground,
    "--card-frame": theme.colors.frame ?? "transparent",
    "--card-heading-gradient": theme.colors.headingGradient ?? "none",
    "--card-highlight": theme.colors.highlight ?? theme.colors.accent,
    "--card-font-family": theme.typography.fontFamily,
    "--card-heading-font": theme.typography.headingFontFamily,
    "--card-font-size": `${theme.typography.baseFontSize}px`,
    "--card-line-height": String(theme.typography.lineHeight),
    "--card-heading-weight": String(theme.typography.headingWeight),
    "--card-text-weight": String(theme.typography.textWeight),
    "--card-text-align": theme.typography.textAlign ?? "left",
    "--card-h1": String(h1),
    "--card-h2": String(h2),
    "--card-h3": String(h3),
    "--card-h4": String(h4),
    "--card-h5": String(h5),
    "--card-h6": String(h6),
    "--card-padding-top": `${pt}px`,
    "--card-padding-right": `${pr}px`,
    "--card-padding-bottom": `${pb}px`,
    "--card-padding-left": `${pl}px`,
    "--card-block-gap": `${theme.spacing.blockGap}px`,
    "--card-paragraph-gap": `${theme.spacing.paragraphGap}px`,
    "--card-border-width": `${theme.border.width}px`,
    "--card-border-style": theme.border.style,
    "--card-border-color": theme.border.color,
    "--card-border-radius": `${theme.border.radius}px`,
  };
}
