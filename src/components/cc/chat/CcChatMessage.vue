<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { AlertTriangle, Bot, Check, Copy, FileCode, User } from "@lucide/vue";

import { handlePreviewCodeCopyClick } from "../../../composables/cc/usePreviewCodeCopy";
import { useUiStore } from "../../../stores/ui";
import { markdownToPreviewHtml } from "../../../utils/markdownPreview";
import { formatDurationMs, formatTokenCount } from "../../../utils/chatMessageMeta";
import { copyToClipboard } from "../../../utils/copyToClipboard";
import type { CcMessage } from "../../../stores/ccWorkbench";
import type { CcFileChangeItem, CcSubagentItem } from "../../../composables/cc/useCcStatusPanel";
import type { CwdMode } from "../../../services/ccWorkbenchService";
import {
  blocksToRenderSegments,
  copyTextFromBlocks,
  messageHasVisibleBlocks,
  resolveMessageBlocks,
} from "../../../utils/ccMessageBlocks";
import {
  resolveClarifyForm,
  stripClarifyContent,
  type LizhiClarifyForm,
} from "../../../utils/ccClarifyForm";
import { checkVaultKnowledgeReply, messageHasPendingLizhiTools } from "../../../utils/ccVaultQueryGuard";
import {
  messageHasFailedTools,
  type CcToolCallItem,
} from "../../../utils/ccToolGrouping";
import CcClarifyForm from "./CcClarifyForm.vue";
import CcToolBlocks from "./CcToolBlocks.vue";
import CcThinkingIndicator from "./CcThinkingIndicator.vue";

const props = defineProps<{
  message: CcMessage;
  isLast?: boolean;
  streaming?: boolean;
  isThinking?: boolean;
  /** 当前选中的 Agent ID，用于澄清表单 fallback */
  clarifyAgentId?: string | null;
  cwdMode?: CwdMode;
  priorUserText?: string | null;
  /** 前一条消息的创建时间（用于日期分隔） */
  prevCreatedAt?: number;
}>();

const emit = defineEmits<{
  selectFileChange: [item: CcFileChangeItem];
  selectSubagent: [item: CcSubagentItem];
  clarifyFill: [text: string];
  clarifySubmit: [text: string];
}>();

const copied = ref(false);
const mdCopied = ref(false);
const ui = useUiStore();
const expandedThinking = ref<Record<string, boolean>>({});
const manuallyToggled = ref<Record<string, boolean>>({});
const lastAutoExpandedKey = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const isUser = computed(() => props.message.role === "user");
const isAssistant = computed(() => props.message.role === "assistant");

/** 日期分隔：当前消息与上一条的日期不同时显示 */
const showDateSep = computed(() => {
  const cur = props.message.createdAt;
  const prev = props.prevCreatedAt;
  if (!cur) return false;
  if (!prev) return true;
  const curDate = new Date(cur).toDateString();
  const prevDate = new Date(prev).toDateString();
  return curDate !== prevDate;
});

const dateSepLabel = computed(() => {
  const ts = props.message.createdAt;
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
});

const messageTime = computed(() => {
  const ts = props.message.createdAt;
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
});

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

type MetaLineItem = {
  key: string;
  text: string;
  mono?: boolean;
  model?: boolean;
};

const metaLineItems = computed((): MetaLineItem[] => {
  const items: MetaLineItem[] = [];
  if (props.message.modelLabel) {
    items.push({ key: "model", text: props.message.modelLabel, model: true });
  }
  if (showMetaDuration.value) {
    items.push({
      key: "duration",
      text: `耗时 ${formatDurationMs(props.message.durationMs!)}`,
      mono: true,
    });
  }
  if (showMetaContext.value) {
    items.push({
      key: "context",
      text: `上下文 ${metaContextPct.value}% (${formatTokenCount(metaContextUsed.value)}/${formatTokenCount(metaContextMax.value)})`,
      mono: true,
    });
  }
  if (showMetaTokens.value) {
    items.push({
      key: "usage",
      text: `消耗 入 ${formatTokenCount(metaInputTokens.value)} 出 ${formatTokenCount(metaOutputTokens.value)}`,
      mono: true,
    });
  }
  return items;
});

