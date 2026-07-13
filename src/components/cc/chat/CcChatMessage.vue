<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Bot, Check, Clock, Copy, User } from "@lucide/vue";

import { markdownToPreviewHtml } from "../../../utils/markdownPreview";
import { formatDurationMs, formatTokenCount } from "../../../utils/chatMessageMeta";
import { copyToClipboard } from "../../../utils/copyToClipboard";
import type { CcMessage } from "../../../stores/ccWorkbench";
import type { CcFileChangeItem, CcSubagentItem } from "../../../composables/cc/useCcStatusPanel";
import {
  blocksToRenderSegments,
  copyTextFromBlocks,
  messageHasVisibleBlocks,
  resolveMessageBlocks,
} from "../../../utils/ccMessageBlocks";
import CcToolBlocks from "./CcToolBlocks.vue";
import CcThinkingIndicator from "./CcThinkingIndicator.vue";

const props = defineProps<{
  message: CcMessage;
  isLast?: boolean;
  streaming?: boolean;
  isThinking?: boolean;
}>();

const emit = defineEmits<{
  selectFileChange: [item: CcFileChangeItem];
  selectSubagent: [item: CcSubagentItem];
}>();

const copied = ref(false);
const expandedThinking = ref<Record<string, boolean>>({});
const manuallyToggled = ref<Record<string, boolean>>({});
const lastAutoExpandedKey = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const isUser = computed(() => props.message.role === "user");
const isAssistant = computed(() => props.message.role === "assistant");

const blocks = computed(() => resolveMessageBlocks(props.message));
const renderSegments = computed(() => blocksToRenderSegments(blocks.value));

const isStreamingMessage = computed(
  () => Boolean(props.streaming && props.isLast && props.message.streaming),
);

const isEmptyStreaming = computed(
  () => isStreamingMessage.value && !messageHasVisibleBlocks(blocks.value),
);

const waitingLabel = computed(() =>
  props.isThinking ? "思考中…" : "等待回复…",
);

const showMeta = computed(
  () =>
    isAssistant.value &&
    !isStreamingMessage.value &&
    (typeof props.message.durationMs === "number" ||
      Boolean(props.message.modelLabel) ||
      (props.message.inputTokens ?? 0) > 0 ||
      (props.message.outputTokens ?? 0) > 0 ||
      (props.message.contextMaxTokens ?? 0) > 0),
);

const metaInputTokens = computed(() => Math.max(0, props.message.inputTokens ?? 0));
const metaOutputTokens = computed(() => Math.max(0, props.message.outputTokens ?? 0));
const metaTotalTokens = computed(() => metaInputTokens.value + metaOutputTokens.value);
const metaContextMax = computed(() => Math.max(0, props.message.contextMaxTokens ?? 0));
const metaContextUsed = computed(() => metaTotalTokens.value);
const showMetaTokens = computed(
  () => metaInputTokens.value > 0 || metaOutputTokens.value > 0,
);
const showMetaContext = computed(
  () => metaContextMax.value > 0 && metaContextUsed.value > 0,
);
const metaContextPct = computed(() => {
  if (!showMetaContext.value) return 0;
  return Math.min(99, Math.round((metaContextUsed.value / metaContextMax.value) * 100));
});
const showMetaDuration = computed(
  () => typeof props.message.durationMs === "number" && props.message.durationMs >= 0,
);

const copyText = computed(() =>
  isUser.value ? props.message.content : copyTextFromBlocks(blocks.value),
);

const canCopy = computed(() => copyText.value.trim().length > 0 && !isStreamingMessage.value);

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

async function handleCopy() {
  if (!canCopy.value || copied.value) return;
  const ok = await copyToClipboard(copyText.value);
  if (!ok) return;
  copied.value = true;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copied.value = false;
    copyTimer = null;
  }, 1500);
}
</script>

