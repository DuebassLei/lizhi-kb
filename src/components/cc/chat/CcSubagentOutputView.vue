<script setup lang="ts">
import { computed, ref } from "vue";

import { parseSubagentOutputRaw } from "../../../utils/ccSubagentOutput";
import { markdownToPreviewHtml } from "../../../utils/markdownPreview";

const props = defineProps<{
  output?: string | null;
}>();

const expandedThinking = ref<Record<number, boolean>>({});

const segments = computed(() => parseSubagentOutputRaw(props.output ?? undefined));

const hasContent = computed(() => segments.value.length > 0);

function segmentHtml(content: string): string {
  return markdownToPreviewHtml(content);
}

function isThinkingExpanded(index: number): boolean {
  return expandedThinking.value[index] ?? false;
}

function toggleThinking(index: number) {
  expandedThinking.value = {
    ...expandedThinking.value,
    [index]: !isThinkingExpanded(index),
  };
}
</script>

<template>
  <div v-if="hasContent" class="cc-subagent-output">
    <template v-for="(segment, index) in segments" :key="index">
      <div v-if="segment.type === 'thinking'" class="cc-subagent-output__thinking">
        <button
          type="button"
          class="cc-subagent-output__thinking-toggle"
          @click="toggleThinking(index)"
        >
          <span>{{ isThinkingExpanded(index) ? "▼" : "▶" }}</span>
          <span>思考过程</span>
        </button>
        <div v-show="isThinkingExpanded(index)" class="cc-subagent-output__thinking-body">
          <p class="whitespace-pre-wrap">{{ segment.content }}</p>
        </div>
      </div>

      <div
        v-else
        class="cc-subagent-output__prose"
        v-html="segmentHtml(segment.content)"
      />
    </template>
  </div>
  <p v-else class="cc-subagent-output__empty">暂无输出内容。</p>
</template>

<style scoped>
.cc-subagent-output {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cc-subagent-output__thinking {
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: color-mix(in srgb, var(--color-surface-1) 50%, transparent);
  overflow: hidden;
}

.cc-subagent-output__thinking-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.375rem;
  border: none;
  background: transparent;
  padding: 0.4375rem 0.625rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
  cursor: pointer;
  text-align: left;
}

.cc-subagent-output__thinking-toggle:hover {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
}

.cc-subagent-output__thinking-body {
  border-top: 1px solid var(--color-border);
  padding: 0.625rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-muted);
}

.cc-subagent-output__prose {
  font-size: 0.8125rem;
  line-height: 1.6;
  word-break: break-word;
}

.cc-subagent-output__prose :deep(p) {
  margin: 0.5rem 0;
}

.cc-subagent-output__prose :deep(p:first-child) {
  margin-top: 0;
}

.cc-subagent-output__prose :deep(h1),
.cc-subagent-output__prose :deep(h2),
.cc-subagent-output__prose :deep(h3) {
  margin: 0.75rem 0 0.375rem;
  font-weight: 600;
}

.cc-subagent-output__prose :deep(pre.preview-code-block) {
  margin: 0.5rem 0;
  padding: 0.625rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 60%, transparent);
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  line-height: 1.45;
}

.cc-subagent-output__prose :deep(.preview-inline-code) {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  padding: 0.05rem 0.3rem;
  font-family: var(--font-mono);
  font-size: 0.88em;
}

.cc-subagent-output__prose :deep(.hljs-comment),
.cc-subagent-output__prose :deep(.hljs-quote) {
  color: var(--color-muted);
  font-style: italic;
}

.cc-subagent-output__prose :deep(.hljs-keyword),
.cc-subagent-output__prose :deep(.hljs-selector-tag),
.cc-subagent-output__prose :deep(.hljs-built_in) {
  color: #c678dd;
}

.cc-subagent-output__prose :deep(.hljs-string),
.cc-subagent-output__prose :deep(.hljs-attr) {
  color: #98c379;
}

.cc-subagent-output__prose :deep(.hljs-number),
.cc-subagent-output__prose :deep(.hljs-literal) {
  color: #d19a66;
}

.cc-subagent-output__prose :deep(.hljs-title),
.cc-subagent-output__prose :deep(.hljs-section) {
  color: var(--color-link);
}

.cc-subagent-output__empty {
  font-size: 0.6875rem;
  color: var(--color-muted);
}
</style>
