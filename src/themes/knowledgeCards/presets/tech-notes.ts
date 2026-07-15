import type { CardTheme } from "../types";

/** 技术札记 · 等宽标题 + // 章节前缀 */
export default {
  id: "tech-notes",
  name: "技术札记",
  group: "tech",
  description: "等宽标题 · // 章节前缀 · 代码感",
  format: "xhs",
  colors: {
    background: "#faf8f5",
    text: "#1c1917",
    heading: "#1c1917",
    accent: "#c2410c",
    codeBackground: "#f5ebe0",
    codeText: "#1d4ed8",
    blockquoteBorder: "#d6d3d1",
    blockquoteBackground: "#f5f5f4",
    highlight: "#fde68a",
  },
  typography: {
    fontFamily: '"Inter", "PingFang SC", "Microsoft YaHei", sans-serif',
    headingFontFamily: '"JetBrains Mono", "SF Mono", Consolas, monospace',
    baseFontSize: 26,
    headingScale: [1.85, 1.4, 1.2, 1.1, 1.05, 1.0],
    lineHeight: 1.65,
    headingWeight: 800,
    textWeight: 400,
    textAlign: "left",
  },
  spacing: {
    padding: [56, 56, 72, 56],
    blockGap: 22,
    paragraphGap: 14,
  },
  border: {
    width: 1,
    style: "solid",
    color: "#e7e5e4",
    radius: 12,
  },
  decorations: {
    chrome: "tech",
    corners: "none",
    brandLabel: "TECH NOTES",
    topAccentBar: true,
    watermarkPosition: "none",
    headerStyle: "none",
    footerStyle: "page-number",
    mascot: "pixel",
    heroMode: "first-h1",
    skin: "tech",
  },
  customCSS: `
    .card-block.block-heading.is-hero h1::before {
      content: "01 ";
      color: var(--card-accent);
      font-size: 0.72em;
      margin-right: 0.15em;
    }
  `,
  builtin: true,
} satisfies CardTheme;