const copyText = computed(() =>
  isUser.value ? props.message.content : copyTextFromBlocks(blocks.value),
);

const canCopy = computed(() => copyText.value.trim().length > 0 && !isStreamingMessage.value);

const fullAssistantText = computed(() => {
  const fromBlocks = blocks.value
    .filter((b) => b.type === "text")
    .map((b) => b.content)
    .join("\n\n");
  return fromBlocks || props.message.content;
});

const clarifyForm = computed((): LizhiClarifyForm | null => {
  if (isUser.value || isStreamingMessage.value || !props.isLast) return null;
  return resolveClarifyForm(fullAssistantText.value, props.clarifyAgentId);
});

const allTools = computed((): CcToolCallItem[] => {
  const fromBlocks = blocks.value
    .filter((b) => b.type === "tool")
    .map((b) => ({
      name: b.name,
      input: b.input,
      output: b.output,
      id: b.id,
      startedAt: b.startedAt,
      completedAt: b.completedAt,
    }));
  return fromBlocks.length ? fromBlocks : (props.message.toolCalls ?? []);
});

const toolFailureWarning = computed(() => {
  if (isUser.value || isStreamingMessage.value || !allTools.value.length) return null;
  const hasPendingLizhi = messageHasPendingLizhiTools(allTools.value, blocks.value);
  if (hasPendingLizhi) {
    return "lizhi-mcp 工具仍在执行，请稍候；若长时间无结果，请重试或更换模型。";
  }
  if (!messageHasFailedTools(allTools.value)) return null;
  if (!fullAssistantText.value.trim() && !allTools.value.some((t) => t.output !== undefined)) {
    return null;
  }
  return "部分工具调用失败或无返回，下方正文可能包含未经验证的内容，请勿直接当作知识库查询结果。";
});

const vaultCitationWarning = computed(() => {
  if (isUser.value || isStreamingMessage.value) return null;
  if (
    props.message.error &&
    (props.message.error.includes("未调用 lizhi-mcp") ||
      props.message.error.includes("伪工具标签"))
  ) {
    return null;
  }
  const result = checkVaultKnowledgeReply({
    cwdMode: props.cwdMode ?? "vault",
    userText: props.priorUserText ?? "",
    assistantText: fullAssistantText.value,
    toolCalls: allTools.value,
    blocks: blocks.value,
    streaming: false,
    turnComplete: !props.message.streaming,
  });
  return result.violation ? result.message ?? null : null;
});

function segmentHtml(content: string): string {
  return markdownToPreviewHtml(stripClarifyContent(content));
}

function isThinkingExpanded(segment: { key: string; isLastThinking: boolean }): boolean {
  if (expandedThinking.value[segment.key] !== undefined) {
    return expandedThinking.value[segment.key];
  }
  return false;
}

function thinkingTitle(segment: { isLastThinking: boolean }): string {
  return isStreamingMessage.value && segment.isLastThinking && props.isThinking
    ? "推理过程（进行中）"
    : "推理过程";
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

const copyMarkdown = computed(() => {
  if (isUser.value) return null;
  if (isStreamingMessage.value) return null;
  try {
    return buildMdFromBlocks();
  } catch {
    return null;
  }
});

function buildMdFromBlocks(): string {
  const role = isAssistant.value ? "助手" : "用户";
  const lines: string[] = [`### ${role}`, ""];
  if (props.message.contextFiles?.length) {
    lines.push(`上下文：${props.message.contextFiles.map((f) => `@${f}`).join(" ")}`, "");
  }
  if (props.message.agentName) {
    lines.push(`智能体：#${props.message.agentName}`, "");
  }
  const blks = blocks.value;
  if (!blks.length) {
    lines.push(props.message.content.trim() || "（空）", "");
  } else {
    for (const block of blks) {
      if (block.type === "thinking") {
        lines.push("<details>", "<summary>思考</summary>", "", block.content.trim(), "", "</details>", "");
      } else if (block.type === "text") {
        lines.push(block.content.trim(), "");
      } else {
        lines.push(`- **${block.name}**`);
        if (block.input) lines.push("  ```json", `  ${block.input}`, "  ```");
        if (block.output) {
          lines.push("  输出：", "  ```", `  ${block.output.slice(0, 2000)}`, "  ```");
        }
        lines.push("");
      }
    }
  }
  if (props.message.error) {
    lines.push(`> 错误：${props.message.error}`, "");
  }
  return lines.join("\n").trimEnd();
}

const canCopyMarkdown = computed(() => Boolean(copyMarkdown.value?.trim()));

async function handleCopyMarkdown() {
  if (!canCopyMarkdown.value || mdCopied.value) return;
  const ok = await copyToClipboard(copyMarkdown.value!);
  if (!ok) return;
  mdCopied.value = true;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    mdCopied.value = false;
    copyTimer = null;
  }, 1500);
}

