import type { CardTheme } from "./types";
import { normalizeThemeShell } from "./types";
import cartoonComic from "./presets/cartoon-comic";
import cartoonSticker from "./presets/cartoon-sticker";
import cartoonPixel from "./presets/cartoon-pixel";
import proEditorial from "./presets/pro-editorial";
import proBrief from "./presets/pro-brief";
import proLecture from "./presets/pro-lecture";
import funChalk from "./presets/fun-chalk";
import funSoda from "./presets/fun-soda";
import funBoardgame from "./presets/fun-boardgame";
import cuteMemo from "./presets/cute-memo";
import cutePaw from "./presets/cute-paw";
import cuteParty from "./presets/cute-party";
import techCli from "./presets/tech-cli";
import techHud from "./presets/tech-hud";
import techPcb from "./presets/tech-pcb";

export type { CardTheme, ThemeGroupId, CardSkin } from "./types";
export {
  themeToCssVars,
  THEME_GROUP_LABELS,
  CARD_SKIN_LABELS,
  CARD_SKIN_OPTIONS,
  normalizeThemeShell,
} from "./types";

/** 默认内置主题（本地无记录或旧 ID 失效时回退） */
export const DEFAULT_BUILTIN_THEME_ID = "cartoon-sticker";

function buildBuiltinThemes(): CardTheme[] {
  try {
    return [
      cartoonComic,
      cartoonSticker,
      cartoonPixel,
      proEditorial,
      proBrief,
      proLecture,
      funChalk,
      funSoda,
      funBoardgame,
      cuteMemo,
      cutePaw,
      cuteParty,
      techCli,
      techHud,
      techPcb,
    ];
  } catch {
    return [cartoonSticker];
  }
}

const builtinThemes: CardTheme[] = buildBuiltinThemes();

class ThemeRegistry {
  private themes = new Map<string, CardTheme>();

  constructor() {
    for (const t of builtinThemes) {
      this.themes.set(t.id, t);
    }
  }

  register(theme: CardTheme): void {
    this.themes.set(theme.id, theme);
  }

  get(id: string): CardTheme | undefined {
    return this.themes.get(id);
  }

  getAll(): CardTheme[] {
    return Array.from(this.themes.values());
  }

  getBuiltin(): CardTheme[] {
    return this.getAll().filter((t) => t.builtin);
  }

  remove(id: string): void {
    const theme = this.themes.get(id);
    if (theme?.builtin) throw new Error("Cannot remove builtin theme");
    this.themes.delete(id);
  }

  syncCustom(custom: CardTheme[]): void {
    for (const [id, t] of this.themes) {
      if (!t.builtin) this.themes.delete(id);
    }
    for (const t of custom) {
      const next = normalizeThemeShell({ ...t, builtin: false, group: "custom" });
      this.themes.set(next.id, next);
    }
  }
}

export const themeRegistry = new ThemeRegistry();
export const BUILTIN_THEME_IDS = builtinThemes.map((t) => t.id);
