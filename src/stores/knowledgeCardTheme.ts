import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { CardFormatId } from "../types/knowledgeCards";
import {
  DEFAULT_BUILTIN_THEME_ID,
  themeRegistry,
  type CardTheme,
} from "../themes/knowledgeCards";
import { getCardFormat } from "../utils/knowledgeCards/cardFormats";

const THEME_KEY = "lizhi-kb-knowledge-card-theme";
const FORMAT_KEY = "lizhi-kb-knowledge-card-format";
const CUSTOM_KEY = "lizhi-kb-knowledge-card-custom-themes";
const CUSTOM_SIZE_KEY = "lizhi-kb-knowledge-card-custom-size";

function loadThemeId(): string {
  try {
    return localStorage.getItem(THEME_KEY) || DEFAULT_BUILTIN_THEME_ID;
  } catch {
    return DEFAULT_BUILTIN_THEME_ID;
  }
}

function loadFormatId(): CardFormatId {
  try {
    const raw = localStorage.getItem(FORMAT_KEY);
    if (raw === "xhs" || raw === "wechat" || raw === "instagram" || raw === "story" || raw === "custom") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "xhs";
}

function loadCustomThemes(): CardTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CardTheme[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadCustomSize(): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(CUSTOM_SIZE_KEY);
    if (!raw) return { width: 1080, height: 1440 };
    const parsed = JSON.parse(raw) as { width?: number; height?: number };
    return {
      width: Math.max(200, Number(parsed.width) || 1080),
      height: Math.max(200, Number(parsed.height) || 1440),
    };
  } catch {
    return { width: 1080, height: 1440 };
  }
}

export const useKnowledgeCardThemeStore = defineStore("knowledgeCardTheme", () => {
  const currentThemeId = ref(loadThemeId());
  const currentFormatId = ref<CardFormatId>(loadFormatId());
  const customThemes = ref<CardTheme[]>(loadCustomThemes());
  const customSize = ref(loadCustomSize());

  themeRegistry.syncCustom(customThemes.value);

  // 旧内置主题 ID（如 xhs-content）已下线时回退到默认
  if (!themeRegistry.get(currentThemeId.value)) {
    currentThemeId.value = DEFAULT_BUILTIN_THEME_ID;
  }

  const currentTheme = computed(() => {
    return (
      themeRegistry.get(currentThemeId.value) ??
      themeRegistry.get(DEFAULT_BUILTIN_THEME_ID)!
    );
  });

  const currentFormat = computed(() =>
    getCardFormat(currentFormatId.value, customSize.value),
  );

  const allThemes = computed(() => themeRegistry.getAll());

  watch(currentThemeId, (id) => {
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
      /* ignore */
    }
  });

  watch(currentFormatId, (id) => {
    try {
      localStorage.setItem(FORMAT_KEY, id);
    } catch {
      /* ignore */
    }
  });

  watch(
    customThemes,
    (list) => {
      themeRegistry.syncCustom(list);
      try {
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  );

  watch(
    customSize,
    (size) => {
      try {
        localStorage.setItem(CUSTOM_SIZE_KEY, JSON.stringify(size));
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  );

  function setTheme(id: string) {
    if (themeRegistry.get(id)) currentThemeId.value = id;
  }

  function setFormat(id: CardFormatId) {
    currentFormatId.value = id;
  }

  function setCustomSize(width: number, height: number) {
    customSize.value = {
      width: Math.max(200, Math.round(width)),
      height: Math.max(200, Math.round(height)),
    };
  }

  function addCustomTheme(theme: CardTheme) {
    const next = { ...theme, builtin: false };
    const idx = customThemes.value.findIndex((t) => t.id === next.id);
    if (idx >= 0) {
      customThemes.value = customThemes.value.map((t, i) => (i === idx ? next : t));
    } else {
      customThemes.value = [...customThemes.value, next];
    }
    themeRegistry.register(next);
    currentThemeId.value = next.id;
  }

  function removeCustomTheme(id: string) {
    const theme = themeRegistry.get(id);
    if (theme?.builtin) return;
    customThemes.value = customThemes.value.filter((t) => t.id !== id);
    try {
      themeRegistry.remove(id);
    } catch {
      /* ignore */
    }
    if (currentThemeId.value === id) {
      currentThemeId.value = DEFAULT_BUILTIN_THEME_ID;
    }
  }

  return {
    currentThemeId,
    currentFormatId,
    customThemes,
    customSize,
    currentTheme,
    currentFormat,
    allThemes,
    setTheme,
    setFormat,
    setCustomSize,
    addCustomTheme,
    removeCustomTheme,
  };
});
