import type { ILevelsOptions, INumberingOptions, ISectionOptions, IStylesOptions } from "docx";
import type { DocxThemeId } from "./docxThemeSetting";

export type DocxFontSpec = {
  ascii: string;
  eastAsia: string;
  hAnsi: string;
};

export type DocxThemeMeta = {
  id: DocxThemeId;
  label: string;
  hint: string;
};

export const DOCX_THEME_OPTIONS: readonly DocxThemeMeta[] = [
  { id: "tech", label: "技术文档", hint: "层级清晰 · 代码醒目" },
  { id: "office", label: "办公报告", hint: "宋体正文 · 黑体标题" },
  { id: "proposal", label: "方案书", hint: "大标题 · 宽留白" },
] as const;

type PageMargins = { top: number; right: number; bottom: number; left: number };

type ThemeTokens = {
  bodyFont: DocxFontSpec;
  headingFont: DocxFontSpec;
  codeFont: string;
  bodySize: number;
  titleSize: number;
  headingSizes: [number, number, number, number, number, number];
  headingColors: [string, string, string, string, string, string];
  titleColor: string;
  bodyColor: string;
  quoteColor: string;
  linkColor: string;
  codeFill: string;
  codeSize: number;
  line: number;
  margins: PageMargins;
};

/** twips：1 inch = 1440 */
const THEMES: Record<DocxThemeId, ThemeTokens> = {
  tech: {
    bodyFont: { ascii: "Calibri", eastAsia: "微软雅黑", hAnsi: "Calibri" },
    headingFont: { ascii: "Calibri", eastAsia: "微软雅黑", hAnsi: "Calibri" },
    codeFont: "Consolas",
    bodySize: 22,
    titleSize: 40,
    headingSizes: [32, 28, 26, 24, 22, 22],
    headingColors: ["0F766E", "0F766E", "334155", "334155", "475569", "475569"],
    titleColor: "0F172A",
    bodyColor: "1E293B",
    quoteColor: "64748B",
    linkColor: "2563EB",
    codeFill: "F1F5F9",
    codeSize: 18,
    line: 360,
    margins: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
  },
  office: {
    bodyFont: { ascii: "Times New Roman", eastAsia: "宋体", hAnsi: "Times New Roman" },
    headingFont: { ascii: "Arial", eastAsia: "黑体", hAnsi: "Arial" },
    codeFont: "Consolas",
    bodySize: 24,
    titleSize: 36,
    headingSizes: [32, 28, 26, 24, 24, 22],
    headingColors: ["000000", "000000", "1F2937", "1F2937", "374151", "374151"],
    titleColor: "000000",
    bodyColor: "000000",
    quoteColor: "4B5563",
    linkColor: "1D4ED8",
    codeFill: "F3F4F6",
    codeSize: 20,
    line: 360,
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  },
  proposal: {
    bodyFont: { ascii: "Calibri", eastAsia: "微软雅黑", hAnsi: "Calibri" },
    headingFont: { ascii: "Calibri", eastAsia: "微软雅黑", hAnsi: "Calibri" },
    codeFont: "Consolas",
    bodySize: 22,
    titleSize: 48,
    headingSizes: [36, 30, 26, 24, 22, 22],
    headingColors: ["9A3412", "C2410C", "334155", "334155", "475569", "475569"],
    titleColor: "9A3412",
    bodyColor: "1C1917",
    quoteColor: "78716C",
    linkColor: "B45309",
    codeFill: "FAF5F0",
    codeSize: 18,
    line: 400,
    margins: { top: 1800, right: 1620, bottom: 1800, left: 1620 },
  },
};

export function getDocxThemeTokens(themeId: DocxThemeId): ThemeTokens {
  return THEMES[themeId];
}

export function getDocxThemeLinkColor(themeId: DocxThemeId): string {
  return THEMES[themeId].linkColor;
}

export function getDocxThemeQuoteColor(themeId: DocxThemeId): string {
  return THEMES[themeId].quoteColor;
}

