<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    size?: "sm" | "md" | "lg";
  }>(),
  { size: "md" },
);
</script>

<template>
  <div
    class="empty-state"
    :class="`empty-state--${size}`"
    role="status"
  >
    <div
      v-if="$slots.icon"
      class="empty-state__icon"
      aria-hidden="true"
    >
      <slot name="icon" />
    </div>
    <div class="empty-state__copy">
      <p class="empty-state__title">{{ title }}</p>
      <p v-if="description" class="empty-state__desc">{{ description }}</p>
      <p v-if="$slots.hint" class="empty-state__hint">
        <slot name="hint" />
      </p>
    </div>
    <div v-if="$slots.action" class="empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0 1.5rem;
  text-align: center;
}

.empty-state--sm {
  gap: 0.75rem;
}

.empty-state--lg {
  gap: 1.25rem;
  padding: 2rem 1.5rem;
}

.empty-state__icon {
  display: flex;
  height: 4rem;
  width: 4rem;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  border: 1px dashed color-mix(in srgb, var(--color-border) 90%, transparent);
  background: color-mix(in srgb, var(--color-surface-1) 55%, transparent);
  color: var(--color-paw);
}

.empty-state--sm .empty-state__icon {
  height: 3rem;
  width: 3rem;
  border-radius: 0.75rem;
}

.empty-state__title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
}

.empty-state__desc {
  margin: 0.25rem 0 0;
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--color-muted);
}

.empty-state__hint {
  margin: 0.5rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.45;
  color: color-mix(in srgb, var(--color-paw) 65%, var(--color-muted));
}

.empty-state__action {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}
</style>
