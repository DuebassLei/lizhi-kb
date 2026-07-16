import { defineTheme, FONTS } from "./_define";
import themeCss from "./tech-hud.css?raw";

export default defineTheme({
  id: "tech-hud",
  name: "HUD 仪表",
  group: "tech",
  description: "四角括号、网格底、状态徽章、切角面板 — 科幻 HUD",
  colors: {
    background: "#061018",
    text: "#a8e8da",
    heading: "#eafff8",
    accent: "#2affc8",
    codeBackground: "rgba(6, 30, 40, 0.8)",
    codeText: "#2affc8",
    blockquoteBorder: "rgba(42, 255, 200, 0.3)",
    blockquoteBackground: "rgba(6, 30, 40, 0.8)",
    highlight: "#2affc8",
  },
  typography: {
    fontFamily: FONTS.SANS,
    headingFontFamily: FONTS.SANS,
    baseFontSize: 24,
    headingScale: [1.67, 1.35, 1.18, 1.08, 1.02, 1.0],
    headingWeight: 700,
    lineHeight: 1.55,
  },
  spacing: {
    padding: [48, 44, 56, 44],
    blockGap: 14,
    paragraphGap: 10,
  },
  border: {
    width: 0,
    style: "none",
    color: "transparent",
    radius: 0,
  },
  skin: "plain",
  customCSS: themeCss,
});
