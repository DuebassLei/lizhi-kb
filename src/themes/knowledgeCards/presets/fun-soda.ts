import { defineTheme, FONTS } from "./_define";
import themeCss from "./fun-soda.css?raw";

export default defineTheme({
  id: "fun-soda",
  name: "弹珠汽水",
  group: "fun",
  description: "上半截亮色罐身、波浪接缝、贴纸泡泡 — 包装饮料感",
  colors: {
    background: "#fff8f0",
    text: "#2a1a14",
    heading: "#fff",
    accent: "#ff6b4a",
    blockquoteBorder: "transparent",
    blockquoteBackground: "#2a1a14",
    highlight: "#ffe566",
  },
  typography: {
    fontFamily: FONTS.SANS,
    headingFontFamily: '"ZCOOL KuaiLe", "Fredoka", sans-serif',
    baseFontSize: 24,
    headingScale: [2.0, 1.4, 1.22, 1.1, 1.04, 1.0],
    headingWeight: 700,
    lineHeight: 1.65,
  },
  spacing: {
    padding: [48, 44, 56, 44],
    blockGap: 12,
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
