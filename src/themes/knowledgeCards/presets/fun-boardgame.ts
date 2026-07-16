import { defineTheme, FONTS } from "./_define";
import themeCss from "./fun-boardgame.css?raw";

export default defineTheme({
  id: "fun-boardgame",
  name: "桌游说明书",
  group: "fun",
  description: "盒盖标题栏、骰子、圆形步骤编号 — 规则说明书",
  colors: {
    background: "#efe6d4",
    text: "#2b2418",
    heading: "#efe6d4",
    accent: "#e85d04",
    blockquoteBorder: "#2b2418",
    blockquoteBackground: "#fff",
    highlight: "#e85d04",
  },
  typography: {
    fontFamily: FONTS.SANS,
    headingFontFamily: '"ZCOOL QingKe HuangYou", sans-serif',
    baseFontSize: 22,
    headingScale: [0.9, 0.85, 0.8, 0.75, 0.72, 0.7],
    headingWeight: 400,
    lineHeight: 1.6,
  },
  spacing: {
    padding: [48, 44, 56, 44],
    blockGap: 10,
    paragraphGap: 8,
  },
  border: {
    width: 3,
    style: "solid",
    color: "#2b2418",
    radius: 0,
  },
  skin: "plain",
  customCSS: themeCss,
});
