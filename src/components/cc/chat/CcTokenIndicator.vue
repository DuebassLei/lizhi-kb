<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    percentage: number;
    usedTokens?: number;
    maxTokens?: number;
    size?: number;
  }>(),
  { size: 18 },
);

const clampedPct = computed(() => {
  const raw = props.percentage;
  const pct = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  return Math.max(0, Math.min(100, pct));
});

const isHigh = computed(() => clampedPct.value >= 85);
const isWarn = computed(() => clampedPct.value >= 60 && !isHigh.value);

const radius = computed(() => (props.size - 4) / 2);
const center = computed(() => props.size / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const strokeOffset = computed(() => circumference.value * (1 - clampedPct.value / 100));
const label = computed(() => `${Math.round(clampedPct.value)}%`);

const strokeColor = computed(() => {
  const pct = clampedPct.value;
  if (pct >= 85) return "var(--cc-token-danger, #ef4444)";
  if (pct >= 60) return "var(--cc-token-warn, #f59e0b)";
  return "var(--cc-token-ok, var(--color-link))";
});

const tooltip = computed(() => {
  const pct = (Math.round(clampedPct.value * 10) / 10).toFixed(1);
  const used = formatTokens(props.usedTokens);
  const max = formatTokens(props.maxTokens);
  if (used && max) return `${pct}% · ${used} / ${max} 上下文`;
  return `${pct}% 上下文占用`;
});

function formatTokens(value?: number): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return Number.isInteger(m) ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(value);
}
</script>

<template>
  <div
    class="cc-token-indicator"
    :class="{
      'cc-token-indicator--high': isHigh,
      'cc-token-indicator--warn': isWarn,
    }"
    :title="tooltip"
    role="status"
    :aria-label="tooltip"
  >
    <svg
      class="cc-token-indicator__ring"
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      aria-hidden="true"
    >
      <circle
        class="cc-token-indicator__bg"
        :cx="center"
        :cy="center"
        :r="radius"
      />
      <circle
        class="cc-token-indicator__fill"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke="strokeColor"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="strokeOffset"
      />
    </svg>
    <span class="cc-token-indicator__label">{{ label }}</span>
  </div>
</template>

<style scoped>
.cc-token-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  color: var(--color-muted);
  cursor: default;
  user-select: none;
}

.cc-token-indicator__ring {
  flex-shrink: 0;
  transform: rotate(-90deg);
}

.cc-token-indicator__bg,
.cc-token-indicator__fill {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
}

.cc-token-indicator__bg {
  stroke: color-mix(in srgb, var(--color-text) 12%, transparent);
}

.cc-token-indicator__fill {
  transition: stroke-dashoffset 0.25s ease, stroke 0.25s ease;
  filter: drop-shadow(0 0 2px color-mix(in srgb, var(--color-link) 50%, transparent));
}

.cc-token-indicator--high .cc-token-indicator__fill {
  filter: drop-shadow(0 0 3px color-mix(in srgb, var(--cc-token-danger, #ef4444) 60%, transparent));
  animation: cc-token-pulse 1.4s ease-in-out infinite;
}

.cc-token-indicator--warn .cc-token-indicator__fill {
  filter: drop-shadow(0 0 2px color-mix(in srgb, var(--cc-token-warn, #f59e0b) 50%, transparent));
}

.cc-token-indicator__label {
  font-size: 0.6875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--color-text);
}

.cc-token-indicator--high .cc-token-indicator__label {
  color: var(--cc-token-danger, #ef4444);
}

.cc-token-indicator--warn .cc-token-indicator__label {
  color: var(--cc-token-warn, #f59e0b);
}

@keyframes cc-token-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.65;
  }
}
</style>
