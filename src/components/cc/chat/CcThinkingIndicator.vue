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
  margin-bottom: 0.5rem;
}

.cc-thinking-indicator__icon {
  display: flex;
  height: 1.875rem;
  width: 1.875rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.5625rem;
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  color: var(--color-link);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 16%, transparent);
  animation: cc-thinking-icon-glow 2s ease-in-out infinite;
}

.cc-thinking-indicator__bubble {
  display: inline-flex;
  align-items: center;
  gap: 0.5625rem;
  border-radius: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-surface-1) 45%, var(--color-surface-0)),
      color-mix(in srgb, var(--color-surface-0) 85%, var(--color-surface-1))
    );
  padding: 0.625rem 0.875rem;
  color: var(--color-link);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--color-base) 15%, transparent);
}

.cc-thinking-indicator__dots {
  display: inline-flex;
  align-items: center;
  gap: 0.21875rem;
}

.cc-thinking-indicator__dot {
  display: inline-block;
  height: 0.3125rem;
  width: 0.3125rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.3;
  animation: cc-thinking-wave 1s ease-in-out infinite;
}

.cc-thinking-indicator__dot--delay-1 {
  animation-delay: 120ms;
}

.cc-thinking-indicator__dot--delay-2 {
  animation-delay: 240ms;
}

.cc-thinking-indicator__label {
  font-size: 0.8125rem;
  line-height: 1.4;
  color: color-mix(in srgb, var(--color-link) 82%, var(--color-muted));
}

@keyframes cc-thinking-wave {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  30% {
    opacity: 1;
    transform: scale(1.35);
  }
}

@keyframes cc-thinking-icon-glow {
  0%, 100% {
    opacity: 0.85;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 16%, transparent);
  }
  50% {
    opacity: 1;
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--color-link) 22%, transparent),
      0 0 12px color-mix(in srgb, var(--color-link) 8%, transparent);
  }
}
</style>
