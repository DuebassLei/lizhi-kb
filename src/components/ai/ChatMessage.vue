<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Clock, Sparkles } from "@lucide/vue";

import { markdownToPreviewHtml } from "../../utils/markdownPreview";
import { formatDurationMs, formatTokenCount } from "../../utils/chatMessageMeta";
import {
  blocksToRenderSegments,
  messageHasVisibleBlocks,
  resolveMessageBlocks,
} from "../../utils/ccMessageBlocks";
import type { UiChatMessage } from "../../stores/chat";
import CitationChip from "./CitationChip.vue";
import ChatToolCalls from "./ChatToolCalls.vue";

const props = defineProps<{
  message: UiChatMessage;
  isLast?: boolean;
  isThinking?: boolean;
}>();

const emit = defineEmits<{
  openCitation: [id: string];
  insertToEditor: [content: string];
  createDocument: [content: string];
  insertCitation: [title: string];
}>();

const canWriteToEditor = computed(
  () =>
    isAssistant.value &&
    !props.message.streaming &&
    Boolean(props.message.content?.trim()) &&
    !props.message.error,
);

const expandedThinking = ref<Record<string, boolean>>({});
const manuallyToggled = ref<Record<string, boolean>>({});
const lastAutoExpandedKey = ref<string | null>(null);

const isUser = computed(() => props.message.role === "user");
const isAssistant = computed(() => props.message.role === "assistant");

const blocks = computed(() =>
  resolveMessageBlocks({
    content: props.message.content,
    thinking: props.message.thinking,
  }),
);

const renderSegments = computed(() =>
  blocksToRenderSegments(blocks.value).filter(
    (segment) => segment.type === "thinking" || segment.type === "text",
  ),
);

const isStreamingMessage = computed(
  () => Boolean(props.message.streaming && props.isLast),
);

const isEmptyStreaming = computed(
  () =>
    isStreamingMessage.value &&
    !messageHasVisibleBlocks(blocks.value) &&
    !props.message.toolCalls?.length,
);

const showMeta = computed(
  () =>
    isAssistant.value &&
    !props.message.streaming &&
    (typeof props.message.durationMs === "number" ||
      Boolean(props.message.modelLabel) ||
      (props.message.inputTokens ?? 0) > 0 ||
      (props.message.outputTokens ?? 0) > 0),
);

const metaInputTokens = computed(() => Math.max(0, props.message.inputTokens ?? 0));
const metaOutputTokens = computed(() => Math.max(0, props.message.outputTokens ?? 0));
const metaTotalTokens = computed(() => metaInputTokens.value + metaOutputTokens.value);
const showMetaDuration = computed(
  () => typeof props.message.durationMs === "number" && props.message.durationMs >= 0,
);
const showMetaTokens = computed(
  () => metaInputTokens.value > 0 || metaOutputTokens.value > 0,
);

function segmentHtml(content: string): string {
  return markdownToPreviewHtml(content);
}

function isThinkingExpanded(segment: { key: string; isLastThinking: boolean }): boolean {
  if (expandedThinking.value[segment.key] !== undefined) {
    return expandedThinking.value[segment.key];
  }
  return false;
}

function thinkingTitle(segment: { isLastThinking: boolean }): string {
  return isStreamingMessage.value && segment.isLastThinking && props.isThinking
    ? "思考过程"
    : "思考";
}

function toggleThinking(segment: { key: string; isLastThinking: boolean }) {
  manuallyToggled.value = { ...manuallyToggled.value, [segment.key]: true };
  expandedThinking.value = {
    ...expandedThinking.value,
    [segment.key]: !isThinkingExpanded(segment),
  };
}

watch(
  () => [renderSegments.value, isStreamingMessage.value, props.isThinking] as const,
  () => {
    if (!isStreamingMessage.value) return;

    const thinkingSegments = renderSegments.value.filter((s) => s.type === "thinking");
    const lastSegment = thinkingSegments[thinkingSegments.length - 1];
    if (!lastSegment || lastSegment.type !== "thinking") return;

    if (lastSegment.key === lastAutoExpandedKey.value) return;

    const updates = { ...expandedThinking.value };
    for (const seg of thinkingSegments) {
      if (seg.type !== "thinking") continue;
      if (seg.key !== lastSegment.key && !manuallyToggled.value[seg.key]) {
        updates[seg.key] = false;
      }
    }
    if (!manuallyToggled.value[lastSegment.key] || updates[lastSegment.key] === undefined) {
      updates[lastSegment.key] = true;
    }
    expandedThinking.value = updates;
    lastAutoExpandedKey.value = lastSegment.key;
  },
  { immediate: true },
);

watch(
  () => isStreamingMessage.value,
  (active) => {
    if (!active) lastAutoExpandedKey.value = null;
  },
);
</script>

