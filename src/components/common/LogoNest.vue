<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number;
  }>(),
  { size: 22 },
);
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    class="logo-nest"
  >
    <circle
      cx="16"
      cy="18"
      r="10"
      class="logo-nest__ring"
      stroke-width="1.5"
      fill="none"
      opacity="0.9"
    />
    <path
      d="M8 20c2-4 6-8 8-10 2 2 6 6 8 10"
      class="logo-nest__peak"
      stroke-width="1.5"
      stroke-linecap="round"
      fill="none"
    />
    <circle cx="16" cy="16" r="3" class="logo-nest__core" opacity="0.9" />
  </svg>
</template>