<template>
  <article
    class="cc-message"
    :class="{
      'cc-message--user': isUser,
      'cc-message--assistant': isAssistant,
      'cc-message--last': isLast,
      'cc-message--copyable': canCopy,
    }"
    :data-testid="`cc-chat-message-${message.role}`"
  >
    <div v-if="isUser" class="cc-message__user-row">
      <div class="cc-message__user-wrap">
        <div class="cc-message__user-header">
          <button
            v-if="canCopy"
            type="button"
            class="cc-message__copy"
            :class="{ 'cc-message__copy--copied': copied }"
            title="复制消息"
            aria-label="复制消息"
            @click="handleCopy"
          >
            <Check v-if="copied" class="h-3.5 w-3.5" />
            <Copy v-else class="h-3.5 w-3.5" />
          </button>
        </div>
        <div
          v-if="message.contextFiles?.length || message.attachments?.length || message.agentName"
          class="cc-message__chips"
        >
          <span
            v-for="file in message.contextFiles ?? []"
            :key="`ctx-${file}`"
            class="cc-message__chip"
          >
            @{{ file }}
          </span>
          <span
            v-for="item in message.attachments ?? []"
            :key="`att-${item.path}`"
            class="cc-message__chip cc-message__chip--attachment"
            :title="item.path"
          >
            📎 {{ item.name }}
          </span>
          <span v-if="message.agentName" class="cc-message__chip cc-message__chip--agent">
            <Bot class="h-3 w-3 shrink-0" />
            #{{ message.agentName }}
          </span>
        </div>
        <div class="cc-message__user-bubble">{{ message.content }}</div>
      </div>
      <span class="cc-message__avatar cc-message__avatar--user" aria-hidden="true" title="你">
        <User class="h-3.5 w-3.5" />
      </span>
    </div>

    <div v-else class="cc-message__assistant-row">
      <span class="cc-message__avatar cc-message__avatar--assistant" aria-hidden="true" title="助手">
        <Bot class="h-3.5 w-3.5" />
      </span>

      <div class="cc-message__assistant-body">
        <button
          v-if="canCopy"
          type="button"
          class="cc-message__copy cc-message__copy--assistant"
          :class="{ 'cc-message__copy--copied': copied }"
          title="复制消息"
          aria-label="复制消息"
          @click="handleCopy"
        >
          <Check v-if="copied" class="h-3.5 w-3.5" />
          <Copy v-else class="h-3.5 w-3.5" />
        </button>

        <CcThinkingIndicator v-if="isEmptyStreaming" :label="waitingLabel" hide-icon />

      <template v-for="segment in renderSegments" :key="segment.key">
        <div v-if="segment.type === 'thinking'" class="cc-message__thinking">
          <button
            type="button"
            class="cc-message__thinking-header"
            @click="toggleThinking(segment)"
          >
            <span>{{ thinkingTitle(segment) }}</span>
            <span class="cc-message__thinking-icon">
              {{ isThinkingExpanded(segment) ? "▼" : "▶" }}
            </span>
          </button>
          <div
            v-show="isThinkingExpanded(segment)"
            class="cc-message__thinking-body"
          >
            <p class="whitespace-pre-wrap">{{ segment.content }}</p>
          </div>
        </div>

        <div
          v-else-if="segment.type === 'text'"
          class="cc-message__prose"
          v-html="segmentHtml(segment.content)"
        />

        <CcToolBlocks
          v-else
          :tools="segment.items"
          :streaming="isStreamingMessage"
          @select-file-change="emit('selectFileChange', $event)"
          @select-subagent="emit('selectSubagent', $event)"
        />
      </template>

      <p
        v-if="!isEmptyStreaming && !renderSegments.length && !message.error && !isStreamingMessage"
        class="cc-message__empty"
      >
        （无回复内容）
      </p>

      <p v-if="message.error" class="cc-message__error" role="alert">{{ message.error }}</p>

      <span
        v-if="isStreamingMessage && message.content"
        class="cc-message__cursor"
        aria-hidden="true"
      />

        <div v-if="showMeta" class="cc-message__meta">
          <span class="cc-message__meta-inner">
            <span v-if="message.modelLabel" class="cc-message__meta-model" :title="message.modelLabel">
              {{ message.modelLabel }}
            </span>
            <template v-if="showMetaDuration">
              <span v-if="message.modelLabel" class="cc-message__meta-sep">·</span>
              <Clock class="cc-message__meta-icon" />
              <span>耗时</span>
              <span class="cc-message__meta-mono">{{ formatDurationMs(message.durationMs!) }}</span>
            </template>
            <template v-if="showMetaContext">
              <span class="cc-message__meta-sep">·</span>
              <span
                class="cc-message__meta-context"
                :title="`上下文 ${metaContextPct}% · ${formatTokenCount(metaContextUsed)} / ${formatTokenCount(metaContextMax)}`"
              >
                上下文
                <span class="cc-message__meta-mono">{{ metaContextPct }}%</span>
                <span class="cc-message__meta-sub">
                  ({{ formatTokenCount(metaContextUsed) }}/{{ formatTokenCount(metaContextMax) }})
                </span>
              </span>
            </template>
            <template v-if="showMetaTokens">
              <span class="cc-message__meta-sep">·</span>
              <span
                class="cc-message__meta-usage"
                :title="`输入 ${formatTokenCount(metaInputTokens)} · 输出 ${formatTokenCount(metaOutputTokens)} · 合计 ${formatTokenCount(metaTotalTokens)}`"
              >
                消耗
                <span class="cc-message__meta-mono">入 {{ formatTokenCount(metaInputTokens) }}</span>
                <span class="cc-message__meta-sub">出 {{ formatTokenCount(metaOutputTokens) }}</span>
              </span>
            </template>
          </span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.cc-message {
  position: relative;
  padding: 1rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
}

.cc-message--last {
  border-bottom: none;
}

.cc-message--user {
  display: block;
}

.cc-message__user-row {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 0.5rem;
}