<template>
  <div
    class="flex w-full gap-2"
    :class="isUser ? 'justify-end' : 'justify-start'"
    :data-testid="`chat-message-${message.role}`"
  >
    <span
      v-if="!isUser"
      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-link/12 text-link ring-1 ring-link/20"
      aria-hidden="true"
    >
      <Sparkles class="h-3.5 w-3.5" />
    </span>

    <div
      class="min-w-0"
      :class="isUser ? 'max-w-[88%]' : 'max-w-full flex-1'"
    >
      <div
        class="text-sm leading-relaxed"
        :class="
          isUser
            ? 'rounded-2xl rounded-br-md bg-link px-3.5 py-2 text-white shadow-sm'
            : 'rounded-xl border border-border/70 bg-surface-1/90 px-3.5 py-3 text-[var(--color-text)]'
        "
      >
        <div v-if="isUser" class="space-y-2">
          <div
            v-if="message.contextFiles?.length || message.agentName"
            class="flex flex-wrap gap-1"
          >
            <span
              v-for="file in message.contextFiles ?? []"
              :key="file"
              class="chat-context-chip"
            >
              @{{ file }}
            </span>
            <span v-if="message.agentName" class="chat-context-chip chat-context-chip--agent">
              #{{ message.agentName }}
            </span>
          </div>
          <div class="whitespace-pre-wrap break-words">{{ message.content }}</div>
        </div>

        <template v-else>
          <div
            v-if="isEmptyStreaming"
            class="flex items-center gap-2 text-muted"
            aria-live="polite"
          >
            <span class="flex gap-1" aria-hidden="true">
              <span class="chat-thinking-dot" />
              <span class="chat-thinking-dot animation-delay-150" />
              <span class="chat-thinking-dot animation-delay-300" />
            </span>
            <span class="text-xs">{{ isThinking ? "思考中…" : "等待回复…" }}</span>
          </div>

          <template v-for="segment in renderSegments" :key="segment.key">
            <div v-if="segment.type === 'thinking'" class="chat-message__thinking">
              <button
                type="button"
                class="chat-message__thinking-header"
                @click="toggleThinking(segment)"
              >
                <span>{{ thinkingTitle(segment) }}</span>
                <span class="chat-message__thinking-icon">
                  {{ isThinkingExpanded(segment) ? "▼" : "▶" }}
                </span>
              </button>
              <div
                v-show="isThinkingExpanded(segment)"
                class="chat-message__thinking-body"
              >
                <p class="whitespace-pre-wrap">{{ segment.content }}</p>
              </div>
            </div>

            <div
              v-else-if="segment.type === 'text'"
              class="chat-prose"
              v-html="segmentHtml(segment.content)"
            />
          </template>

          <p
            v-if="!isEmptyStreaming && !renderSegments.length && !message.error && !message.toolCalls?.length && !isStreamingMessage"
            class="text-xs text-muted"
          >
            （无回复内容）
          </p>
        </template>

        <ChatToolCalls v-if="message.toolCalls?.length" :tools="message.toolCalls" />

        <CitationChip
          v-if="message.citations?.length"
          :citations="message.citations"
          @open="emit('openCitation', $event)"
          @insert="emit('insertCitation', $event)"
        />

        <div
          v-if="canWriteToEditor"
          class="mt-2.5 flex flex-wrap gap-2 border-t border-divider/80 pt-2.5"
          data-testid="chat-message-write-actions"
        >
          <button
            type="button"
            class="focus-ring rounded-md border border-border bg-surface-0 px-2 py-1 text-[11px] text-link hover:border-link/30 hover:bg-link/8"
            data-testid="chat-insert-to-editor"
            @click="emit('insertToEditor', message.content)"
          >
            插入正文
          </button>
          <button
            type="button"
            class="focus-ring rounded-md border border-border bg-surface-0 px-2 py-1 text-[11px] text-link hover:border-link/30 hover:bg-link/8"
            data-testid="chat-create-document"
            @click="emit('createDocument', message.content)"
          >
            新建文档
          </button>
        </div>

        <p v-if="message.error" class="mt-2 text-xs text-danger" role="alert">{{ message.error }}</p>

        <span
          v-if="message.streaming && message.content"
          class="ml-0.5 inline-block h-3.5 w-1 animate-pulse rounded-sm bg-link align-middle"
          aria-hidden="true"
        />

        <div v-if="showMeta" class="chat-message__meta">
          <span class="chat-message__meta-inner">
            <span
              v-if="message.modelLabel"
              class="chat-message__meta-model"
              :title="message.modelLabel"
            >
              {{ message.modelLabel }}
            </span>
            <template v-if="showMetaDuration">
              <span v-if="message.modelLabel" class="chat-message__meta-sep">·</span>
              <Clock class="chat-message__meta-icon" />
              <span>耗时</span>
              <span class="chat-message__meta-mono">{{ formatDurationMs(message.durationMs!) }}</span>
            </template>
            <template v-if="showMetaTokens">
              <span class="chat-message__meta-sep">·</span>
              <span>输入</span>
              <span class="chat-message__meta-mono">{{ formatTokenCount(metaInputTokens) }}</span>
              <span class="chat-message__meta-sep">·</span>
              <span>输出</span>
              <span class="chat-message__meta-mono">{{ formatTokenCount(metaOutputTokens) }}</span>
              <span class="chat-message__meta-sep">·</span>
              <span>合计</span>
              <span class="chat-message__meta-mono">{{ formatTokenCount(metaTotalTokens) }}</span>
            </template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-context-chip {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.14);
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
  line-height: 1.35;
}

