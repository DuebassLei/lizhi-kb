import type { CardFormatId } from "../../types/knowledgeCards";

/** 卡片外框/装饰布局（决定视觉骨架，不单靠配色） */
export type CardLayoutChrome =
  | "default"
  | "poster"
  | "letter"
  | "window"
  | "nebula"
  | "tech";

/**
 * 统一皮肤：标题（H1/H2/Hero）+ Markdown 语法（加粗/列表/引用/代码）一整套。
 * 由 `.skin-*` class 驱动，不再拆成「标题布局 × 内容皮」。
 */
export type CardSkin =
  | "default"
  | "wechat"
  | "xhs"
  | "cover"
  | "letter"
  | "ink"
  | "sticker"
  | "retro"
  | "nebula"
  | "neon"
  | "tech"
  | "plain";

export const CARD_SKIN_LABELS: Record<CardSkin, string> = {
  default: "默认",
  wechat: "微信贴图",
  xhs: "种草内容",
  cover: "海报封面",
  letter: "信笺启封",
  ink: "水墨长卷",
  sticker: "手帐贴纸",
  retro: "复古窗口",
  nebula: "星云玻璃",
  neon: "午夜霓虹",
  tech: "技术札记",
  plain: "极简",
};

export type ThemeGroupId =
  | "social"
  | "letter"
  | "retro"
  | "modern"
  | "tech"
  | "minimal"
  | "custom";

export interface CardTheme {
  id: string;
  name: string;
  /** 分组（主题选择器） */
  group?: ThemeGroupId;
  /** 一句话描述 */
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
    /** 外框/背景板（nebula 等） */
    frame?: string;
    /** 标题可用渐变（CSS background-image） */
    headingGradient?: string;
    /** 高亮笔触色 */
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
    /** 信笺双线框 */
    doubleInset?: boolean;
  };
  decorations: {
    chrome?: CardLayoutChrome;
    corners?: "none" | "flower" | "triangle" | "dot" | "wave";
    watermark?: string;
    watermarkPosition?: "none" | "footer-left" | "footer-right" | "footer-center";
    headerStyle?: "none" | "minimal" | "banner" | "badge";
    footerStyle?: "none" | "page-number" | "dots" | "progress-bar" | "letter-meta" | "brand";
    backgroundImage?: string;
    backgroundMode?: "cover" | "contain" | "repeat";
    /** 窗口标题栏文案 */
    windowTitle?: string;
    /** 品牌角标 */
    brandLabel?: string;
    /** 邮戳 / 像素吉祥物 */
    mascot?: "none" | "stamp" | "pixel";
    /** 顶部色条（tech） */
    topAccentBar?: boolean;
    /**
     * 首页首个 H1 放大为海报标题（MD2Card 式大标题）。
     * 默认：非 minimal 主题开启。
     */
    heroMode?: "first-h1" | "off";
    /** 统一皮肤：标题 + Markdown 语法一整套 */
    skin?: CardSkin;
  };
  customCSS?: string;
  builtin?: boolean;
}

export const THEME_GROUP_LABELS: Record<ThemeGroupId, string> = {
  social: "社交分享",
  letter: "信笺仪式",
  retro: "复古界面",
  modern: "现代玻璃",
  tech: "技术极客",
  minimal: "极简",
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
