import { defineTheme, FONTS } from "./_define";
import themeCss from "./pro-lecture.css?raw";

export default defineTheme({
  id: "pro-lecture",
  name: "学术讲义",
  group: "pro",
  description: "横线笔记本、红栏、竖排页边编号 — 课堂讲义",
  colors: {
    background: "#faf8f2",
    text: "#222",
    heading: "#222",
    accent: "#d64545",
    blockquoteBorder: "#222",
    blockquoteBackground: "transparent",
    highlight: "#d64545",
  },
  typography: {
    fontFamily: FONTS.SERIF,
    headingFontFamily: FONTS.SERIF,
    baseFontSize: 24,
    headingScale: [1.5, 1.3, 1.18, 1.08, 1.02, 1.0],
    headingWeight: 700,
    lineHeight: 1.75,
  },
  spacing: {
    padding: [48, 44, 56, 56],
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
