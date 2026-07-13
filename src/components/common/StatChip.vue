<script setup lang="ts">
withDefaults(
  defineProps<{
    accent?: boolean;
  }>(),
  { accent: false },
);
</script>

<template>
  <span class="stat-chip" :class="{ 'stat-chip--accent': accent }">
    <slot />
  </span>
</template>
