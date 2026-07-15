<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { ChevronDown } from "@lucide/vue";
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

const currentThemeName = computed(
  () => WECHAT_THEMES.find((t) => t.id === themeId.value)?.name ?? "选择主题",
);

async function updatePanelPosition() {
  await nextTick();
  const el = rootRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const width = 224; // 14rem
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
      class="toolbar-chip focus-ring flex h-7 w-full min-w-0 max-w-full cursor-pointer items-center justify-between gap-1 px-2 text-left text-[11px] text-[var(--color-text)]"
      aria-label="公众号主题"
      :title="`主题：${currentThemeName}`"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :data-testid="testId ?? 'wechat-theme-select'"
      @click.stop="toggle"
    >
      <span class="min-w-0 truncate">{{ currentThemeName }}</span>
      <ChevronDown class="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="scrollbar-thin max-h-[360px] overflow-y-auto rounded-lg border border-border bg-surface-1 p-1"
        :style="{ ...panelStyle, boxShadow: 'var(--shadow-float)' }"
        role="listbox"
        aria-label="公众号主题"
        data-testid="wechat-theme-select-panel"
        @click.stop
      >
        <template v-for="group in themeGroups" :key="group.label">
          <div
            class="px-2 pt-1.5 pb-0.5 text-[10px] font-medium text-text-muted first:pt-0.5"
          >
            {{ group.label }}
          </div>
          <button
            v-for="t in group.themes"
            :key="t.id"
            type="button"
            role="option"
            class="focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-surface-2"
            :class="t.id === themeId ? 'bg-surface-2 text-[var(--color-text)]' : 'text-muted'"
            :aria-selected="t.id === themeId"
            :data-testid="`wechat-theme-option-${t.id}`"
            @click="selectTheme(t.id)"
          >
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
              :style="{ background: t.accent }"
              aria-hidden="true"
            />
            <span class="min-w-0 truncate">{{ t.name }}</span>
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>
