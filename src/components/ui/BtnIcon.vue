<script setup lang="ts">
import { computed, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    label: string;
    size?: "sm" | "md";
    pressed?: boolean;
    disabled?: boolean;
  }>(),
  {
    size: "sm",
    disabled: false,
  },
);

const emit = defineEmits<{ click: [event: MouseEvent] }>();
const attrs = useAttrs();

const classes = computed(() => [
  "focus-ring inline-flex items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-[var(--color-text)] disabled:opacity-40",
  props.size === "sm" ? "h-7 w-7" : "h-8 w-8",
  props.pressed ? "bg-surface-3 text-[var(--color-text)]" : "",
]);
</script>

<template>
  <button
    type="button"
    role="button"
    v-bind="attrs"
    :class="classes"
    :aria-label="label"
    :title="label"
    :aria-pressed="pressed !== undefined ? pressed : undefined"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>