export function getDocxThemeCodeFont(themeId: DocxThemeId): string {
  return THEMES[themeId].codeFont;
}

export function getDocxThemeCodeSize(themeId: DocxThemeId): number {
  return THEMES[themeId].codeSize;
}

export function getDocxThemeBodyFont(themeId: DocxThemeId): DocxFontSpec {
  return THEMES[themeId].bodyFont;
}

export function getDocxSectionProperties(themeId: DocxThemeId): ISectionOptions["properties"] {
  const t = THEMES[themeId];
  return {
    page: {
      margin: t.margins,
    },
  };
}

function listLevel(
  level: number,
  format: "bullet" | "decimal" | "lowerLetter" | "lowerRoman",
  text: string,
  left: number,
): ILevelsOptions {
  return {
    level,
    format,
    text,
    alignment: "left",
    style: {
      paragraph: {
        indent: { left, hanging: 360 },
      },
    },
  };
}

export function buildDocxNumbering(): INumberingOptions {
  return {
    config: [
      {
        reference: "lizhi-bullets",
        levels: [
          listLevel(0, "bullet", "•", 720),
          listLevel(1, "bullet", "◦", 1080),
          listLevel(2, "bullet", "▪", 1440),
        ],
      },
      {
        reference: "lizhi-numbers",
        levels: [
          listLevel(0, "decimal", "%1.", 720),
          listLevel(1, "lowerLetter", "%2)", 1080),
          listLevel(2, "lowerRoman", "%3.", 1440),
        ],
      },
    ],
  };
}

export function buildDocxStyles(themeId: DocxThemeId): IStylesOptions {
  const t = THEMES[themeId];
  const headingDefs = t.headingSizes.map((size, i) => ({
    id: `Heading${i + 1}`,
    name: `Heading ${i + 1}`,
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: {
      font: t.headingFont,
      size,
      bold: true,
      color: t.headingColors[i],
    },
    paragraph: {
      spacing: {
        before: i === 0 ? 360 : 280 - i * 20,
        after: 140,
        line: t.line,
      },
      outlineLevel: i,
    },
  }));

  return {
    default: {
      document: {
        run: {
          font: t.bodyFont,
          size: t.bodySize,
          color: t.bodyColor,
        },
        paragraph: {
          spacing: { after: 160, line: t.line },
        },
      },
    },
    paragraphStyles: [
      {
        id: "Normal",
        name: "Normal",
        run: {
          font: t.bodyFont,
          size: t.bodySize,
          color: t.bodyColor,
        },
        paragraph: {
          spacing: { after: 160, line: t.line },
        },
      },
      {
        id: "Title",
        name: "Title",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: {
          font: t.headingFont,
          size: t.titleSize,
          bold: true,
          color: t.titleColor,
        },
        paragraph: {
          spacing: { after: 320, line: t.line },
        },
      },
      ...headingDefs,
      {
        id: "LizhiQuote",
        name: "Lizhi Quote",
        basedOn: "Normal",
        quickFormat: true,
        run: {
          font: t.bodyFont,
          size: t.bodySize,
          italics: true,
          color: t.quoteColor,
        },
        paragraph: {
          indent: { left: 720 },
          spacing: { after: 160, line: t.line },
          border: {
            left: { style: "single", size: 12, color: t.quoteColor, space: 8 },
          },
        },
      },
      {
        id: "LizhiCode",
        name: "Lizhi Code",
        basedOn: "Normal",
        quickFormat: true,
        run: {
          font: t.codeFont,
          size: t.codeSize,
          color: t.bodyColor,
        },
        paragraph: {
          shading: { type: "clear", fill: t.codeFill },
          spacing: { before: 0, after: 0, line: 276 },
        },
      },
      {
        id: "LizhiList",
        name: "Lizhi List",
        basedOn: "Normal",
        quickFormat: true,
        run: {
          font: t.bodyFont,
          size: t.bodySize,
          color: t.bodyColor,
        },
        paragraph: {
          spacing: { after: 80, line: t.line },
        },
      },
    ],
  };
}