function onProseClick(event: MouseEvent) {
  void handlePreviewCodeCopyClick(event, ui.showToast.bind(ui));
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
      'cc-message--streaming': isStreamingMessage,
    }"
    :data-testid="`cc-chat-message-${message.role}`"
  >
    <!-- 日期分隔 -->
    <div v-if="showDateSep" class="cc-message__date-sep" aria-hidden="true">
      <span class="cc-message__date-line" />
      <span class="cc-message__date-label">{{ dateSepLabel }}</span>
      <span class="cc-message__date-line" />
    </div>

    <!-- 用户消息 -->
    <div v-if="isUser" class="cc-message__user-row">
      <div class="cc-message__user-wrap">
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
            {{ item.name }}
          </span>
          <span v-if="message.agentName" class="cc-message__chip cc-message__chip--agent">
            <Bot class="h-3 w-3 shrink-0" />
            #{{ message.agentName }}
          </span>
        </div>
        <div class="cc-message__user-bubble">
          <span class="cc-message__user-text">{{ message.content }}</span>
          <span v-if="messageTime" class="cc-message__user-time">{{ messageTime }}</span>
        </div>
      </div>
      <span class="cc-message__avatar cc-message__avatar--user" aria-hidden="true" title="你">
        <User class="h-4 w-4" />
      </span>
    </div>

    <!-- 助手消息 -->
    <div v-else class="cc-message__assistant-row">
      <span class="cc-message__avatar cc-message__avatar--assistant" aria-hidden="true" title="助手">
        <Bot class="h-4 w-4" />
      </span>

      <div class="cc-message__assistant-body">
        <!-- 助手卡片容器 -->
        <div class="cc-message__card">
          <!-- 卡片工具栏 -->
          <div class="cc-message__card-bar">
            <div class="cc-message__card-bar-left" />
            <div class="cc-message__card-bar-actions">
              <button
                v-if="canCopy"
                type="button"
                class="cc-message__copy"
                :class="{ 'cc-message__copy--copied': copied }"
                title="复制纯文本"
                aria-label="复制纯文本"
                @click="handleCopy"
              >
                <Check v-if="copied" class="h-3.5 w-3.5" />
                <Copy v-else class="h-3.5 w-3.5" />
              </button>
              <button
                v-if="canCopyMarkdown"
                type="button"
                class="cc-message__copy"
                :class="{ 'cc-message__copy--copied': mdCopied }"
                title="复制为 Markdown"
                aria-label="复制为 Markdown"
                @click="handleCopyMarkdown"
              >
                <Check v-if="mdCopied" class="h-3.5 w-3.5" />
                <FileCode v-else class="h-3.5 w-3.5" />
              </button>
              <span class="cc-message__copy-divider" v-if="canCopy && canCopyMarkdown" aria-hidden="true" />
              <span v-if="messageTime" class="cc-message__time">{{ messageTime }}</span>
            </div>
          </div>

          <CcThinkingIndicator v-if="isEmptyStreaming" :label="waitingLabel" hide-icon />

          <!-- 警告提示 -->
          <div
            v-if="vaultCitationWarning"
            class="cc-message__warn"
            role="alert"
            data-testid="cc-vault-citation-warning"
          >
            <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
            <span>{{ vaultCitationWarning }}</span>
          </div>

          <div
            v-if="toolFailureWarning && !vaultCitationWarning"
            class="cc-message__warn cc-message__warn--tool"
            role="alert"
          >
            <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
            <span>{{ toolFailureWarning }}</span>
          </div>

          <!-- 消息内容段 -->
          <div class="cc-message__content">
            <template v-for="(segment, segIdx) in renderSegments" :key="segment.key">
              <!-- 思考过程 -->
              <div v-if="segment.type === 'thinking'" class="cc-message__thinking">
                <button
                  type="button"
                  class="cc-message__thinking-header"
                  @click="toggleThinking(segment)"
                >
                  <span class="cc-message__thinking-dot" aria-hidden="true" />
                  <span>{{ thinkingTitle(segment) }}</span>
                  <span class="cc-message__thinking-chevron" aria-hidden="true">
                    {{ isThinkingExpanded(segment) ? "▾" : "▸" }}
                  </span>
                </button>
                <div
                  v-show="isThinkingExpanded(segment)"
                  class="cc-message__thinking-body"
                >
                  <p class="whitespace-pre-wrap">{{ segment.content }}</p>
                </div>
              </div>

              <!-- 文本 (Markdown) -->
              <div
                v-else-if="segment.type === 'text'"
                class="cc-message__prose"
                :class="{ 'cc-message__prose--last': segIdx === renderSegments.length - 1 }"
                v-html="segmentHtml(segment.content)"
                @click="onProseClick"
              />

              <!-- 工具块 -->
              <CcToolBlocks
                v-else
                :tools="segment.items"
                :streaming="isStreamingMessage"
                @select-file-change="emit('selectFileChange', $event)"
                @select-subagent="emit('selectSubagent', $event)"
              />
            </template>
          </div>

          <!-- 空回复 -->
          <p
            v-if="!isEmptyStreaming && !renderSegments.length && !message.error && !isStreamingMessage"
            class="cc-message__empty"
          >
            暂无回复内容
          </p>

          <!-- 错误信息 -->
          <div v-if="message.error" class="cc-message__error" role="alert">
            <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
            <span>{{ message.error }}</span>
          </div>

          <!-- 澄清表单 -->
          <CcClarifyForm
            v-if="clarifyForm"
            :form="clarifyForm"
            :disabled="streaming"
            @fill="emit('clarifyFill', $event)"
            @submit="emit('clarifySubmit', $event)"
          />

          <!-- 流式光标 -->
          <span
            v-if="isStreamingMessage && message.content"
            class="cc-message__cursor"
            aria-hidden="true"
          />

          <!-- Meta 信息行 -->
          <div v-if="showMeta" class="cc-message__meta">
            <div class="cc-message__meta-row">
              <template v-for="item in metaLineItems" :key="item.key">
                <span
                  :class="{
                    'cc-message__meta-model': item.model,
                    'cc-message__meta-mono': item.mono && !item.model,
                  }"
                >
                  {{ item.text }}
                </span>
                <span class="cc-message__meta-sep">·</span>
              </template>
              <!-- token 进度条 -->
              <div v-if="showMetaContext" class="cc-message__meta-bar" :title="`上下文 ${metaContextPct}%`">
                <div
                  class="cc-message__meta-bar-fill"
                  :style="{ width: `${metaContextPct}%` }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* ============================================
   CC Chat Message — "Refined Study Room"
   暗色学术风 · 卡片式消息 · 精密排印
   ============================================ */

