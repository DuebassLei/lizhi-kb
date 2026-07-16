import { defineTheme, FONTS } from "./_define";
import themeCss from "./tech-pcb.css?raw";

export default defineTheme({
  id: "tech-pcb",
  name: "电路板",
  group: "tech",
  description: "焊盘绿底、铜走线、芯片丝印 U1 — PCB 版图",
  colors: {
    background: "#0a3d2e",
    text: "#c8ebe0",
    heading: "#ffb43c",
    accent: "#ffb43c",
    codeBackground: "#062820",
    codeText: "#ffb43c",
    blockquoteBorder: "#ffb43c",
    blockquoteBackground: "transparent",
    highlight: "#ffb43c",
  },
  typography: {
    fontFamily: FONTS.SANS,
    headingFontFamily: FONTS.MONO,
    baseFontSize: 24,
    headingScale: [1.5, 1.25, 1.12, 1.05, 1.0, 0.98],
    headingWeight: 700,
    lineHeight: 1.55,
  },
  spacing: {
    padding: [48, 44, 56, 44],
    blockGap: 12,
    paragraphGap: 8,
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
