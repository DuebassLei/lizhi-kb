<script setup lang="ts">
import { computed } from "vue";
import { parseTopicLabel } from "../../utils/mindmap/parseTopicLabel";

const props = defineProps<{
  text: string;
  /** root 居中 */
  centered?: boolean;
}>();

const parsed = computed(() => parseTopicLabel(props.text));
</script>

<template>
  <span class="mm-node__label" :class="{ 'mm-node__label--center': centered }">
    <span class="mm-node__title">{{ parsed.title }}</span>
    <span v-for="tag in parsed.tags" :key="tag" class="mm-tag">#{{ tag }}</span>
  </span>
</template>
