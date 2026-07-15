<script setup lang="ts">
defineProps<{
  type: "none" | "flower" | "triangle" | "dot" | "wave";
}>();
</script>

<template>
  <template v-if="type && type !== 'none'">
    <span class="knowledge-card__corner knowledge-card__corner--tl" :class="type" aria-hidden="true" />
    <span class="knowledge-card__corner knowledge-card__corner--tr" :class="type" aria-hidden="true" />
    <span class="knowledge-card__corner knowledge-card__corner--bl" :class="type" aria-hidden="true" />
    <span class="knowledge-card__corner knowledge-card__corner--br" :class="type" aria-hidden="true" />
  </template>
</template>
