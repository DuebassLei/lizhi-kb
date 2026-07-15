import type { CardTheme } from "./types";
import letterInvite from "./presets/letter-invite";
import nebula from "./presets/nebula";
import techNotes from "./presets/tech-notes";
import inkScroll from "./presets/ink-scroll";

export type {
  CardTheme,
  ThemeGroupId,
  CardLayoutChrome,
  CardSkin,
} from "./types";
export { themeToCssVars, THEME_GROUP_LABELS, CARD_SKIN_LABELS } from "./types";

/** 默认内置主题（本地无记录或旧 ID 失效时回退） */
export const DEFAULT_BUILTIN_THEME_ID = "letter-invite";

/** 为旧预设补齐 group，避免选择器空分组 */
function withGroup(theme: CardTheme, group: CardTheme["group"]): CardTheme {
  return { ...theme, group: theme.group ?? group };
}

const builtinThemes: CardTheme[] = [
  withGroup(letterInvite, "letter"),
  withGroup(inkScroll, "letter"),
  withGroup(nebula, "modern"),
  withGroup(techNotes, "tech"),
];

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
      this.themes.set(t.id, { ...t, builtin: false, group: "custom" });
    }
  }
}

export const themeRegistry = new ThemeRegistry();
export const BUILTIN_THEME_IDS = builtinThemes.map((t) => t.id);
