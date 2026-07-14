<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { ChevronDown } from "@lucide/vue";
import { LAYOUT_MODULE_SNIPPETS } from "../../services/wechatExport";

const emit = defineEmits<{
  insert: [snippet: string];
}>();

withDefaults(
  defineProps<{
    testId?: string;
    menuAlign?: "left" | "right";
  }>(),
  { menuAlign: "left" },
);

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function close() {
  if (!open.value) return;
  open.value = false;
}

function selectModule(snippet: string) {
  emit("insert", snippet);
  close();
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return;
  const root = rootRef.value;
  if (root && !root.contains(e.target as Node)) close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) {
    e.preventDefault();
    close();
  }
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
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

    <div
      v-if="open"
      class="scrollbar-thin absolute top-full z-50 mt-1 w-[11rem] max-h-[280px] overflow-y-auto rounded-lg border border-border bg-surface-1 p-1"
      :class="menuAlign === 'right' ? 'right-0' : 'left-0'"
      :style="{ boxShadow: 'var(--shadow-float)' }"
      role="menu"
      aria-label="插入布局模块"
      data-testid="wechat-module-select-panel"
      @click.stop
    >
      <button
        v-for="s in LAYOUT_MODULE_SNIPPETS"
        :key="s.label"
        type="button"
        role="menuitem"
        class="focus-ring flex w-full items-center rounded-md px-2 py-1 text-left text-xs text-muted transition-colors hover:bg-surface-2 hover:text-[var(--color-text)]"
        :data-testid="`wechat-module-option-${s.label}`"
        @click="selectModule(s.snippet)"
      >
        {{ s.label }}
      </button>
    </div>
  </div>
</template>
