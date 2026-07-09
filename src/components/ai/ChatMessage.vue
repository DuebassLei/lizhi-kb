<script setup lang="ts">
import { computed } from "vue";
import { Sparkles } from "@lucide/vue";

import { markdownToPreviewHtml } from "../../utils/markdownPreview";
import type { UiChatMessage } from "../../stores/chat";
import CitationChip from "./CitationChip.vue";

const props = defineProps<{
  message: UiChatMessage;
}>();

const emit = defineEmits<{
  openCitation: [id: string];
}>();

const html = computed(() => {
  if (props.message.role !== "assistant" || !props.message.content) return "";
  return markdownToPreviewHtml(props.message.content);
});

const isUser = computed(() => props.message.role === "user");
const isThinking = computed(
  () => props.message.streaming && !props.message.error && !props.message.content,
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
        <div v-if="isUser" class="whitespace-pre-wrap break-words">{{ message.content }}</div>

        <div
          v-else-if="html"
          class="chat-prose"
          v-html="html"
        />

        <div
          v-else-if="isThinking"
          class="flex items-center gap-2 text-muted"
          aria-live="polite"
        >
          <span class="flex gap-1" aria-hidden="true">
            <span class="chat-thinking-dot" />
            <span class="chat-thinking-dot animation-delay-150" />
            <span class="chat-thinking-dot animation-delay-300" />
          </span>
          <span class="text-xs">思考中…</span>
        </div>

        <p v-else-if="!message.error && !message.toolCalls?.length" class="text-xs text-muted">
          （无回复内容）
        </p>

        <div
          v-if="message.toolCalls?.length"
          class="mt-2.5 space-y-1.5 border-t border-divider pt-2.5 text-xs text-muted"
        >
          <div v-for="(tool, i) in message.toolCalls" :key="i">
            <span class="font-mono text-link">{{ tool.name }}</span>
            <pre
              v-if="tool.output"
              class="mt-1 max-h-24 overflow-auto rounded-md bg-surface-0 px-2 py-1 whitespace-pre-wrap"
            >{{ tool.output }}</pre>
          </div>
        </div>

        <CitationChip
          v-if="message.citations?.length"
          :citations="message.citations"
          @open="emit('openCitation', $event)"
        />

        <p v-if="message.error" class="mt-2 text-xs text-danger" role="alert">{{ message.error }}</p>

        <span
          v-if="message.streaming && message.content"
          class="ml-0.5 inline-block h-3.5 w-1 animate-pulse rounded-sm bg-link align-middle"
          aria-hidden="true"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
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
</style>
