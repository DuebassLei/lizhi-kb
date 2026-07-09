<script setup lang="ts">
import { computed } from "vue";
import { markdownToPreviewHtml } from "../../utils/markdownPreview";

const props = defineProps<{
  content: string;
  /** 时间线卡片：限制高度并淡出，仍按文档格式渲染 */
  clamp?: boolean;
}>();

const html = computed(() => markdownToPreviewHtml(props.content || ""));
</script>

<template>
  <div
    class="journal-doc markdown-preview"
    :class="{ 'journal-doc--clamp': clamp }"
    v-html="html"
  />
</template>

<style scoped>
.journal-doc {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: none;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  line-height: 1.65;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: normal;
}

.journal-doc--clamp {
  max-height: 8.5rem;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
}

.journal-doc :deep(*) {
  max-width: 100%;
}

.journal-doc :deep(h1),
.journal-doc :deep(h2),
.journal-doc :deep(h3),
.journal-doc :deep(h4),
.journal-doc :deep(h5),
.journal-doc :deep(h6) {
  margin: 0.55em 0 0.3em;
  color: var(--color-text);
  font-weight: 600;
  line-height: 1.35;
}

.journal-doc :deep(h1:first-child),
.journal-doc :deep(h2:first-child),
.journal-doc :deep(h3:first-child),
.journal-doc :deep(h4:first-child) {
  margin-top: 0;
}

.journal-doc :deep(h1) {
  font-size: 1.125rem;
}

.journal-doc :deep(h2) {
  font-size: 1rem;
  padding-bottom: 0.15rem;
  border-bottom: 1px solid var(--color-divider);
}

.journal-doc :deep(h3) {
  font-size: 0.9375rem;
}

.journal-doc :deep(h4),
.journal-doc :deep(h5),
.journal-doc :deep(h6) {
  font-size: 0.875rem;
}

.journal-doc :deep(p) {
  margin: 0.4em 0;
}

.journal-doc :deep(p:first-child) {
  margin-top: 0;
}

.journal-doc :deep(p:last-child) {
  margin-bottom: 0;
}

.journal-doc :deep(ul),
.journal-doc :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.35em;
}

.journal-doc :deep(ul) {
  list-style-type: disc;
}

.journal-doc :deep(ol) {
  list-style-type: decimal;
}

.journal-doc :deep(li) {
  margin: 0.2em 0;
}

.journal-doc :deep(blockquote.preview-blockquote) {
  margin: 0.5em 0;
  padding: 0.25em 0 0.25em 0.75em;
  border-left: 3px solid color-mix(in srgb, var(--color-paw) 50%, transparent);
  color: var(--color-muted);
}

.journal-doc :deep(hr.preview-hr) {
  margin: 0.65em 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

.journal-doc :deep(.preview-inline-code) {
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  padding: 0.1em 0.35em;
  font-family: var(--font-mono);
  font-size: 0.85em;
}

.journal-doc :deep(pre.preview-code-block) {
  margin: 0.5em 0;
  overflow-x: auto;
  border-radius: var(--radius-md);
  background: var(--color-surface-0);
  padding: 0.5em 0.65em;
  font-size: 0.8em;
}

.journal-doc :deep(pre.preview-code-block code) {
  font-family: var(--font-mono);
  white-space: pre;
}

.journal-doc :deep(.preview-link) {
  color: var(--color-link);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.journal-doc :deep(.wiki-link) {
  color: inherit;
  text-decoration: none;
  cursor: default;
}

.journal-doc :deep(strong) {
  color: var(--color-text);
  font-weight: 600;
}
</style>