.cc-message__assistant-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.cc-message__assistant-body {
  position: relative;
  min-width: 0;
  flex: 1;
}

.cc-message__avatar {
  display: flex;
  height: 1.75rem;
  width: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
}

.cc-message__avatar--user {
  margin-top: 0.125rem;
  background: color-mix(in srgb, var(--color-link) 14%, transparent);
  color: var(--color-link);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 22%, transparent);
}

.cc-message__avatar--assistant {
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 20%, transparent);
}

.cc-message__user-wrap {
  display: flex;
  max-width: 85%;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.375rem;
}

.cc-message__user-header {
  display: flex;
  justify-content: flex-end;
  min-height: 1.25rem;
}

.cc-message__chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.25rem;
}

.cc-message__chip {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  padding: 0.125rem 0.4375rem;
  font-size: 0.625rem;
  color: var(--color-link);
}

.cc-message__chip--agent {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: color-mix(in srgb, #8b5cf6 12%, transparent);
  color: #7c3aed;
}

.cc-message__user-bubble {
  border-radius: 0.75rem 0.75rem 0.125rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--color-link) 18%, transparent);
  background: var(--color-link);
  padding: 0.625rem 0.875rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  color: white;
  white-space: pre-wrap;
  word-break: break-word;
}

.cc-message--assistant {
  padding-left: 0;
}

.cc-message__thinking {
  margin-bottom: 1rem;
}

.cc-message__thinking-header {
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

.cc-message__thinking-header:hover {
  opacity: 0.8;
}

.cc-message__thinking-icon {
  font-size: 0.625rem;
  opacity: 0.8;
}

.cc-message__thinking-body {
  margin-top: 0.5rem;
  max-width: 100%;
  border-left: 2px solid color-mix(in srgb, var(--color-muted) 35%, transparent);
  padding-left: 0.75rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-muted);
  word-break: break-word;
}

.cc-message__thinking-body p {
  margin: 0;
  white-space: pre-wrap;
}

.cc-message__prose {
  margin-bottom: 0.625rem;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--color-text);
  word-break: break-word;
}

.cc-message__prose :deep(p) {
  margin: 0.5em 0;
}

.cc-message__prose :deep(p:first-child) {
  margin-top: 0;
}

.cc-message__prose :deep(p:last-child) {
  margin-bottom: 0;
}

.cc-message__prose :deep(h1),
.cc-message__prose :deep(h2),
.cc-message__prose :deep(h3),
.cc-message__prose :deep(h4) {
  margin: 0.85em 0 0.4em;
  font-weight: 600;
  line-height: 1.35;
}

.cc-message__prose :deep(ul),
.cc-message__prose :deep(ol) {
  margin: 0.55em 0;
  padding-left: 1.25rem;
}

.cc-message__prose :deep(li) {
  margin: 0.3em 0;
}

.cc-message__prose :deep(strong) {
  font-weight: 600;
}

.cc-message__prose :deep(.preview-inline-code) {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.1rem 0.35rem;
  font-family: var(--font-mono);
  font-size: 0.88em;
}

.cc-message__prose :deep(pre.preview-code-block) {
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

.cc-message__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-surface-0);
  padding: 0.25rem;
  color: var(--color-muted);
  opacity: 0;
  transition:
    opacity 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.cc-message--user:hover .cc-message__copy,
.cc-message--copyable .cc-message__assistant-body:hover .cc-message__copy--assistant,
.cc-message__copy:focus-visible {
  opacity: 1;
}

.cc-message__copy:hover {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
}

.cc-message__copy--assistant {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
}

.cc-message__copy--copied {
  opacity: 1;
  color: var(--color-link);
  border-color: color-mix(in srgb, var(--color-link) 35%, var(--color-border));
}

.cc-message__empty {
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-message__error {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-danger);
}

.cc-message__cursor {
  display: inline-block;
  height: 0.875rem;
  width: 0.125rem;
  margin-left: 0.125rem;
  border-radius: 0.0625rem;
  background: var(--color-link);
  vertical-align: middle;
  animation: cc-message-cursor 1s step-end infinite;
}

@keyframes cc-message-cursor {
  50% {
    opacity: 0;
  }
}

.cc-message__meta {
  margin-top: 0.625rem;
  display: flex;
  justify-content: center;
}

.cc-message__meta-inner {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  border-radius: 0.375rem;
  padding: 0.3125rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-message__meta-model {
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: color-mix(in srgb, var(--color-link) 85%, var(--color-muted));
}

.cc-message__meta-icon {
  height: 0.75rem;
  width: 0.75rem;
  opacity: 0.7;
}

.cc-message__meta-mono {
  font-family: var(--font-mono);
}

.cc-message__meta-sub {
  margin-left: 0.125rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  opacity: 0.85;
}

.cc-message__meta-context,
.cc-message__meta-usage {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
}

.cc-message__meta-sep {
  opacity: 0.5;
}
</style>
