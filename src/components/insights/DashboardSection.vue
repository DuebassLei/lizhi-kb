<script setup lang="ts">
import type { Component } from "vue";
import SectionCard from "../common/SectionCard.vue";

defineProps<{
  title: string;
  subtitle?: string;
  icon?: Component;
  fill?: boolean;
}>();
</script>

<template>
  <SectionCard :title="title" :subtitle="subtitle" :icon="icon" :fill="fill">
    <slot />
  </SectionCard>
</template>
