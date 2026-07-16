import { defineTheme, FONTS } from "./_define";
import themeCss from "./fun-chalk.css?raw";

export default defineTheme({
  id: "fun-chalk",
  name: "涂鸦黑板",
  group: "fun",
  description: "木框黑板、粉笔字、虚线圈重点 — 课堂涂鸦",
  colors: {
    background: "#243024",
    text: "#e6e2d6",
    heading: "#fff",
    accent: "#f0c93a",
    blockquoteBorder: "transparent",
    blockquoteBackground: "transparent",
    highlight: "#9ad0ff",
  },
  typography: {
    fontFamily: FONTS.SANS,
    headingFontFamily: '"Caveat", "Ma Shan Zheng", cursive',
    baseFontSize: 26,
    headingScale: [2.4, 1.5, 1.28, 1.14, 1.06, 1.0],
    headingWeight: 700,
    lineHeight: 1.7,
  },
  spacing: {
    padding: [52, 44, 56, 44],
    blockGap: 18,
    paragraphGap: 14,
  },
  border: {
    width: 10,
    style: "solid",
    color: "#5c4030",
    radius: 0,
  },
  skin: "plain",
  customCSS: themeCss,
});
