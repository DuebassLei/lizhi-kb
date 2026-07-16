import { defineTheme, FONTS } from "./_define";
import themeCss from "./cartoon-pixel.css?raw";

export default defineTheme({
  id: "cartoon-pixel",
  name: "像素 RPG",
  group: "cartoon",
  description: "像素字标题、血条、对话窗边框 — 游戏 UI",
  colors: {
    background: "#1d2b3a",
    text: "#e8f4ff",
    heading: "#ffe566",
    accent: "#4fd1c5",
    codeBackground: "#0f1a26",
    codeText: "#89b4fa",
    blockquoteBorder: "#f9e2af",
    blockquoteBackground: "rgba(249, 226, 175, 0.08)",
    highlight: "#7ee787",
  },
  typography: {
    fontFamily: FONTS.SANS,
    headingFontFamily: '"Press Start 2P", monospace',
    baseFontSize: 22,
    headingScale: [0.85, 0.75, 0.68, 0.62, 0.58, 0.55],
    headingWeight: 400,
    lineHeight: 1.65,
  },
  spacing: {
    padding: [44, 40, 52, 40],
    blockGap: 12,
    paragraphGap: 8,
  },
  border: {
    width: 6,
    style: "solid",
    color: "#0b1220",
    radius: 0,
  },
  skin: "plain",
  customCSS: themeCss,
});