/* ── Root ── */
.cc-message {
  position: relative;
  padding: 0.375rem 0;
  animation: cc-msg-enter 0.28s ease-out both;
}

.cc-message--last {
  padding-bottom: 0.75rem;
}

.cc-message--streaming {
  animation: none;
}

@keyframes cc-msg-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── 日期分隔 ── */
.cc-message__date-sep {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0 0.625rem;
}

.cc-message__date-line {
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--color-border) 55%, transparent);
}

.cc-message__date-label {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 500;
  color: color-mix(in srgb, var(--color-muted) 72%, transparent);
  letter-spacing: 0.02em;
}

/* ── 头像 ── */
.cc-message__avatar {
  display: flex;
  height: 1.875rem;
  width: 1.875rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.5625rem;
  margin-top: 0.125rem;
}

.cc-message__avatar--user {
  background: color-mix(in srgb, var(--color-link) 14%, transparent);
  color: var(--color-link);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 22%, transparent);
}

.cc-message__avatar--assistant {
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  color: var(--color-link);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 16%, transparent);
}

/* ── 用户消息行 ── */
.cc-message__user-row {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 0.5rem;
}

.cc-message__user-wrap {
  display: flex;
  max-width: 78%;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.3125rem;
}

.cc-message__user-bubble {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 1rem 1rem 0.25rem 1rem;
  background: color-mix(in srgb, var(--color-link) 62%, var(--color-surface-3));
  padding: 0.5625rem 0.8125rem;
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--color-base) 25%, transparent),
    inset 0 1px 0 color-mix(in srgb, white 8%, transparent);
}

