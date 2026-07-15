<script setup lang="ts">
import type { CardTheme } from "../../themes/knowledgeCards/types";

defineProps<{
  theme: CardTheme;
}>();
</script>

<template>
  <div
    v-if="theme.decorations.headerStyle && theme.decorations.headerStyle !== 'none'"
    class="knowledge-card__header"
    :class="`knowledge-card__header--${theme.decorations.headerStyle}`"
  >
    {{ theme.name }}
  </div>
</template>
