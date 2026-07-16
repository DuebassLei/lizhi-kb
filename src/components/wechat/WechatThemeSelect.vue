<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { Check, ChevronDown } from "@lucide/vue";
import {
  getWechatThemeGroups,
  WECHAT_THEMES,
  type WechatThemeId,
} from "../../services/wechatExport";

const props = withDefaults(
  defineProps<{
    testId?: string;
    menuAlign?: "left" | "right";
  }>(),
  { menuAlign: "left" },
);

const themeId = defineModel<WechatThemeId>({ required: true });

const themeGroups = getWechatThemeGroups();
const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});

const currentTheme = computed(
  () => WECHAT_THEMES.find((t) => t.id === themeId.value) ?? null,
);

const currentThemeName = computed(() => currentTheme.value?.name ?? "选择主题");

async function updatePanelPosition() {
  await nextTick();
  const el = rootRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const width = 300;
  const left =
    props.menuAlign === "right"
      ? Math.max(8, rect.right - width)
      : Math.min(rect.left, window.innerWidth - width - 8);
  const maxH = Math.min(440, Math.max(280, window.innerHeight - rect.bottom - 16));
  panelStyle.value = {
    position: "fixed",
    top: `${rect.bottom + 4}px`,
    left: `${Math.max(8, left)}px`,
    width: `${width}px`,
    maxHeight: `${maxH}px`,
    zIndex: "80",
  };
}

async function toggle() {
  open.value = !open.value;
  if (open.value) await updatePanelPosition();
}

function close() {
  if (!open.value) return;
  open.value = false;
}

function selectTheme(id: WechatThemeId) {
  themeId.value = id;
  close();
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return;
  const t = e.target as Node;
  if (rootRef.value?.contains(t) || panelRef.value?.contains(t)) return;
  close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) {
    e.preventDefault();
    close();
  }
}

function onWindowChange() {
  if (open.value) void updatePanelPosition();
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onWindowChange);
  window.addEventListener("scroll", onWindowChange, true);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", onWindowChange);
  window.removeEventListener("scroll", onWindowChange, true);
});
</script>

<template>
  <div ref="rootRef" class="relative min-w-0 max-w-full">
    <button
      type="button"
      class="toolbar-chip focus-ring flex h-7 w-full min-w-0 max-w-full cursor-pointer items-center justify-between gap-1.5 px-2 text-left text-[11px] text-[var(--color-text)]"
      aria-label="公众号主题"
      :title="`主题：${currentThemeName}`"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :data-testid="testId ?? 'wechat-theme-select'"
      @click.stop="toggle"
    >
      <span
        v-if="currentTheme"
        class="wechat-theme-trigger__swatch"
        :style="{ background: currentTheme.accent, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${currentTheme.accent} 40%, #000)` }"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1 truncate">{{ currentThemeName }}</span>
      <ChevronDown class="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="wechat-theme-menu scrollbar-thin overflow-y-auto rounded-lg border border-border bg-surface-1 p-1.5"
        :style="{ ...panelStyle, boxShadow: 'var(--shadow-float)' }"
        role="listbox"
        aria-label="公众号主题"
        data-testid="wechat-theme-select-panel"
        @click.stop
      >
        <section
          v-for="group in themeGroups"
          :key="group.label"
          class="wechat-theme-group"
        >
          <header class="wechat-theme-group__label">{{ group.label }}</header>
          <button
            v-for="t in group.themes"
            :key="t.id"
            type="button"
            role="option"
            class="wechat-theme-item focus-ring"
            :class="{ 'wechat-theme-item--active': t.id === themeId }"
            :aria-selected="t.id === themeId"
            :data-testid="`wechat-theme-option-${t.id}`"
            @click="selectTheme(t.id)"
          >
            <!-- 迷你排版预览：底色 + 标题色条 + 假正文线 -->
            <span
              class="wechat-theme-preview"
              :style="{ background: t.bg }"
              aria-hidden="true"
            >
              <span
                class="wechat-theme-preview__bar"
                :style="{ background: t.accent }"
              />
              <span class="wechat-theme-preview__body">
                <span
                  class="wechat-theme-preview__title"
                  :style="{ background: t.accent }"
                />
                <span class="wechat-theme-preview__line" />
                <span class="wechat-theme-preview__line wechat-theme-preview__line--short" />
              </span>
            </span>

            <span class="wechat-theme-item__meta">
              <span class="wechat-theme-item__name">{{ t.name }}</span>
              <span class="wechat-theme-item__hint">
                <span
                  class="wechat-theme-item__dot"
                  :style="{ background: t.accent }"
                />
                {{ t.tier === 'basic' ? '基础' : '进阶' }}
              </span>
            </span>

            <Check
              v-if="t.id === themeId"
              class="wechat-theme-item__check"
              aria-hidden="true"
            />
          </button>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.wechat-theme-trigger__swatch {
  width: 0.625rem;
  height: 0.625rem;
  flex-shrink: 0;
  border-radius: 999px;
}

.wechat-theme-group + .wechat-theme-group {
  margin-top: 0.375rem;
  padding-top: 0.375rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
}

.wechat-theme-group__label {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.3rem 0.375rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--color-muted);
  background: color-mix(in srgb, var(--color-surface-1) 92%, transparent);
  backdrop-filter: blur(4px);
}

.wechat-theme-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.625rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  padding: 0.375rem;
  text-align: left;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition:
    background-color 120ms ease-out,
    color 120ms ease-out;
}

.wechat-theme-item:hover,
.wechat-theme-item:focus-visible {
  background: var(--color-surface-2);
  color: var(--color-text);
}

.wechat-theme-item--active {
  background: color-mix(in srgb, var(--color-paw) 12%, var(--color-surface-2));
  color: var(--color-text);
}

.wechat-theme-preview {
  display: flex;
  width: 3.75rem;
  height: 2.25rem;
  flex-shrink: 0;
  gap: 0.3rem;
  overflow: hidden;
  border-radius: 0.375rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  padding: 0.3rem 0.35rem;
}

.wechat-theme-preview__bar {
  width: 2.5px;
  flex-shrink: 0;
  border-radius: 1px;
  align-self: stretch;
}

.wechat-theme-preview__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.2rem;
  justify-content: center;
}

.wechat-theme-preview__title {
  display: block;
  height: 3px;
  width: 72%;
  border-radius: 1px;
  opacity: 0.9;
}

.wechat-theme-preview__line {
  display: block;
  height: 2px;
  width: 100%;
  border-radius: 1px;
  background: color-mix(in srgb, #64748b 22%, transparent);
}

.wechat-theme-preview__line--short {
  width: 58%;
}

.wechat-theme-item__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
}

.wechat-theme-item__name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wechat-theme-item__hint {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.625rem;
  color: var(--color-muted);
  line-height: 1.3;
}

.wechat-theme-item__dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.wechat-theme-item__check {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  color: var(--color-paw);
  stroke-width: 2.5;
}
</style>
