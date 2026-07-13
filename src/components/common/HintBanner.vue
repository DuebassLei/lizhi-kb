<script setup lang="ts">
import type { Component } from "vue";
import { AlertTriangle, CheckCircle2, Info } from "@lucide/vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    message?: string;
    variant?: "info" | "success" | "warning" | "blocking";
    icon?: Component;
    testId?: string;
  }>(),
  { variant: "info" },
);

const defaultIcon = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  blocking: AlertTriangle,
} as const;
</script>

<template>
  <div
    class="hint-banner"
    :class="`hint-banner--${props.variant}`"
    :data-testid="testId"
    role="status"
  >
    <div class="hint-banner__main">
      <component
        :is="icon ?? defaultIcon[variant]"
        class="hint-banner__icon"
        aria-hidden="true"
      />
      <div class="hint-banner__text">
        <p v-if="title" class="hint-banner__title">{{ title }}</p>
        <p v-if="message || $slots.default" class="hint-banner__message">
          <slot>{{ message }}</slot>
        </p>
      </div>
    </div>
    <div v-if="$slots.action" class="hint-banner__actions">
      <slot name="action" />
    </div>
  </div>
</template>
