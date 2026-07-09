<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 px-6 text-center">
    <div
      v-if="$slots.icon"
      class="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-1 text-paw"
    >
      <slot name="icon" />
    </div>
    <div class="space-y-1">
      <p class="text-sm font-medium text-[var(--color-text)]">{{ title }}</p>
      <p v-if="description" class="text-xs text-muted">{{ description }}</p>
    </div>
    <slot name="action" />
  </div>
</template>
