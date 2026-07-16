import type { CardTheme, ThemeGroupId, CardSkin } from "../types";

type DeepPartialColors = Partial<CardTheme["colors"]>;
type DeepPartialTypography = Partial<CardTheme["typography"]>;
type DeepPartialSpacing = Partial<CardTheme["spacing"]>;
type DeepPartialBorder = Partial<CardTheme["border"]>;
type DeepPartialDecorations = Partial<CardTheme["decorations"]>;

export interface DefineThemeInput {
  id: string;
  name: string;
  group: ThemeGroupId;
  description: string;
  format?: CardTheme["format"];
  colors: DeepPartialColors & Pick<CardTheme["colors"], "background" | "text" | "heading" | "accent">;
  typography?: DeepPartialTypography;
  spacing?: DeepPartialSpacing;
  border?: DeepPartialBorder;
  skin?: CardSkin;
  decorations?: DeepPartialDecorations;
  customCSS?: string;
}

const SANS = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
const SERIF = '"Noto Serif SC", "Source Han Serif SC", "SimSun", serif';
const MONO = '"JetBrains Mono", "SF Mono", Consolas, monospace';
const DISPLAY = '"Cormorant Garamond", "Noto Serif SC", serif';

export const FONTS = { SANS, SERIF, MONO, DISPLAY } as const;

export function listResetCss(marker: string, extraLi = "", extraBefore = ""): string {
  return `
.card-block.block-list ul {
  list-style: none !important;
  padding-left: 0 !important;
}
.card-block.block-list ul > li {
  position: relative !important;
  margin: 0.28em 0 !important;
  padding: 0.15em 0 0.15em 1.55em !important;
  border: none !important;
  background: transparent !important;
  transform: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  ${extraLi}
}
.card-block.block-list ul > li:nth-child(even) {
  transform: none !important;
}
.card-block.block-list ul > li::before {
  content: ${marker};
  position: absolute !important;
  left: 0 !important;
  top: 0.2em !important;
  width: auto !important;
  height: auto !important;
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  text-shadow: none !important;
  font-size: inherit !important;
  ${extraBefore}
}
`;
}

export function defineTheme(input: DefineThemeInput): CardTheme {
  const {
    id,
    name,
    group,
    description,
    format = "xhs",
    colors,
    typography = {},
    spacing = {},
    border = {},
    skin = "plain",
    decorations = {},
    customCSS,
  } = input;

  return {
    id,
    name,
    group,
    description,
    format,
    colors: {
      codeBackground: colors.codeBackground ?? "rgba(0,0,0,0.06)",
      codeText: colors.codeText ?? colors.text,
      blockquoteBorder: colors.blockquoteBorder ?? colors.accent,
      blockquoteBackground: colors.blockquoteBackground ?? "rgba(0,0,0,0.04)",
      highlight: colors.highlight ?? colors.accent,
      ...colors,
    },
    typography: {
      fontFamily: SANS,
      headingFontFamily: SANS,
      baseFontSize: 26,
      headingScale: [2.0, 1.45, 1.25, 1.12, 1.05, 1.0],
      lineHeight: 1.7,
      headingWeight: 800,
      textWeight: 400,
      textAlign: "left",
      ...typography,
    },
    spacing: {
      padding: [56, 52, 64, 52],
      blockGap: 22,
      paragraphGap: 14,
      ...spacing,
    },
    border: {
      width: 0,
      style: "none",
      color: "transparent",
      radius: 16,
      ...border,
    },
    decorations: {
      corners: "none",
      watermarkPosition: "none",
      headerStyle: "none",
      footerStyle: "page-number",
      mascot: "none",
      heroMode: "first-h1",
      skin,
      ...decorations,
    },
    customCSS,
    builtin: true,
  };
}
