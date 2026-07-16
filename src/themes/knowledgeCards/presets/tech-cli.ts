import { defineTheme, FONTS } from "./_define";
import themeCss from "./tech-cli.css?raw";

export default defineTheme({
  id: "tech-cli",
  name: "终端 CLI",
  group: "tech",
  description: "窗标题栏、扫描线、绿色荧光、命令前缀 — 程序员终端",
  colors: {
    background: "#0c0f0c",
    text: "#9dffb5",
    heading: "#e8ffe8",
    accent: "#5ad4ff",
    codeBackground: "rgba(124, 255, 154, 0.06)",
    codeText: "#7CFF9A",
    blockquoteBorder: "#2a5a38",
    blockquoteBackground: "rgba(124, 255, 154, 0.06)",
    highlight: "#7CFF9A",
  },
  typography: {
    fontFamily: FONTS.MONO,
    headingFontFamily: FONTS.MONO,
    baseFontSize: 22,
    headingScale: [1.35, 1.15, 1.05, 1.0, 0.95, 0.92],
    headingWeight: 700,
    lineHeight: 1.45,
  },
  spacing: {
    padding: [0, 0, 0, 0],
    blockGap: 10,
    paragraphGap: 6,
  },
  border: {
    width: 1,
    style: "solid",
    color: "#1f3324",
    radius: 0,
  },
  skin: "plain",
  customCSS: themeCss,
});
