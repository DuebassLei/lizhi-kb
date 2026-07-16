import { defineTheme, FONTS } from "./_define";
import themeCss from "./pro-brief.css?raw";

export default defineTheme({
  id: "pro-brief",
  name: "投行简报",
  group: "pro",
  description: "侧色条、KPI 模块、深色董事会风 — 决策信息卡",
  colors: {
    background: "#0f1115",
    text: "#eceae4",
    heading: "#eceae4",
    accent: "#c9a227",
    codeBackground: "#161a22",
    codeText: "#c9a227",
    blockquoteBorder: "#c9a227",
    blockquoteBackground: "#161a22",
    highlight: "#c9a227",
  },
  typography: {
    fontFamily: FONTS.SANS,
    headingFontFamily: FONTS.SANS,
    baseFontSize: 24,
    headingScale: [1.75, 1.35, 1.18, 1.08, 1.02, 1.0],
    headingWeight: 700,
    lineHeight: 1.5,
  },
  spacing: {
    padding: [0, 0, 0, 0],
    blockGap: 14,
    paragraphGap: 8,
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
