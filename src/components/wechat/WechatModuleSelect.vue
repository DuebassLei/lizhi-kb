<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { ChevronDown } from "@lucide/vue";
import {
  LAYOUT_MODULE_GROUPS,
  LAYOUT_MODULE_SNIPPETS,
  type LayoutModuleSnippet,
} from "../../services/wechatExport";

const emit = defineEmits<{
  insert: [snippet: string];
}>();

const props = withDefaults(
  defineProps<{
    testId?: string;
    menuAlign?: "left" | "right";
  }>(),
  { menuAlign: "left" },
);

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});

const groupedModules = computed(() =>
  LAYOUT_MODULE_GROUPS.map((g) => ({
    ...g,
    items: LAYOUT_MODULE_SNIPPETS.filter((s) => s.group === g.id),
  })).filter((g) => g.items.length > 0),
);

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
  panelStyle.value = {
    position: "fixed",
    top: `${rect.bottom + 4}px`,
    left: `${Math.max(8, left)}px`,
    width: `${width}px`,
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

function selectModule(snippet: string) {
  emit("insert", snippet);
  close();
}

function previewBg(accent: string): string {
  return `color-mix(in srgb, ${accent} 12%, #fff)`;
}

function sketchKind(s: LayoutModuleSnippet): LayoutModuleSnippet["kind"] {
  return s.kind;
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
      class="toolbar-chip focus-ring flex h-7 w-full min-w-0 max-w-full cursor-pointer items-center justify-between gap-1 px-2 text-left text-[11px] text-[var(--color-text)]"
      aria-label="插入布局模块"
      title="插入布局模块"
      :aria-expanded="open"
      aria-haspopup="menu"
      :data-testid="testId ?? 'wechat-module-select'"
      @click.stop="toggle"
    >
      <span class="min-w-0 truncate">插入模块</span>
      <ChevronDown class="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="wechat-module-menu scrollbar-thin max-h-[min(440px,72vh)] overflow-y-auto rounded-lg border border-border bg-surface-1 p-1.5"
        :style="{ ...panelStyle, boxShadow: 'var(--shadow-float)' }"
        role="menu"
        aria-label="插入布局模块"
        data-testid="wechat-module-select-panel"
        @click.stop
      >
        <section
          v-for="group in groupedModules"
          :key="group.id"
          class="wechat-module-group"
        >
          <header class="wechat-module-group__label">{{ group.label }}</header>
          <button
            v-for="s in group.items"
            :key="s.id"
            type="button"
            role="menuitem"
            class="wechat-module-item focus-ring"
            :data-testid="`wechat-module-option-${s.id}`"
            @click="selectModule(s.snippet)"
          >
            <span
              class="wechat-module-preview"
              :style="{
                borderLeftColor: s.accent,
                background: previewBg(s.accent),
              }"
              aria-hidden="true"
            >
              <span class="wechat-module-preview__icon" :style="{ color: s.accent }">{{ s.icon }}</span>
              <span class="wechat-module-preview__sketch">
                <template v-if="['callout', 'quote', 'lead', 'author', 'golden', 'engage'].includes(sketchKind(s))">
                  <span class="wechat-module-preview__line wechat-module-preview__line--title" :style="{ background: s.accent }" />
                  <span class="wechat-module-preview__line" />
                  <span class="wechat-module-preview__line wechat-module-preview__line--short" />
                </template>
                <template v-else-if="s.kind === 'steps' || s.kind === 'checklist' || s.kind === 'summary'">
                  <span class="wechat-module-preview__dots"><i /><i /><i /></span>
                </template>
                <template v-else-if="s.kind === 'timeline'">
                  <span class="wechat-module-preview__timeline"><i /><i /><i /></span>
                </template>
                <template v-else-if="s.kind === 'compare' || s.kind === 'myth'">
                  <span class="wechat-module-preview__split"><em /><em /></span>
                </template>
                <template v-else-if="s.kind === 'columns' || s.kind === 'stats'">
                  <span class="wechat-module-preview__cols"><em /><em /><em /></span>
                </template>
                <template v-else-if="s.kind === 'faq'">
                  <span class="wechat-module-preview__timeline"><i /><i /></span>
                </template>
                <template v-else-if="s.kind === 'cta' || s.kind === 'support'">
                  <span class="wechat-module-preview__cta" :style="{ background: s.accent }" />
                </template>
                <template v-else-if="s.kind === 'divider'">
                  <span class="wechat-module-preview__divider" :style="{ background: s.accent }" />
                </template>
                <template v-else-if="s.kind === 'code'">
                  <span class="wechat-module-preview__code"><em /><em /><em /></span>
                </template>
                <template v-else>
                  <span class="wechat-module-preview__table"><em /><em /></span>
                </template>
              </span>
            </span>

            <span class="wechat-module-item__meta">
              <span class="wechat-module-item__title">{{ s.title }}</span>
              <span class="wechat-module-item__hint">{{ s.hint }}</span>
            </span>
          </button>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.wechat-module-group + .wechat-module-group {
  margin-top: 0.375rem;
  padding-top: 0.375rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
}

.wechat-module-group__label {
  padding: 0.25rem 0.375rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--color-muted);
}

