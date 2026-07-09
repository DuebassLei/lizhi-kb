<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "md";
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    pressed?: boolean;
  }>(),
  {
    variant: "ghost",
    size: "sm",
    disabled: false,
    type: "button",
  },
);

const classes = computed(() => {
  const base = ["focus-ring"];
  if (props.variant === "primary") base.push("btn-primary");
  else if (props.variant === "secondary") base.push("btn-secondary");
  else base.push("btn-ghost");

  if (props.size === "sm") base.push("h-7 px-2 text-xs");
  else base.push("h-8 px-3 text-sm");

  if (props.pressed) base.push("bg-surface-2 text-[var(--color-text)]");
  return base;
});
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled"
    :aria-pressed="pressed !== undefined ? pressed : undefined"
    role="button"
  >
    <slot />
  </button>
</template>
