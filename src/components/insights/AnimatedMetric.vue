<script setup lang="ts">
import { computed, toRef } from "vue";
import { useCountUp } from "../../composables/useCountUp";

const props = defineProps<{
  value: number;
  locale?: boolean;
  suffix?: string;
  decimals?: number;
}>();

const target = toRef(() => props.value);
const { formatted } = useCountUp(target, {
  locale: props.locale ?? false,
  decimals: props.decimals ?? 0,
});

const displayText = computed(() => {
  const n = formatted();
  return props.suffix ? `${n}${props.suffix}` : n;
});
</script>

<template>
  <span class="tabular-nums">{{ displayText }}</span>
</template>
