<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { resolveAssetUrl, isAssetRef } from "../../services/assetService";
import { useDocumentsStore } from "../../stores/documents";
import { useUiStore } from "../../stores/ui";
import { markdownToPreviewHtml } from "../../utils/markdownPreview";
import { handlePreviewCodeCopyClick } from "../../composables/cc/usePreviewCodeCopy";

const props = defineProps<{
  content: string;
  typewriter?: boolean;
}>();

const documents = useDocumentsStore();
const ui = useUiStore();
const containerRef = ref<HTMLElement | null>(null);
const html = ref("");

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleHtmlUpdate() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    html.value = markdownToPreviewHtml(props.content || "");
    void nextTick(() => resolvePreviewAssets());
  }, 200);
}

defineExpose({ containerRef });

const themeClass = computed(() => `preview-theme-${ui.previewTheme}`);

async function resolvePreviewAssets() {
  const el = containerRef.value;
  if (!el) return;
  const imgs = el.querySelectorAll<HTMLImageElement>("img[data-asset-ref]");
  for (const img of imgs) {
    const ref = img.dataset.assetRef ?? img.getAttribute("src") ?? "";
    if (!isAssetRef(ref)) continue;
    try {
      img.src = await resolveAssetUrl(ref);
    } catch {
      img.alt = "图片加载失败";
    }
  }
}

async function onClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest(".preview-code-copy") || target.closest(".preview-file-ref")) {
    await handlePreviewCodeCopyClick(event, (type, message) => ui.showToast(type, message));
    return;
  }

  const wikiEl = target.closest("[data-wiki-title]") as HTMLElement | null;
  if (!wikiEl?.dataset.wikiTitle) return;

  const title = wikiEl.dataset.wikiTitle;
  const heading = wikiEl.dataset.wikiHeading?.trim();
  if (event.metaKey || event.ctrlKey) {
    void documents.openWikiLinkInNewTab(title);
  } else if (heading) {
    void documents.openWikiLink(title).then(() => {
      ui.requestHeadingScroll(heading);
    });
  } else {
    void documents.openWikiLink(title);
  }
  event.preventDefault();
}

watch(
  () => props.content,
  () => scheduleHtmlUpdate(),
  { immediate: true },
);

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <article
    ref="containerRef"
    class="markdown-preview scrollbar-thin h-full min-h-0 overflow-y-auto overflow-x-hidden"
    :class="[{ 'typewriter-preview': typewriter }, themeClass]"
    data-testid="markdown-preview"
    @click="onClick"
    v-html="html"
  />
</template>

<style scoped>
.markdown-preview {
  max-width: var(--measure-prose);
  margin: 0 auto;
  padding: 1.5rem 1.5rem 3rem;
  color: var(--color-text);
  font-size: var(--text-md);
  line-height: var(--leading-prose);
  box-sizing: border-box;
}

@media (min-width: 640px) {
  .markdown-preview {
    padding-left: 2.5rem;
    padding-right: 2.5rem;
  }
}

@media (min-width: 1024px) {
  .markdown-preview {
    padding-left: 4rem;
    padding-right: 4rem;
  }
}

.markdown-preview :deep(h1) {
  font-size: var(--text-2xl);
  font-weight: 600;
  line-height: var(--leading-tight);
  margin: 1.75rem 0 0.875rem;
  color: var(--color-text);
}

.markdown-preview :deep(h2) {
  font-size: var(--text-xl);
  font-weight: 600;
  line-height: var(--leading-tight);
  margin: 1.5rem 0 0.625rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--color-divider);
}

.markdown-preview :deep(h3) {
  font-size: var(--text-lg);
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
}

.markdown-preview :deep(p) {
  margin: 0.75rem 0;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.5rem;
}

.markdown-preview :deep(li) {
  margin: 0.35rem 0;
}

.markdown-preview :deep(ul) {
  list-style-type: disc;
}

.markdown-preview :deep(ol) {
  list-style-type: decimal;
}

.markdown-preview :deep(blockquote.preview-blockquote) {
  border-left: 3px solid var(--color-paw);
  margin: 1rem 0;
  padding: 0.25rem 0 0.25rem 1rem;
  color: var(--color-muted);
  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.markdown-preview :deep(hr.preview-hr) {
  border: none;
  border-top: 1px solid var(--color-border-strong);
  margin: 1.5rem 0;
}

.markdown-preview :deep(.preview-inline-code) {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.1rem 0.35rem;
  font-family: var(--font-mono);
  font-size: 0.88em;
}

.markdown-preview :deep(.preview-code-wrap) {
  margin: 1rem 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  overflow: hidden;
}

.markdown-preview :deep(.preview-code-toolbar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
}

.markdown-preview :deep(.preview-code-lang) {
  font-size: 0.6875rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
  text-transform: lowercase;
}

.markdown-preview :deep(.preview-code-copy) {
  border: none;
  background: transparent;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.markdown-preview :deep(.preview-code-copy:hover) {
  color: var(--color-link);
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
}

.markdown-preview :deep(pre.preview-code-block) {
  position: relative;
  background: transparent;
  border: none;
  border-radius: 0;
  margin: 0;
  padding: 0.875rem 1rem;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.875em;
  line-height: 1.55;
}

.markdown-preview :deep(pre.preview-code-block code) {
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
}

.markdown-preview :deep(.hljs-comment),
.markdown-preview :deep(.hljs-quote) {
  color: var(--color-muted);
  font-style: italic;
}

.markdown-preview :deep(.hljs-keyword),
.markdown-preview :deep(.hljs-selector-tag),
.markdown-preview :deep(.hljs-built_in) {
  color: #c678dd;
}

.markdown-preview :deep(.hljs-string),
.markdown-preview :deep(.hljs-attr) {
  color: #98c379;
}

.markdown-preview :deep(.hljs-number),
.markdown-preview :deep(.hljs-literal) {
  color: #d19a66;
}

.markdown-preview :deep(.hljs-title),
.markdown-preview :deep(.hljs-section) {
  color: var(--color-link);
}

.markdown-preview :deep(.preview-link) {
  color: var(--color-link);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-link) 35%, transparent);
}

