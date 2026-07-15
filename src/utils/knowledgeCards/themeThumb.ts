import type { CardTheme, CardSkin } from "../../themes/knowledgeCards/types";
import { CARD_SKIN_LABELS, themeToCssVars } from "../../themes/knowledgeCards/types";

export { CARD_SKIN_LABELS };

/** 缩略图用：主题 CSS 变量 + 迷你卡尺寸 */
export function themeThumbStyle(theme: CardTheme): Record<string, string> {
  const vars = themeToCssVars(theme);
  return {
    ...vars,
    "--thumb-radius": `${Math.min(18, Math.max(6, theme.border.radius * 0.35))}px`,
    "--thumb-border-w": `${Math.min(3, Math.max(0, theme.border.width * 0.45))}px`,
  };
}

export function themeSkin(theme: CardTheme): CardSkin {
  return theme.decorations.skin ?? "default";
}

export function themeSkinLabel(theme: CardTheme): string {
  return CARD_SKIN_LABELS[theme.decorations.skin ?? "default"];
}

export function themeChromeLabel(theme: CardTheme): string {
  const chrome = theme.decorations.chrome ?? "default";
  const map: Record<string, string> = {
    default: "基础",
    poster: "海报",
    letter: "信笺",
    window: "窗口",
    nebula: "星云",
    tech: "技术",
  };
  return map[chrome] ?? chrome;
}
