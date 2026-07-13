<script setup lang="ts">
import { X } from "@lucide/vue";

import { useCcWorkbenchDrawerResize } from "../../composables/useCcWorkbenchDrawerResize";
import Btn from "../ui/Btn.vue";
import CcWorkbenchSettingsShell from "./CcWorkbenchSettingsShell.vue";

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const { widthPx, dragging, onResizeStart } = useCcWorkbenchDrawerResize();
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex justify-end"
        data-testid="cc-workbench-drawer"
      >
        <button
          type="button"
          class="absolute inset-0 bg-overlay backdrop-blur-[2px]"
          aria-label="关闭设置"
          @click="emit('close')"
        />

        <aside
          class="cc-workbench-drawer relative flex h-full shrink-0 flex-col border-l border-border bg-surface-0 shadow-xl"
          :style="{ width: `${widthPx}px` }"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cc-workbench-drawer-title"
        >
          <div
            class="chat-panel-resize-handle"
            :class="{ 'chat-panel-resize-handle--active': dragging }"
            role="separator"
            aria-orientation="vertical"
            aria-label="调整设置面板宽度"
            data-testid="cc-workbench-drawer-resize-handle"
            @pointerdown="onResizeStart"
          />

          <header class="shrink-0 border-b border-border px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 id="cc-workbench-drawer-title" class="text-sm font-semibold">工作台设置</h2>
                <p class="mt-0.5 text-xs text-muted">供应商 · SDK · 工作目录 · Skills</p>
              </div>
              <Btn variant="ghost" size="sm" aria-label="关闭" @click="emit('close')">
                <X class="h-4 w-4" />
              </Btn>
            </div>
          </header>

          <CcWorkbenchSettingsShell
            class="min-h-0 flex-1"
            reveal-key-on-mount
            @saved="emit('saved')"
          />
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cc-workbench-drawer {
  animation: cc-drawer-slide 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes cc-drawer-slide {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-active .cc-workbench-drawer,
.drawer-leave-active .cc-workbench-drawer {
  transition: transform 0.2s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .cc-workbench-drawer,
.drawer-leave-to .cc-workbench-drawer {
  transform: translateX(100%);
}
</style>