.cc-message__user-text {
  font-size: 0.8125rem;
  line-height: 1.6;
  color: white;
  white-space: pre-wrap;
  word-break: break-word;
}

.cc-message__user-time {
  margin-top: 0.25rem;
  font-size: 0.625rem;
  line-height: 1;
  color: color-mix(in srgb, white 55%, transparent);
  text-align: right;
}

/* ── Chips ── */
.cc-message__chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.21875rem;
}

.cc-message__chip {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  padding: 0.1rem 0.5rem;
  font-size: 0.625rem;
  line-height: 1.4;
  color: var(--color-link);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 14%, transparent);
}

.cc-message__chip--attachment {
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-message__chip--agent {
  display: inline-flex;
  align-items: center;
  gap: 0.21875rem;
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  color: var(--color-link);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 18%, transparent);
}

/* ── 助手消息行 ── */
.cc-message__assistant-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5625rem;
}

.cc-message__assistant-body {
  position: relative;
  min-width: 0;
  flex: 1;
  max-width: calc(100% - 2.4375rem);
}

/* ── 助手卡片 ── */
.cc-message__card {
  position: relative;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--color-border) 65%, transparent);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-surface-1) 55%, var(--color-surface-0)),
      color-mix(in srgb, var(--color-surface-0) 85%, var(--color-surface-1))
    );
  padding: 0.75rem 1rem 0.625rem;
  box-shadow: 0 1px 3px color-mix(in srgb, var(--color-base) 20%, transparent);
}

/* ── 卡片工具栏 ── */
.cc-message__card-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  min-height: 1.25rem;
}

.cc-message__card-bar-left {
  flex: 1;
}

.cc-message__card-bar-actions {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.cc-message__copy-divider {
  width: 1px;
  height: 0.875rem;
  background: color-mix(in srgb, var(--color-border) 50%, transparent);
  margin: 0 0.25rem;
}

.cc-message__time {
  font-size: 0.625rem;
  color: var(--color-muted);
  opacity: 0.6;
  font-family: var(--font-mono);
}

.cc-message__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.5rem;
  width: 1.5rem;
  border: 1px solid transparent;
  border-radius: 0.3125rem;
  background: transparent;
  padding: 0;
  color: var(--color-muted);
  opacity: 0.5;
  cursor: pointer;
  transition:
    opacity 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.cc-message__card:hover .cc-message__copy,
.cc-message__copy:focus-visible {
  opacity: 1;
  border-color: color-mix(in srgb, var(--color-border) 80%, transparent);
}

.cc-message__card:hover .cc-message__copy-divider,
.cc-message__copy-divider:has(+ .cc-message__copy:focus-visible) {
  opacity: 1;
}

.cc-message__copy-divider {
  opacity: 0;
  transition: opacity 0.18s ease;
}

.cc-message__copy:hover {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface-1) 60%, transparent);
  border-color: var(--color-border);
}

.cc-message__copy--copied {
  opacity: 1;
  color: var(--color-secure);
  border-color: color-mix(in srgb, var(--color-secure) 22%, var(--color-border));
}

/* ── 内容区 ── */
.cc-message__content {
  min-height: 0;
}

/* ── 思考块 ── */
.cc-message__thinking {
  margin-bottom: 0.625rem;
}

.cc-message__thinking-header {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border: none;
  background: transparent;
  padding: 0.125rem 0;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-muted);
  cursor: pointer;
  user-select: none;
  transition: color 0.18s ease;
}

