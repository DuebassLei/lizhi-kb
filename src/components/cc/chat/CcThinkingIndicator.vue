<script setup lang="ts">
import { Sparkles } from "@lucide/vue";

withDefaults(
  defineProps<{
    label?: string;
    hideIcon?: boolean;
  }>(),
  {
    label: "思考中…",
    hideIcon: false,
  },
);
</script>

<template>
  <div class="cc-thinking-indicator" aria-live="polite">
    <span v-if="!hideIcon" class="cc-thinking-indicator__icon" aria-hidden="true">
      <Sparkles class="h-3.5 w-3.5" />
    </span>
    <div class="cc-thinking-indicator__bubble">
      <span class="cc-thinking-indicator__dots" aria-hidden="true">
        <span class="cc-thinking-indicator__dot" />
        <span class="cc-thinking-indicator__dot cc-thinking-indicator__dot--delay-1" />
        <span class="cc-thinking-indicator__dot cc-thinking-indicator__dot--delay-2" />
      </span>
      <span class="cc-thinking-indicator__label">{{ label }}</span>
    </div>
  </div>
</template>

<style scoped>
.cc-thinking-indicator {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.cc-thinking-indicator__icon {
  display: flex;
  height: 1.75rem;
  width: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 20%, transparent);
  animation: cc-thinking-icon-pulse 1.5s ease-in-out infinite;
}

.cc-thinking-indicator__bubble {
  display: inline-flex;
  min-width: 8rem;
  flex: 1;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent);
  background: color-mix(in srgb, var(--color-surface-1) 90%, transparent);
  padding: 0.75rem 1rem;
  color: var(--color-link);
}

.cc-thinking-indicator__dots {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.cc-thinking-indicator__dot {
  display: inline-block;
  height: 0.35rem;
  width: 0.35rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.35;
  animation: cc-thinking-dot-bounce 1.2s ease-in-out infinite;
}

.cc-thinking-indicator__dot--delay-1 {
  animation-delay: 150ms;
}

.cc-thinking-indicator__dot--delay-2 {
  animation-delay: 300ms;
}

.cc-thinking-indicator__label {
  font-size: 0.8125rem;
  line-height: 1.4;
  color: color-mix(in srgb, var(--color-link) 88%, var(--color-muted));
}

@keyframes cc-thinking-dot-bounce {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

@keyframes cc-thinking-icon-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.72;
    transform: scale(1.06);
  }
}
</style>
