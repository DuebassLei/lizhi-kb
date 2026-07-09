<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useContextMenuStore } from "../../stores/contextMenu";

const menu = useContextMenuStore();

function onGlobalClick() {
  if (menu.open) menu.hide();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && menu.open) menu.hide();
}

onMounted(() => {
  window.addEventListener("click", onGlobalClick);
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  window.removeEventListener("click", onGlobalClick);
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="menu.open"
      class="fixed z-[200] min-w-[160px] overflow-hidden rounded-lg border border-border bg-surface-1 py-1 shadow-2xl"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
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
