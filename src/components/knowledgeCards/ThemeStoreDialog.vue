<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Check, LayoutTemplate, X } from "@lucide/vue";
import { useKnowledgeCardThemeStore } from "../../stores/knowledgeCardTheme";
import {
  THEME_GROUP_LABELS,
  type CardTheme,
  type ThemeGroupId,
} from "../../themes/knowledgeCards/types";
import {
  themeChromeLabel,
  themeSkin,
  themeSkinLabel,
  themeThumbStyle,
} from "../../utils/knowledgeCards/themeThumb";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  customize: [];
}>();

const themeStore = useKnowledgeCardThemeStore();

const activeGroup = ref<ThemeGroupId | "all">("all");
const storeRef = ref<HTMLElement | null>(null);

const groupOrder: ThemeGroupId[] = [
  "letter",
  "modern",
  "tech",
  "custom",
];

const grouped = computed(() => {
  const map = new Map<ThemeGroupId, CardTheme[]>();
  for (const t of themeStore.allThemes) {
    const g: ThemeGroupId = t.builtin ? (t.group ?? "social") : "custom";
    const list = map.get(g) ?? [];
    list.push(t);
    map.set(g, list);
  }
  return groupOrder
    .filter((g) => (map.get(g)?.length ?? 0) > 0)
    .map((g) => ({ id: g, label: THEME_GROUP_LABELS[g], themes: map.get(g)! }));
});

const tabs = computed(() => [
  { id: "all" as const, label: "全部", count: themeStore.allThemes.length },
  ...grouped.value.map((g) => ({ id: g.id, label: g.label, count: g.themes.length })),
]);

const visibleThemes = computed(() => {
  if (activeGroup.value === "all") return themeStore.allThemes;
  return grouped.value.find((g) => g.id === activeGroup.value)?.themes ?? [];
});

watch(
  () => props.open,
  async (v) => {
    if (!v) return;
    activeGroup.value = "all";
    await nextTick();
    storeRef.value
      ?.querySelector<HTMLElement>('[data-testid="kc-theme-store-card"].is-active')
      ?.focus();
  },
);

function close() {
  emit("update:open", false);
}

function selectTheme(id: string) {
  themeStore.setTheme(id);
  close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    close();
  }
}

function skinLabel(theme: CardTheme) {
  return themeSkinLabel(theme);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="storeRef"
      class="kc-theme-store-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kc-theme-store-title"
      data-testid="kc-theme-store"
      @keydown="onKeydown"
      @click.self="close"
    >
      <div class="kc-theme-store">
        <header class="kc-theme-store__header">
          <div class="kc-theme-store__heading">
            <LayoutTemplate class="h-4 w-4 text-[var(--color-paw)]" aria-hidden="true" />
            <div>
              <h2 id="kc-theme-store-title" class="kc-theme-store__title">主题商店</h2>
              <p class="kc-theme-store__sub">
                找到 {{ themeStore.allThemes.length }} 套主题 · 点击缩略图即可应用
              </p>
            </div>
          </div>
          <button
            type="button"
            class="kc-btn kc-btn--icon"
            title="关闭"
            aria-label="关闭主题商店"
            @click="close"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div class="kc-theme-store__tabs" role="tablist" aria-label="主题分组">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            class="kc-theme-store__tab"
            :class="{ 'is-active': activeGroup === tab.id }"
            :aria-selected="activeGroup === tab.id"
            @click="activeGroup = tab.id"
          >
            {{ tab.label }}
            <span class="kc-theme-store__tab-count">{{ tab.count }}</span>
          </button>
        </div>

        <div v-if="visibleThemes.length === 0" class="kc-theme-store__empty">
          <p>当前分组暂无主题</p>
          <button type="button" class="kc-btn kc-btn--primary" @click="emit('customize')">
            去自定义
          </button>
        </div>

        <div v-else class="kc-theme-store__grid" role="list">
          <button
            v-for="theme in visibleThemes"
            :key="theme.id"
            type="button"
            role="listitem"
            class="kc-theme-store__card"
            :class="{ 'is-active': theme.id === themeStore.currentThemeId }"
            data-testid="kc-theme-store-card"
            :aria-pressed="theme.id === themeStore.currentThemeId"
            :aria-label="`应用主题 ${theme.name}`"
            @click="selectTheme(theme.id)"
          >
            <div
              class="kc-thumb"
              :class="[
                `skin-${themeSkin(theme)}`,
                `chrome-${theme.decorations.chrome ?? 'default'}`,
                theme.colors.headingGradient ? 'has-grad' : '',
              ]"
              :style="themeThumbStyle(theme)"
              aria-hidden="true"
            >
              <div v-if="theme.decorations.topAccentBar" class="kc-thumb__topbar" />
              <div
                v-if="
                  (theme.decorations.chrome ?? 'default') !== 'default' &&
                  theme.decorations.chrome !== 'window'
                "
                class="kc-thumb__chrome"
              >
                <span class="kc-thumb__chip">1/1</span>
                <span class="kc-thumb__brand">
                  {{ theme.decorations.brandLabel || themeChromeLabel(theme) }}
                </span>
              </div>
              <div v-else-if="theme.decorations.chrome === 'window'" class="kc-thumb__winbar">
                <i /><i /><i />
                <span>{{ theme.decorations.windowTitle || "窗口" }}</span>
              </div>
              <h3 class="kc-thumb__h1">读书笔记</h3>
              <p class="kc-thumb__p">
                这是一段
                <strong>说明文字</strong>
              </p>
              <ul class="kc-thumb__list">
                <li>要点一</li>
                <li>要点二</li>
              </ul>
              <div class="kc-thumb__h2">章节</div>
              <blockquote class="kc-thumb__quote">引用示例</blockquote>
            </div>

            <div class="kc-theme-store__meta">
              <div class="kc-theme-store__meta-row">
                <span class="kc-theme-store__name">{{ theme.name }}</span>
                <Check
                  v-if="theme.id === themeStore.currentThemeId"
                  class="h-3.5 w-3.5 shrink-0 text-[var(--color-paw)]"
                  aria-hidden="true"
                />
              </div>
              <p class="kc-theme-store__desc">
                {{ theme.description || skinLabel(theme) }}
              </p>
              <div class="kc-theme-store__tags">
                <span class="kc-theme-store__tag">{{ skinLabel(theme) }}</span>
                <span v-if="!theme.builtin" class="kc-theme-store__tag kc-theme-store__tag--custom">
                  自定义
                </span>
              </div>
            </div>
          </button>
        </div>

        <footer class="kc-theme-store__footer">
          <p class="kc-theme-store__hint">当前：{{ themeStore.currentTheme.name }}</p>
          <button
            type="button"
            class="kc-btn"
            data-testid="kc-theme-store-customize"
            @click="emit('customize')"
          >
            自定义主题
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
