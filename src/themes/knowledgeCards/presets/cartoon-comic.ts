import { defineTheme, FONTS } from "./_define";
import themeCss from "./cartoon-comic.css?raw";

export default defineTheme({
  id: "cartoon-comic",
  name: "漫画分镜",
  group: "cartoon",
  description: "粗描边、网点、对白泡泡 — 漫画页气质",
  colors: {
    background: "#fff8ef",
    text: "#1a1208",
    heading: "#1a1208",
    accent: "#ff4d6d",
    blockquoteBorder: "#ff4d6d",
    blockquoteBackground: "#ffe8ee",
    highlight: "#ffd400",
  },
  typography: {
    fontFamily: FONTS.SANS,
    headingFontFamily: '"Bangers", "ZCOOL KuaiLe", cursive',
    baseFontSize: 26,
    headingScale: [2.2, 1.5, 1.28, 1.14, 1.06, 1.0],
    headingWeight: 400,
    lineHeight: 1.55,
  },
  spacing: {
    padding: [48, 44, 56, 44],
    blockGap: 14,
    paragraphGap: 10,
  },
  border: {
    width: 4,
    style: "solid",
    color: "#111",
    radius: 0,
  },
  skin: "plain",
  customCSS: themeCss,
});
