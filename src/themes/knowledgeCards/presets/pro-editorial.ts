import { defineTheme, FONTS } from "./_define";
import themeCss from "./pro-editorial.css?raw";

export default defineTheme({
  id: "pro-editorial",
  name: "期刊专栏",
  group: "pro",
  description: "刊头、大字标题、跨栏引语 — 杂志编辑感",
  colors: {
    background: "#f7f4ef",
    text: "#1c1916",
    heading: "#1c1916",
    accent: "#c45c26",
    blockquoteBorder: "#1c1916",
    blockquoteBackground: "transparent",
    highlight: "#c45c26",
  },
  typography: {
    fontFamily: FONTS.SERIF,
    headingFontFamily: FONTS.SERIF,
    baseFontSize: 22,
    headingScale: [2.4, 1.5, 1.28, 1.14, 1.06, 1.0],
    headingWeight: 900,
    lineHeight: 1.65,
  },
  spacing: {
    padding: [56, 48, 64, 48],
    blockGap: 18,
    paragraphGap: 12,
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
