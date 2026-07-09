<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <section class="space-y-3">
    <header>
      <h2 class="text-sm font-medium uppercase tracking-wide text-text-secondary">
        {{ title }}
      </h2>
      <p v-if="subtitle" class="mt-0.5 text-xs text-muted">{{ subtitle }}</p>
    </header>
    <div class="rounded-lg border border-border bg-surface-0 p-5">
      <slot />
    </div>
  </section>
</template>
