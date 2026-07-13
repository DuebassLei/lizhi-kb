<script setup lang="ts">
import type { Component } from "vue";

withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    icon?: Component;
    iconAccent?: "paw" | "link" | "secure";
    bordered?: boolean;
    testId?: string;
  }>(),
  {
    iconAccent: "paw",
    bordered: true,
  },
);
</script>

<template>
  <header
    class="page-header"
    :class="{ 'page-header--flat': !bordered }"
    :data-testid="testId"
  >
    <div class="page-header__inner">
      <div class="page-header__lead">
        <span
          v-if="icon"
          class="page-header__icon"
          :class="`page-header__icon--${iconAccent}`"
          aria-hidden="true"
        >
          <component :is="icon" class="h-4 w-4" />
        </span>
        <div class="page-header__titles">
          <h1 class="page-header__title">{{ title }}</h1>
          <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <div v-if="$slots.actions" class="page-header__actions">
        <slot name="actions" />
      </div>
    </div>
    <div v-if="$slots.stats" class="page-header__stats">
      <slot name="stats" />
    </div>
    <div v-if="$slots.toolbar" class="page-header__toolbar">
      <slot name="toolbar" />
    </div>
  </header>
</template>