.markdown-preview :deep(.preview-link:hover) {
  color: var(--color-link-hover);
}

.markdown-preview :deep(.preview-table-wrap) {
  margin: 1rem 0;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.markdown-preview :deep(.preview-table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.markdown-preview :deep(.preview-table th),
.markdown-preview :deep(.preview-table td) {
  border: 1px solid var(--color-border);
  padding: 0.5rem 0.75rem;
  text-align: left;
  vertical-align: top;
}

.markdown-preview :deep(.preview-table th) {
  background: var(--color-surface-1);
  font-weight: 600;
}

.markdown-preview :deep(.preview-table tr:nth-child(even) td) {
  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);
}

.markdown-preview :deep(.preview-img) {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  margin: 1rem 0;
  border: 1px solid var(--color-border);
}

.markdown-preview :deep(.wiki-link) {
  color: var(--color-link);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-link) 40%, transparent);
}

.markdown-preview :deep(.wiki-link:hover) {
  color: var(--color-link-hover);
}

.typewriter-preview {
  max-width: var(--measure-prose);
  padding-top: 35vh;
  padding-bottom: 50vh;
}

/* ── 预览排版主题 ── */

.preview-theme-document {
  max-width: 780px;
  font-size: 1.125rem;
  line-height: 1.75;
}

.preview-theme-document :deep(h1) {
  font-size: 2rem;
  margin: 2rem 0 1rem;
}

.preview-theme-document :deep(h2) {
  font-size: 1.375rem;
  margin: 1.75rem 0 0.75rem;
}

.preview-theme-document :deep(h3) {
  font-size: 1.1875rem;
  margin: 1.5rem 0 0.625rem;
}

.preview-theme-document :deep(p) {
  margin: 1rem 0;
}

.preview-theme-document :deep(li) {
  margin: 0.5rem 0;
}

.preview-theme-compact {
  max-width: 640px;
  font-size: 0.9375rem;
  line-height: 1.5;
  padding-top: 1rem;
  padding-bottom: 2rem;
}

.preview-theme-compact :deep(h1) {
  font-size: var(--text-xl);
  margin: 1.25rem 0 0.5rem;
}

.preview-theme-compact :deep(h2) {
  font-size: var(--text-lg);
  margin: 1rem 0 0.375rem;
}

.preview-theme-compact :deep(h3) {
  font-size: var(--text-md);
  margin: 0.875rem 0 0.25rem;
}

.preview-theme-compact :deep(p) {
  margin: 0.5rem 0;
}

.preview-theme-compact :deep(ul),
.preview-theme-compact :deep(ol) {
  margin: 0.5rem 0;
}

.preview-theme-compact :deep(li) {
  margin: 0.2rem 0;
}

.preview-theme-compact :deep(blockquote.preview-blockquote) {
  margin: 0.625rem 0;
}

.preview-theme-compact :deep(.preview-code-wrap) {
  margin: 0.625rem 0;
}

.preview-theme-compact :deep(pre.preview-code-block) {
  padding: 0.625rem 0.75rem;
}

.preview-theme-mono {
  max-width: 680px;
  font-family: var(--font-mono);
  font-size: 0.9375rem;
  line-height: 1.65;
  letter-spacing: 0.01em;
}

.preview-theme-mono :deep(h1),
.preview-theme-mono :deep(h2),
.preview-theme-mono :deep(h3) {
  font-family: var(--font-ui);
  letter-spacing: normal;
}

:deep(.preview-wechat-callout) {
  border-left-color: color-mix(in srgb, var(--color-link) 70%, transparent);
  background: color-mix(in srgb, var(--color-link) 6%, var(--color-surface-0));
  color: var(--color-text-secondary);
}

:deep(.preview-task-list) {
  list-style: none;
  padding-left: 0;
}

:deep(.preview-task-item) {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

:deep(.preview-task-box) {
  flex-shrink: 0;
  font-size: 0.85em;
  line-height: 1.5;
}

:deep(.preview-task-item--done span:last-child) {
  opacity: 0.65;
  text-decoration: line-through;
}

:deep(.preview-mermaid) {
  margin: 0.75rem 0;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-0);
  padding: 0.75rem;
}

:deep(.preview-mermaid-label) {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-link);
  margin-bottom: 0.5rem;
}

:deep(.preview-mermaid-code) {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  white-space: pre-wrap;
  color: var(--color-muted);
}

.preview-theme-mono :deep(p) {
  margin: 0.875rem 0;
}
</style>
