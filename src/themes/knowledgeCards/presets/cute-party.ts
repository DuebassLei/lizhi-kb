import { defineTheme } from "./_define";
import themeCss from "./cute-party.css?raw";

export default defineTheme({
  id: "cute-party",
  name: "气球派对",
  group: "cute",
  description: "深底、气球群、玻璃面板、渐变标题 — 派对邀请感",
  colors: {
    background: "#1a1430",
    text: "#f0e6ff",
    heading: "#ff6b9d",
    accent: "#ffe566",
    blockquoteBorder: "transparent",
    blockquoteBackground: "rgba(255, 107, 157, 0.2)",
    highlight: "#7ec8e3",
    headingGradient: "linear-gradient(90deg, #ff6b9d, #ffe566, #7ec8e3)",
  },
  typography: {
    fontFamily: '"Fredoka", "Noto Sans SC", sans-serif',
    headingFontFamily: '"Fredoka", "Noto Sans SC", sans-serif',
    baseFontSize: 24,
    headingScale: [1.83, 1.4, 1.22, 1.1, 1.04, 1.0],
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
