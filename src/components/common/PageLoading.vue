<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string;
    size?: "sm" | "md" | "lg";
  }>(),
  {
    message: "加载中…",
    size: "md",
  },
);
</script>

<template>
  <div
    class="page-loading"
    :class="`page-loading--${size}`"
    role="status"
    aria-live="polite"
  >
    <span class="page-loading__spinner" aria-hidden="true" />
    <p class="page-loading__message">{{ message }}</p>
  </div>
</template>
