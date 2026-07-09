<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

export type DropdownItem = {
  id: string;
  label: string;
  icon?: unknown;
  pressed?: boolean;
  disabled?: boolean;
  testId?: string;
  onClick: () => void;
};

defineProps<{
  items: DropdownItem[];
  label?: string;
  align?: "left" | "right";
  testId?: string;
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function onItemClick(item: DropdownItem) {
  if (item.disabled) return;
  item.onClick();
  close();
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return;
  const root = rootRef.value;
  if (root && !root.contains(e.target as Node)) close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) close();
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
});

defineExpose({ close, toggle, open });
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      role="button"
      class="focus-ring btn-ghost inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted"
      :aria-expanded="open"
      aria-haspopup="menu"
      :data-testid="testId"
      @click.stop="toggle"
    >
      <slot name="trigger">
        {{ label ?? "更多" }}
      </slot>
    </button>

    <div
      v-if="open"
      class="absolute z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-border bg-surface-1 py-1"
      :class="align === 'left' ? 'left-0' : 'right-0'"
      :style="{ boxShadow: 'var(--shadow-float)' }"
      role="menu"
      @click.stop
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        role="menuitem"
        class="focus-ring flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-2 disabled:opacity-40"
        :class="item.pressed ? 'text-[var(--color-text)] bg-surface-2/60' : 'text-muted'"
        :disabled="item.disabled"
        :data-testid="item.testId"
        @click="onItemClick(item)"
      >
        <component :is="item.icon" v-if="item.icon" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </button>
      <slot name="footer" />
    </div>
  </div>
</template>