.cc-message__thinking-header:hover {
  color: color-mix(in srgb, var(--color-muted) 78%, var(--color-text));
}

.cc-message__thinking-dot {
  display: inline-block;
  height: 0.3125rem;
  width: 0.3125rem;
  border-radius: 50%;
  background: var(--color-muted);
  opacity: 0.5;
  flex-shrink: 0;
}

.cc-message__thinking-chevron {
  font-size: 0.625rem;
  opacity: 0.6;
}

.cc-message__thinking-body {
  margin-top: 0.4375rem;
  max-width: 100%;
  border-left: 1.5px solid color-mix(in srgb, var(--color-muted) 22%, transparent);
  padding-left: 0.6875rem;
  font-size: 0.75rem;
  line-height: 1.55;
  color: var(--color-muted);
  word-break: break-word;
}

.cc-message__thinking-body p {
  margin: 0;
  white-space: pre-wrap;
}

/* ── Prose 文本 ── */
.cc-message__prose {
  font-size: 0.8125rem;
  line-height: 1.7;
  color: var(--color-text);
  word-break: break-word;
  overflow-wrap: break-word;
}

.cc-message__prose--last {
  padding-bottom: 0;
}

.cc-message__prose :deep(p) {
  margin: 0.6em 0;
}

.cc-message__prose :deep(p:first-child) {
  margin-top: 0;
}

.cc-message__prose :deep(p:last-child) {
  margin-bottom: 0;
}

.cc-message__prose :deep(h1) {
  margin: 1.2em 0 0.5em;
  font-size: 1.12em;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.cc-message__prose :deep(h2) {
  margin: 1.2em 0 0.5em;
  font-size: 1.04em;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text);
}

.cc-message__prose :deep(h3),
.cc-message__prose :deep(h4) {
  margin: 0.95em 0 0.4em;
  font-size: 0.93em;
  font-weight: 600;
  line-height: 1.4;
  color: color-mix(in srgb, var(--color-text) 92%, var(--color-muted));
}

.cc-message__prose :deep(ul),
.cc-message__prose :deep(ol) {
  margin: 0.6em 0;
  padding-left: 1.4rem;
}

.cc-message__prose :deep(ul) {
  list-style-type: disc;
}

.cc-message__prose :deep(ol) {
  list-style-type: decimal;
}

.cc-message__prose :deep(li) {
  margin: 0.3em 0;
  padding-left: 0.125rem;
}

.cc-message__prose :deep(li::marker) {
  color: color-mix(in srgb, var(--color-muted) 65%, var(--color-text));
}

.cc-message__prose :deep(blockquote.preview-blockquote) {
  margin: 0.75em 0;
  border-left: 2px solid color-mix(in srgb, var(--color-muted) 35%, transparent);
  padding: 0.25rem 0 0.25rem 0.75rem;
  color: var(--color-muted);
}

.cc-message__prose :deep(hr.preview-hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
}

.cc-message__prose :deep(strong) {
  font-weight: 600;
  color: var(--color-text);
}

.cc-message__prose :deep(a) {
  color: var(--color-link);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-link) 30%, transparent);
  text-underline-offset: 0.14em;
  transition: text-decoration-color 0.15s ease;
}

.cc-message__prose :deep(a:hover) {
  text-decoration-color: var(--color-link);
}

.cc-message__prose :deep(.preview-inline-code) {
  display: inline-block;
  border-radius: 0.25rem;
  background: color-mix(in srgb, var(--color-muted) 10%, var(--color-surface-1));
  padding: 0.1rem 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.84em;
  line-height: 1.4;
  color: color-mix(in srgb, var(--color-text) 88%, var(--color-muted));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-border) 48%, transparent);
}

.cc-message__prose :deep(.preview-file-ref) {
  border: none;
  background: transparent;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 0.88em;
  line-height: inherit;
  color: var(--color-link);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-link) 30%, transparent);
  text-underline-offset: 0.12em;
  transition: text-decoration-color 0.15s ease;
}

.cc-message__prose :deep(.preview-file-ref:hover) {
  color: color-mix(in srgb, var(--color-link) 82%, var(--color-text));
  text-decoration-color: var(--color-link);
}

