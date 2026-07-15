import type { CardTheme } from "../types";

/** 信笺启封 · 居中衬线仪式标题 */
export default {
  id: "letter-invite",
  name: "信笺启封",
  group: "letter",
  description: "居中衬线大标题 · 邀请函仪式感",
  format: "xhs",
  colors: {
    background: "linear-gradient(180deg, #f7f0e4 0%, #f3e8d4 100%)",
    text: "#3d2b1f",
    heading: "#2c1810",
    accent: "#8b4513",
    codeBackground: "#efe4d0",
    codeText: "#3d2b1f",
    blockquoteBorder: "#a67c52",
    blockquoteBackground: "rgba(166, 124, 82, 0.12)",
    highlight: "#e8d5a8",
  },
  typography: {
    fontFamily: '"Noto Serif SC", "Songti SC", "SimSun", serif',
    headingFontFamily: '"Noto Serif SC", "STSong", "SimSun", serif',
    baseFontSize: 28,
    headingScale: [2.05, 1.45, 1.25, 1.15, 1.05, 1.0],
    lineHeight: 1.9,
    headingWeight: 700,
    textWeight: 400,
    textAlign: "center",
  },
  spacing: {
    padding: [72, 72, 80, 72],
    blockGap: 28,
    paragraphGap: 22,
  },
  border: {
    width: 2,
    style: "solid",
    color: "#5c3d2e",
    radius: 4,
    doubleInset: true,
  },
  decorations: {
    chrome: "letter",
    corners: "none",
    windowTitle: "邀您启封",
    watermark: "狸知知识库",
    watermarkPosition: "footer-left",
    headerStyle: "none",
    footerStyle: "letter-meta",
    mascot: "stamp",
    heroMode: "first-h1",
    skin: "letter",
  },
  customCSS: `
    .card-block.block-paragraph {
      max-width: 22em;
      margin-left: auto;
      margin-right: auto;
    }
  `,
  builtin: true,
} satisfies CardTheme;
