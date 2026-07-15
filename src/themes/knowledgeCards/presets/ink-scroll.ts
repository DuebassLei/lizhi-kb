import type { CardTheme } from "../types";

/** 水墨长卷 · 左起墨线标题 */
export default {
  id: "ink-scroll",
  name: "水墨长卷",
  group: "letter",
  description: "宣纸留白 · 红印底线标题",
  format: "wechat",
  colors: {
    background: "#f7f4ef",
    text: "#1a1a1a",
    heading: "#111111",
    accent: "#b91c1c",
    codeBackground: "#ebe6dc",
    codeText: "#1a1a1a",
    blockquoteBorder: "#b91c1c",
    blockquoteBackground: "rgba(185, 28, 28, 0.06)",
  },
  typography: {
    fontFamily: '"Noto Serif SC", "Source Han Serif SC", "SimSun", serif',
    headingFontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
    baseFontSize: 28,
    headingScale: [2.15, 1.55, 1.3, 1.15, 1.05, 1.0],
    lineHeight: 1.95,
    headingWeight: 700,
    textWeight: 400,
    textAlign: "left",
  },
  spacing: {
    padding: [72, 64, 72, 64],
    blockGap: 32,
    paragraphGap: 20,
  },
  border: {
    width: 0,
    style: "none",
    color: "transparent",
    radius: 0,
  },
  decorations: {
    chrome: "default",
    corners: "none",
    watermark: "狸知",
    watermarkPosition: "footer-right",
    headerStyle: "minimal",
    footerStyle: "page-number",
    mascot: "none",
    heroMode: "first-h1",
    skin: "ink",
  },
  customCSS: `
    .card-block.block-heading.is-hero h1 {
      position: relative;
    }
    .card-block.block-heading.is-hero h1::after {
      content: "印";
      position: absolute;
      right: -1.6em;
      top: -0.15em;
      width: 1.35em;
      height: 1.35em;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--card-accent);
      color: var(--card-accent);
      font-size: 0.42em;
      font-weight: 700;
      opacity: 0.75;
      transform: rotate(-12deg);
    }
  `,
  builtin: true,
} satisfies CardTheme;
