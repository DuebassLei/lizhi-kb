import { defineTheme, FONTS } from "./_define";
import themeCss from "./cute-paw.css?raw";

export default defineTheme({
  id: "cute-paw",
  name: "猫爪便签",
  group: "cute",
  description: "猫耳外形、爪印作项目符号 — 吉祥物外形",
  colors: {
    background: "#fff9f0",
    text: "#4a3728",
    heading: "#c45c26",
    accent: "#f0c9a0",
    blockquoteBorder: "transparent",
    blockquoteBackground: "#ffe8d6",
    highlight: "#c45c26",
  },
  typography: {
    fontFamily: FONTS.SANS,
    headingFontFamily: '"ZCOOL KuaiLe", "Noto Sans SC", sans-serif',
    baseFontSize: 24,
    headingScale: [1.67, 1.35, 1.2, 1.1, 1.04, 1.0],
    headingWeight: 700,
    lineHeight: 1.7,
  },
  spacing: {
    padding: [52, 44, 56, 44],
    blockGap: 16,
    paragraphGap: 12,
  },
  border: {
    width: 3,
    style: "solid",
    color: "#f0c9a0",
    radius: 22,
  },
  skin: "plain",
  customCSS: themeCss,
});