.wechat-module-item {
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
  transition: background-color 120ms ease-out;
}

.wechat-module-item:hover,
.wechat-module-item:focus-visible {
  background: var(--color-surface-2);
}

.wechat-module-preview {
  display: flex;
  width: 4.75rem;
  height: 2.25rem;
  flex-shrink: 0;
  align-items: center;
  gap: 0.25rem;
  border-left: 3px solid;
  border-radius: 0 0.375rem 0.375rem 0;
  padding: 0.25rem 0.375rem;
}

.wechat-module-preview__icon {
  flex-shrink: 0;
  font-size: 0.6875rem;
  line-height: 1;
}

.wechat-module-preview__sketch {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
  justify-content: center;
}

.wechat-module-preview__line {
  display: block;
  height: 2px;
  width: 100%;
  border-radius: 1px;
  background: color-mix(in srgb, #64748b 28%, transparent);
}

.wechat-module-preview__line--title {
  width: 70%;
  height: 2.5px;
  opacity: 0.85;
}

.wechat-module-preview__line--short {
  width: 45%;
}

.wechat-module-preview__dots,
.wechat-module-preview__timeline,
.wechat-module-preview__split,
.wechat-module-preview__cols,
.wechat-module-preview__code,
.wechat-module-preview__table {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.wechat-module-preview__dots i {
  display: block;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 999px;
  background: color-mix(in srgb, #2563eb 55%, #94a3b8);
}

.wechat-module-preview__timeline {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.12rem;
  width: 100%;
}

.wechat-module-preview__timeline i {
  display: block;
  height: 2px;
  width: 100%;
  border-radius: 1px;
  background: color-mix(in srgb, #0891b2 45%, #94a3b8);
}

.wechat-module-preview__timeline i:nth-child(2) {
  width: 75%;
}

.wechat-module-preview__timeline i:nth-child(3) {
  width: 55%;
}

.wechat-module-preview__split,
.wechat-module-preview__cols {
  width: 100%;
  gap: 0.15rem;
}

.wechat-module-preview__split em,
.wechat-module-preview__cols em {
  display: block;
  flex: 1;
  height: 1.1rem;
  border-radius: 2px;
  background: color-mix(in srgb, #94a3b8 35%, transparent);
  font-style: normal;
}

.wechat-module-preview__cta {
  display: block;
  width: 100%;
  height: 0.75rem;
  border-radius: 999px;
  opacity: 0.85;
}

.wechat-module-preview__divider {
  display: block;
  width: 100%;
  height: 1.5px;
  border-radius: 1px;
  opacity: 0.7;
}

.wechat-module-preview__code {
  flex-direction: column;
  align-items: stretch;
  gap: 0.12rem;
  width: 100%;
}

.wechat-module-preview__code em {
  display: block;
  height: 2px;
  border-radius: 1px;
  background: color-mix(in srgb, #0f172a 40%, #94a3b8);
  font-style: normal;
}

.wechat-module-preview__code em:nth-child(1) {
  width: 80%;
}
.wechat-module-preview__code em:nth-child(2) {
  width: 95%;
}
.wechat-module-preview__code em:nth-child(3) {
  width: 60%;
}

.wechat-module-preview__table {
  flex-direction: column;
  width: 100%;
  gap: 0.15rem;
}

.wechat-module-preview__table em {
  display: block;
  height: 0.4rem;
  border-radius: 1px;
  background: color-mix(in srgb, #334155 30%, #94a3b8);
  font-style: normal;
}

.wechat-module-item__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
}

.wechat-module-item__title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.25;
}

.wechat-module-item__hint {
  font-size: 0.625rem;
  color: var(--color-muted);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