.chat-context-chip--agent {
  background: rgb(255 255 255 / 0.2);
}

.chat-thinking-dot {
  display: inline-block;
  height: 0.35rem;
  width: 0.35rem;
  border-radius: 9999px;
  background: var(--color-link);
  opacity: 0.35;
  animation: chat-thinking-bounce 1.2s ease-in-out infinite;
}

.animation-delay-150 {
  animation-delay: 150ms;
}

.animation-delay-300 {
  animation-delay: 300ms;
}

@keyframes chat-thinking-bounce {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.chat-message__thinking {
  margin-bottom: 0.75rem;
}

.chat-message__thinking-header {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-muted);
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s ease;
}

.chat-message__thinking-header:hover {
  opacity: 0.8;
}

.chat-message__thinking-icon {
  font-size: 0.625rem;
  opacity: 0.8;
}

.chat-message__thinking-body {
  margin-top: 0.5rem;
  max-width: 100%;
  border-left: 2px solid color-mix(in srgb, var(--color-muted) 35%, transparent);
  padding-left: 0.75rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-muted);
  word-break: break-word;
}

.chat-message__thinking-body p {
  margin: 0;
  white-space: pre-wrap;
}

.chat-prose {
  font-size: var(--text-sm);
  line-height: 1.65;
  word-break: break-word;
}

.chat-prose :deep(p) {
  margin: 0.5em 0;
}

.chat-prose :deep(p:first-child) {
  margin-top: 0;
}

.chat-prose :deep(p:last-child) {
  margin-bottom: 0;
}

.chat-prose :deep(h1),
.chat-prose :deep(h2),
.chat-prose :deep(h3),
.chat-prose :deep(h4) {
  margin: 0.85em 0 0.4em;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text);
}

.chat-prose :deep(h1) {
  font-size: 1.05em;
}

.chat-prose :deep(h2) {
  font-size: 1em;
}

.chat-prose :deep(h3),
.chat-prose :deep(h4) {
  font-size: 0.95em;
}

.chat-prose :deep(ul),
.chat-prose :deep(ol) {
  margin: 0.55em 0;
  padding-left: 1.25rem;
}

.chat-prose :deep(li) {
  margin: 0.3em 0;
}

.chat-prose :deep(li::marker) {
  color: var(--color-link);
}

.chat-prose :deep(ul) {
  list-style-type: disc;
}

.chat-prose :deep(ol) {
  list-style-type: decimal;
}

.chat-prose :deep(strong) {
  font-weight: 600;
  color: var(--color-text);
}

.chat-prose :deep(blockquote.preview-blockquote) {
  margin: 0.65em 0;
  padding: 0.35rem 0 0.35rem 0.75rem;
  border-left: 3px solid color-mix(in srgb, var(--color-link) 55%, transparent);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: color-mix(in srgb, var(--color-surface-0) 55%, transparent);
  color: var(--color-muted);
}

.chat-prose :deep(hr.preview-hr) {
  margin: 0.75em 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

.chat-prose :deep(.preview-inline-code) {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.1rem 0.35rem;
  font-family: var(--font-mono);
  font-size: 0.88em;
}

.chat-prose :deep(pre.preview-code-block) {
  margin: 0.65em 0;
  overflow-x: auto;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.65rem 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.8em;
  line-height: 1.5;
}

.chat-prose :deep(pre.preview-code-block code) {
  background: none;
  border: none;
  padding: 0;
}

.chat-prose :deep(.preview-link) {
  color: var(--color-link);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.chat-prose :deep(.preview-link:hover) {
  color: var(--color-link-hover);
}

.chat-prose :deep(.preview-img) {
  max-width: 100%;
  border-radius: var(--radius-md);
}

.chat-message__meta {
  margin-top: 0.625rem;
  display: flex;
  justify-content: center;
}

.chat-message__meta-inner {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  border-radius: 0.375rem;
  padding: 0.3125rem 0.75rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.chat-message__meta-model {
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: color-mix(in srgb, var(--color-link) 85%, var(--color-muted));
}

.chat-message__meta-icon {
  height: 0.75rem;
  width: 0.75rem;
  opacity: 0.7;
}

.chat-message__meta-mono {
  font-family: var(--font-mono);
}

.chat-message__meta-sep {
  opacity: 0.5;
}
</style>
