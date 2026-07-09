<script setup lang="ts">
import type { Citation } from "../../stores/chat";

defineProps<{
  citations: Citation[];
}>();

const emit = defineEmits<{
  open: [id: string];
}>();
</script>

<template>
  <div v-if="citations.length" class="mt-3 flex flex-wrap gap-1.5 border-t border-divider/80 pt-3">
    <span class="w-full text-[10px] font-medium tracking-wide text-muted">引用来源</span>
    <button
      v-for="c in citations"
      :key="c.id"
      type="button"
      class="focus-ring max-w-full truncate rounded-md border border-border bg-surface-0 px-2 py-1 text-xs text-link transition-colors hover:border-link/30 hover:bg-link/8"
      :title="c.title"
      @click="emit('open', c.id)"
    >
      {{ c.title }}
    </button>
  </div>
</template>
