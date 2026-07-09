<script setup lang="ts">
import { computed } from "vue";
import { useChatStore } from "../../stores/chat";
import type { RagSurface } from "../../stores/chat";

const props = withDefaults(
  defineProps<{
    surface?: RagSurface;
  }>(),
  { surface: "workspace" },
);

const emit = defineEmits<{
  select: [text: string];
}>();

const chat = useChatStore();

const prompts = computed(() => {
  const base = [
    "天翼云 SD-WAN 改造要点",
    "业务受理流程有哪些步骤",
    "ICT 产品录入流程",
  ];
  if (props.surface === "workspace") {
    base.push("总结当前文档核心内容");
  }
  return base;
});
</script>

<template>
  <div class="flex w-full max-w-md flex-col items-center gap-3">
    <p class="text-xs text-muted">试试这些问题</p>
    <div class="flex flex-wrap justify-center gap-2">
      <button
        v-for="prompt in prompts"
        :key="prompt"
        type="button"
        class="focus-ring rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs text-muted transition-colors hover:border-link/30 hover:bg-link/8 hover:text-link"
        :disabled="chat.isStreaming"
        data-testid="rag-prompt-chip"
        @click="emit('select', prompt)"
      >
        {{ prompt }}
      </button>
    </div>
  </div>
</template>
