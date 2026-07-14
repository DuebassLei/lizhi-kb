<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useContextMenuStore } from "../../stores/contextMenu";

const menu = useContextMenuStore();
const el = ref<HTMLElement | null>(null);
const left = ref(0);
const top = ref(0);

const EDGE = 8;

function onGlobalClick() {
  if (menu.open) menu.hide();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && menu.open) menu.hide();
}

function clampPosition() {
  const node = el.value;
  if (!node || !menu.open) return;

  const rect = node.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let x = menu.x;
  let y = menu.y;

  if (x + rect.width + EDGE > vw) {
    x = Math.max(EDGE, vw - rect.width - EDGE);
  }
  if (y + rect.height + EDGE > vh) {
    // 向上翻：优先贴在指针上方，仍溢出则贴底
    y = Math.max(EDGE, menu.y - rect.height);
    if (y + rect.height + EDGE > vh) {
      y = Math.max(EDGE, vh - rect.height - EDGE);
    }
  }
  if (x < EDGE) x = EDGE;
  if (y < EDGE) y = EDGE;

  left.value = x;
  top.value = y;
}

watch(
  () => [menu.open, menu.x, menu.y, menu.items.length] as const,
  async ([open, x, y]) => {
    if (!open) return;
    left.value = x;
    top.value = y;
    await nextTick();
    // 双 rAF：等 Teleport / 布局完成后再量尺寸
    requestAnimationFrame(() => {
      requestAnimationFrame(() => clampPosition());
    });
  },
);

onMounted(() => {
  window.addEventListener("click", onGlobalClick);
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", clampPosition);
});

onUnmounted(() => {
  window.removeEventListener("click", onGlobalClick);
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", clampPosition);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="menu.open"
      ref="el"
      class="fixed z-[200] min-w-[160px] overflow-hidden rounded-lg border border-border bg-surface-1 py-1 shadow-2xl"
      :style="{ left: `${left}px`, top: `${top}px` }"
      data-testid="context-menu"
      @click.stop
    >
      <button
        v-for="item in menu.items"
        :key="item.id"
        type="button"
        class="block w-full px-3 py-1.5 text-left text-xs transition-colors disabled:opacity-40"
        :class="
          item.danger
            ? 'text-red-400 hover:bg-surface-2'
            : 'text-[var(--color-text)] hover:bg-surface-2'
        "
        :disabled="item.disabled"
        @click="menu.runItem(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>
