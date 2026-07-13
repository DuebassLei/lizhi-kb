<script setup lang="ts">
import { computed, ref } from "vue";

import { handlePreviewCodeCopyClick } from "../../../composables/cc/usePreviewCodeCopy";
import { useUiStore } from "../../../stores/ui";
import { parseSubagentOutputRaw } from "../../../utils/ccSubagentOutput";
import { markdownToPreviewHtml } from "../../../utils/markdownPreview";

const props = defineProps<{
  output?: string | null;
}>();

const ui = useUiStore();
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

function onProseClick(event: MouseEvent) {
  void handlePreviewCodeCopyClick(event, ui.showToast.bind(ui));
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
        @click="onProseClick"
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

.cc-subagent-output__prose :deep(p:last-child) {
  margin-bottom: 0;
}

.cc-subagent-output__prose :deep(h1) {
  margin: 1rem 0 0.4rem;
  font-size: 1.05em;
  font-weight: 600;
}

.cc-subagent-output__prose :deep(h2) {
  margin: 1rem 0 0.45rem;
  font-size: 1em;
  font-weight: 600;
}

.cc-subagent-output__prose :deep(h3),
.cc-subagent-output__prose :deep(h4) {
  margin: 0.85rem 0 0.35rem;
  font-size: 0.92em;
  font-weight: 600;
}

.cc-subagent-output__prose :deep(ul),
.cc-subagent-output__prose :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.35rem;
}

.cc-subagent-output__prose :deep(ul) {
  list-style-type: disc;
}

.cc-subagent-output__prose :deep(ol) {
  list-style-type: decimal;
}

.cc-subagent-output__prose :deep(li) {
  margin: 0.3rem 0;
}

.cc-subagent-output__prose :deep(hr.preview-hr) {
  margin: 0.85rem 0;
  border: none;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent);
}

.cc-subagent-output__prose :deep(blockquote.preview-blockquote) {
  margin: 0.65rem 0;
  border-left: 2px solid color-mix(in srgb, var(--color-muted) 40%, transparent);
  padding: 0.15rem 0 0.15rem 0.7rem;
  color: var(--color-muted);
}

.cc-subagent-output__prose :deep(strong) {
  font-weight: 600;
}

.cc-subagent-output__prose :deep(.preview-code-wrap) {
  margin: 0.5rem 0;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 60%, transparent);
  overflow: hidden;
}

.cc-subagent-output__prose :deep(.preview-code-toolbar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
}

.cc-subagent-output__prose :deep(.preview-code-lang) {
  font-size: 0.625rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
  text-transform: lowercase;
}

.cc-subagent-output__prose :deep(.preview-code-copy) {
  border: none;
  background: transparent;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  color: var(--color-muted);
  cursor: pointer;
  border-radius: 0.25rem;
}

.cc-subagent-output__prose :deep(.preview-code-copy:hover) {
  color: var(--color-link);
  background: color-mix(in srgb, var(--color-surface-0) 70%, transparent);
}

.cc-subagent-output__prose :deep(pre.preview-code-block) {
  margin: 0;
  padding: 0.625rem 0.75rem;
  border: none;
  border-radius: 0;
  background: transparent;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  line-height: 1.45;
}

.cc-subagent-output__prose :deep(.preview-inline-code) {
  display: inline-block;
  border-radius: 0.3125rem;
  border: none;
  background: color-mix(in srgb, var(--color-muted) 11%, var(--color-surface-1));
  padding: 0.12rem 0.42rem;
  font-family: var(--font-mono);
  font-size: 0.84em;
  line-height: 1.35;
  color: color-mix(in srgb, var(--color-text) 88%, var(--color-muted));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-border) 55%, transparent);
}

.cc-subagent-output__prose :deep(.preview-file-ref) {
  border: none;
  background: transparent;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 0.88em;
  color: var(--color-link);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-link) 35%, transparent);
  text-underline-offset: 0.12em;
}

.cc-subagent-output__prose :deep(.preview-file-ref:hover) {
  color: color-mix(in srgb, var(--color-link) 82%, var(--color-text));
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
