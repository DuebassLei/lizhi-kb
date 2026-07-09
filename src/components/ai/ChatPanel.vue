<script setup lang="ts">
import { useChatPanelResize } from "../../composables/useChatPanelResize";
import AiChatShell from "./AiChatShell.vue";

const { widthPx, dragging, onResizeStart } = useChatPanelResize();
</script>

<template>
  <div
    class="relative flex min-h-0 shrink-0 flex-col border-l border-border bg-surface-0"
    :style="{ width: `${widthPx}px` }"
    data-testid="chat-panel"
  >
    <div
      class="chat-panel-resize-handle"
      :class="{ 'chat-panel-resize-handle--active': dragging }"
      role="separator"
      aria-orientation="vertical"
      aria-label="调整 AI 面板宽度"
      data-testid="chat-panel-resize-handle"
      @pointerdown="onResizeStart"
    />
    <AiChatShell variant="panel" class="min-h-0 flex-1" />
  </div>
</template>
