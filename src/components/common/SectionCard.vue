<script setup lang="ts">
import { ref } from "vue";
import type { Component } from "vue";
import { useInViewMotion } from "../../composables/useInViewMotion";

defineProps<{
  title: string;
  subtitle?: string;
  testId?: string;
  icon?: Component;
  /** Stretch card body to fill grid cell height (for paired dashboard rows). */
  fill?: boolean;
}>();

const root = ref<HTMLElement | null>(null);
const inView = useInViewMotion(root, { threshold: 0.12, once: true });
</script>

<template>
  <section
    ref="root"
    class="section-card"
    :class="{ 'section-card--in-view': inView, 'section-card--fill': fill }"
    :data-testid="testId"
  >
    <header class="section-card__header">
      <div class="flex items-center gap-2">
        <component
          :is="icon"
          v-if="icon"
          :size="14"
          class="text-paw/80"
          aria-hidden="true"
        />
        <h2 class="section-card__title">{{ title }}</h2>
      </div>
      <p v-if="subtitle" class="section-card__subtitle">{{ subtitle }}</p>
    </header>
    <div class="section-card__body">
      <slot />
    </div>
  </section>
</template>