.cc-message__prose :deep(.preview-code-wrap) {
  margin: 0.65em 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  overflow: hidden;
}

.cc-message__prose :deep(.preview-code-toolbar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0.5625rem;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 75%, transparent);
}

.cc-message__prose :deep(.preview-code-lang) {
  font-size: 0.625rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
  text-transform: lowercase;
}

.cc-message__prose :deep(.preview-code-copy) {
  border: none;
  background: transparent;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  color: var(--color-muted);
  cursor: pointer;
  border-radius: 0.25rem;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.cc-message__prose :deep(.preview-code-copy:hover) {
  color: var(--color-link);
  background: color-mix(in srgb, var(--color-surface-1) 70%, transparent);
}

.cc-message__prose :deep(pre.preview-code-block) {
  margin: 0;
  overflow-x: auto;
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 0.65rem 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.8em;
  line-height: 1.55;
}

/* ── 表格 ── */
.cc-message__prose :deep(table) {
  margin: 0.65em 0;
  border-collapse: collapse;
  width: 100%;
  font-size: 0.92em;
}

.cc-message__prose :deep(th),
.cc-message__prose :deep(td) {
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  padding: 0.35rem 0.5625rem;
  text-align: left;
}

.cc-message__prose :deep(th) {
  background: color-mix(in srgb, var(--color-surface-1) 60%, transparent);
  font-weight: 600;
}

/* ── 空态 / 错误 ── */
.cc-message__empty {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-muted);
  font-style: italic;
  opacity: 0.7;
}

.cc-message__error {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  margin-top: 0.4375rem;
  padding: 0.4375rem 0.5625rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-danger) 8%, transparent);
  border-left: 2px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
  font-size: 0.75rem;
  line-height: 1.5;
  color: color-mix(in srgb, var(--color-danger) 88%, var(--color-text));
}

/* ── 警告提示 ── */
.cc-message__warn {
  display: flex;
  align-items: flex-start;
  gap: 0.4375rem;
  margin-bottom: 0.625rem;
  border-radius: var(--radius-md);
  border-left: 2px solid color-mix(in srgb, var(--color-warning) 50%, transparent);
  background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface-0));
  padding: 0.4375rem 0.5625rem;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: color-mix(in srgb, var(--color-warning) 92%, var(--color-text));
}

.cc-message__warn--tool {
  border-left-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
  background: color-mix(in srgb, var(--color-danger) 6%, var(--color-surface-0));
  color: color-mix(in srgb, var(--color-danger) 85%, var(--color-text));
}

/* ── 流式光标 ── */
.cc-message__cursor {
  display: inline-block;
  height: 1em;
  width: 1.5px;
  margin-left: 1px;
  border-radius: 1px;
  background: var(--color-link);
  vertical-align: text-bottom;
  animation: cc-cursor-blink 1s ease-in-out infinite;
}

@keyframes cc-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.15; }
}

/* ── Meta 信息 ── */
.cc-message__meta {
  margin-top: 0.625rem;
  padding-top: 0.5rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
}

.cc-message__meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.125rem 0.25rem;
  font-size: 0.65625rem;
  line-height: 1.4;
  color: var(--color-muted);
}

.cc-message__meta-model {
  font-family: var(--font-mono);
  font-size: 0.65625rem;
  color: color-mix(in srgb, var(--color-link) 72%, var(--color-muted));
}

.cc-message__meta-mono {
  font-family: var(--font-mono);
  font-size: 0.65625rem;
}

.cc-message__meta-sep {
  opacity: 0.35;
}

/* token 上下文进度条 */
.cc-message__meta-bar {
  flex: 1 1 3rem;
  max-width: 5rem;
  min-width: 2rem;
  height: 2px;
  border-radius: 1px;
  background: color-mix(in srgb, var(--color-muted) 14%, transparent);
  overflow: hidden;
}

.cc-message__meta-bar-fill {
  height: 100%;
  border-radius: 1px;
  background: color-mix(in srgb, var(--color-muted) 55%, var(--color-surface-2));
  transition: width 0.4s ease;
}
</style>
