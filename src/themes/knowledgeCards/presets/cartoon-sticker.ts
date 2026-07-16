import { defineTheme } from "./_define";
import themeCss from "./cartoon-sticker.css?raw";

export default defineTheme({
  id: "cartoon-sticker",
  name: "贴纸手帐",
  group: "cartoon",
  description: "胶带、拍立得框、圆形印章贴纸 — 拼贴手帐",
  colors: {
    background: "#f4f7fb",
    text: "#2c3a4a",
    heading: "#24527a",
    accent: "#ff8fab",
    blockquoteBorder: "#e8c45a",
    blockquoteBackground: "#fff3c4",
    highlight: "#7bdff2",
  },
  typography: {
    fontFamily: '"Fredoka", "Noto Sans SC", sans-serif',
    headingFontFamily: '"Fredoka", "Noto Sans SC", sans-serif',
    baseFontSize: 24,
    headingScale: [1.67, 1.35, 1.2, 1.1, 1.04, 1.0],
    headingWeight: 700,
    lineHeight: 1.6,
  },
  spacing: {
    padding: [56, 48, 60, 48],
    blockGap: 16,
    paragraphGap: 12,
  },
  border: {
    width: 0,
    style: "none",
    color: "transparent",
    radius: 4,
  },
  skin: "plain",
  customCSS: themeCss,
});
