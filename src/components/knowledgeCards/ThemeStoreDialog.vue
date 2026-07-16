<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Check, LayoutTemplate, Pencil, Trash2, X } from "@lucide/vue";
import ConfirmDialog from "../common/ConfirmDialog.vue";
import { useKnowledgeCardThemeStore } from "../../stores/knowledgeCardTheme";
import {
  THEME_GROUP_LABELS,
  type CardTheme,
  type ThemeGroupId,
} from "../../themes/knowledgeCards/types";
import {
  themeSkin,
  themeSkinLabel,
  themeThumbStyle,
} from "../../utils/knowledgeCards/themeThumb";
import { useUiStore } from "../../stores/ui";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  edit: [themeId: string];
}>();

const themeStore = useKnowledgeCardThemeStore();
const ui = useUiStore();

const activeGroup = ref<ThemeGroupId | "all">("all");
const storeRef = ref<HTMLElement | null>(null);
const pendingDelete = ref<CardTheme | null>(null);

const groupOrder: ThemeGroupId[] = [
  "cartoon",
  "pro",
  "fun",
  "cute",
  "tech",
  "custom",
];

const grouped = computed(() => {
  const map = new Map<ThemeGroupId, CardTheme[]>();
  for (const t of themeStore.allThemes) {
    const g: ThemeGroupId = t.builtin ? (t.group ?? "cartoon") : "custom";
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
    if (!v) {
      pendingDelete.value = null;
      return;
    }
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

function onEdit(theme: CardTheme, e: Event) {
  e.stopPropagation();
  emit("edit", theme.id);
  close();
}

function onDeleteClick(theme: CardTheme, e: Event) {
  e.stopPropagation();
  if (theme.builtin) return;
  pendingDelete.value = theme;
}

function confirmDelete() {
  const theme = pendingDelete.value;
  pendingDelete.value = null;
  if (!theme || theme.builtin) return;
  themeStore.removeCustomTheme(theme.id);
  ui.showToast("success", `已删除「${theme.name}」`);
}

function cancelDelete() {
  pendingDelete.value = null;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    if (pendingDelete.value) {
      cancelDelete();
      return;
    }
    close();
  }
}

function skinLabel(theme: CardTheme) {
  return themeSkinLabel(theme);
}

function editTitle(theme: CardTheme) {
  return theme.builtin ? "复制并编辑" : "编辑主题";
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
        </div>

        <div v-else class="kc-theme-store__grid" role="list">
          <div
            v-for="theme in visibleThemes"
            :key="theme.id"
            role="listitem"
            class="kc-theme-store__card"
            :class="{ 'is-active': theme.id === themeStore.currentThemeId }"
            data-testid="kc-theme-store-card"
            tabindex="0"
            :aria-pressed="theme.id === themeStore.currentThemeId"
            :aria-label="`应用主题 ${theme.name}`"
            @click="selectTheme(theme.id)"
            @keydown.enter.prevent="selectTheme(theme.id)"
            @keydown.space.prevent="selectTheme(theme.id)"
          >
            <div
              class="kc-thumb"
              :class="[
                `skin-${themeSkin(theme)}`,
                theme.colors.headingGradient ? 'has-grad' : '',
              ]"
              :style="themeThumbStyle(theme)"
              aria-hidden="true"
            >
              <div v-if="theme.decorations.topAccentBar" class="kc-thumb__topbar" />
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
              <div class="kc-theme-store__meta-foot">
                <div class="kc-theme-store__tags">
                  <span
                    v-if="!theme.builtin"
                    class="kc-theme-store__tag kc-theme-store__tag--custom"
                  >
                    自定义
                  </span>
                </div>
                <div class="kc-theme-store__actions" @click.stop>
                  <button
                    type="button"
                    class="kc-theme-store__action"
                    data-testid="kc-theme-store-edit"
                    :title="editTitle(theme)"
                    :aria-label="editTitle(theme)"
                    @click="onEdit(theme, $event)"
                  >
                    <Pencil class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    v-if="!theme.builtin"
                    type="button"
                    class="kc-theme-store__action kc-theme-store__action--danger"
                    data-testid="kc-theme-store-delete"
                    title="删除主题"
                    aria-label="删除主题"
                    @click="onDeleteClick(theme, $event)"
                  >
                    <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer class="kc-theme-store__footer">
          <p class="kc-theme-store__hint">当前：{{ themeStore.currentTheme.name }}</p>
        </footer>
      </div>
    </div>

    <ConfirmDialog
      :open="Boolean(pendingDelete)"
      title="删除主题"
      :item-name="pendingDelete?.name"
      description="删除后不可恢复。若当前正在使用该主题，将回退到默认主题。"
      confirm-label="删除"
      destructive
      test-id="kc-theme-store-delete-confirm"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </Teleport>
</template>
