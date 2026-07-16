import { defineTheme } from "./_define";
import themeCss from "./cute-memo.css?raw";

export default defineTheme({
  id: "cute-memo",
  name: "奶油便签",
  group: "cute",
  description: "大圆角、回形针、柔和 Blob、♡ 列表 — 便签纸",
  colors: {
    background: "#e8fff6",
    text: "#3d3550",
    heading: "#5c4d7a",
    accent: "#ff8fab",
    blockquoteBorder: "transparent",
    blockquoteBackground: "rgba(255, 255, 255, 0.75)",
    highlight: "#7ec8e3",
  },
  typography: {
    fontFamily: '"Fredoka", "Noto Sans SC", sans-serif',
    headingFontFamily: '"Fredoka", "Noto Sans SC", sans-serif',
    baseFontSize: 24,
    headingScale: [1.67, 1.35, 1.2, 1.1, 1.04, 1.0],
    headingWeight: 700,
    lineHeight: 1.75,
  },
  spacing: {
    padding: [56, 44, 56, 44],
    blockGap: 20,
    paragraphGap: 14,
  },
  border: {
    width: 0,
    style: "none",
    color: "transparent",
    radius: 28,
  },
  skin: "plain",
  customCSS: themeCss,
});
