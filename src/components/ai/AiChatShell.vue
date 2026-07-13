<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ExternalLink, History, MessageSquarePlus, Send, Settings2, Square, Sparkles, X } from "@lucide/vue";

import { useChatStore } from "../../stores/chat";
import { isRetrievalTarget } from "../../services/aiService";
import { useDocumentsStore } from "../../stores/documents";
import { useUiStore } from "../../stores/ui";
import type { AiChatMode } from "../../services/aiService";
import ChatMessage from "./ChatMessage.vue";
import LlmModelSelect from "./LlmModelSelect.vue";
import RagPromptChips from "./RagPromptChips.vue";
import RagScopeBar from "./RagScopeBar.vue";
import ChatSessionPanel from "./ChatSessionPanel.vue";
import AiSettingsDrawer from "./AiSettingsDrawer.vue";
import type { AiSettingsTabInput } from "../../composables/useAiSettings";

const props = withDefaults(
  defineProps<{
    variant?: "panel" | "page";
  }>(),
  { variant: "panel" },
);

const chat = useChatStore();
const documents = useDocumentsStore();
const ui = useUiStore();
const router = useRouter();

const listEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);
const historyOpen = ref(false);
const configOpen = ref(false);
const configInitialTab = ref<AiSettingsTabInput | undefined>(undefined);

const isPage = computed(() => props.variant === "page");
const ragSurface = computed((): "workspace" | "standalone" => (isPage.value ? "standalone" : "workspace"));

const modes: { id: AiChatMode; label: string; desc: string }[] = [
  { id: "chat", label: "闲聊", desc: "通用大模型对话，不访问笔记库" },
  { id: "rag", label: "知识库", desc: "检索笔记内容后回答，并附引用来源" },
  { id: "agent", label: "笔记助手", desc: "搜索、阅读、整理或写入笔记（非通用问答）" },
];

const activeModeMeta = computed(() => modes.find((m) => m.id === chat.mode) ?? modes[0]);
const isRetrievalMode = computed(() => isRetrievalTarget(chat.llmTarget));

const isThinking = computed(() => {
  if (!chat.isStreaming) return false;
  const last = chat.messages[chat.messages.length - 1];
  return last?.role === "assistant" && Boolean(last.streaming) && !last.content?.trim();
});

const inputPlaceholder = computed(() => {
  if (chat.mode === "rag" && isRetrievalMode.value) {
    if (isPage.value) {
      return "向全部笔记提问，将展示检索到的相关摘录…（Enter 发送）";
    }
    return "向知识库提问，将展示检索摘录（无需大模型）…（Enter 发送）";
  }
  if (chat.mode === "rag") {
    if (isPage.value) {
      return "向全部笔记提问，例如：天翼云 SD-WAN 业务受理流程…（Enter 发送）";
    }
    if (chat.ragScope === "currentDocument") {
      return "基于当前文档提问…（Enter 发送）";
    }
    if (chat.ragScope === "currentFolder") {
      return "基于当前文件夹提问…（Enter 发送）";
    }
    return "向知识库提问，例如：天翼云 SD-WAN…（Enter 发送）";
  }
  if (chat.mode === "agent") {
    return "描述要对笔记做的操作，例如：搜索 SQL 相关笔记并整理成新文档…";
  }
  return "输入消息…（Enter 发送，Shift+Enter 换行）";
});

const emptyHint = computed(() => {
  if (chat.mode === "rag" && isRetrievalMode.value) {
    return isPage.value
      ? "零外联：基于全文检索展示相关笔记摘录，不调用大模型"
      : "仅检索模式：展示命中笔记的关键摘录与引用，无需本地或云端大模型";
  }
  if (chat.mode === "rag") {
    return isPage.value
      ? "向全部笔记提问，AI 将检索并引用来源"
      : "基于工作区上下文检索笔记：可选全库、当前文档或当前文件夹";
  }
  if (chat.mode === "agent") {
    return "用自然语言操作笔记：搜索、阅读、创建或保存。日常聊天请用「闲聊」，查资料请用「知识库」";
  }
  return "与本地或云端大模型自由对话，不读取笔记库";
});

function scrollToBottom() {
  void nextTick(() => {
    if (listEl.value) {
      listEl.value.scrollTop = listEl.value.scrollHeight;
    }
  });
}

watch(
  () => chat.messages.map((m) => `${m.id}:${m.content}:${m.streaming}:${m.error ?? ""}`).join("|"),
  () => scrollToBottom(),
);

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void chat.send();
  }
}

function openCitation(id: string) {
  if (isPage.value) {
    void router.push({ path: "/workspace", query: { doc: id } });
    return;
  }
  void documents.openDocument(id);
}

function openFullPage() {
  ui.setChatPanelVisible(false);
  void router.push("/ai");
}

function useRagPrompt(text: string) {
  chat.input = text;
  inputEl.value?.focus();
}

function openConfig(tab?: AiSettingsTabInput) {
  configInitialTab.value = tab;
  configOpen.value = true;
}

function closeConfig() {
  configOpen.value = false;
  configInitialTab.value = undefined;
  void chat.loadAiEnabled();
}

function onConfigSaved() {
  void chat.loadAiEnabled();
}

function syncRagSurface() {
  chat.setRagSurface(ragSurface.value);
}

onMounted(() => {
  syncRagSurface();
  void chat.loadAiEnabled();
  inputEl.value?.focus();
});

watch(() => props.variant, syncRagSurface);
</script>

<template>
  <component
    :is="isPage ? 'div' : 'aside'"
    class="ai-chat-root relative flex min-h-0 flex-col bg-surface-0"
    :class="isPage ? 'h-full w-full' : 'h-full w-full'"
    data-testid="ai-chat-shell"
  >
    <header
      class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5"
      :class="isPage ? 'ai-chat-page-pad bg-surface-0/80 backdrop-blur-sm' : ''"
    >
      <Sparkles class="h-4 w-4 shrink-0 text-link" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">AI 助手</p>
        <p v-if="isPage" class="truncate text-[10px] text-muted">灵狸 · 本地优先的知识库对话</p>
      </div>
      <button
        v-if="!isPage"
        type="button"
        class="focus-ring rounded p-1 text-muted hover:bg-surface-1 hover:text-text"
        title="全屏打开"
        aria-label="在全屏页面打开 AI 助手"
        data-testid="chat-open-fullpage"
        @click="openFullPage"
      >
        <ExternalLink class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="focus-ring rounded p-1 text-muted hover:bg-surface-1 hover:text-text"
        title="历史会话"
        aria-label="历史会话"
        data-testid="chat-history"
        @click="historyOpen = true"
      >
        <History class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="focus-ring rounded p-1 text-muted hover:bg-surface-1 hover:text-text"
        title="新对话"
        aria-label="新对话"
        data-testid="chat-new-session"
        :disabled="chat.isStreaming"
        @click="chat.newSession()"
      >
        <MessageSquarePlus class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="focus-ring rounded p-1 text-muted hover:bg-surface-1 hover:text-text"
        title="模型配置"
        aria-label="模型配置"
        data-testid="chat-config"
        @click="openConfig()"
      >
        <Settings2 class="h-4 w-4" />
      </button>
      <button
        v-if="!isPage"
        type="button"
        class="focus-ring rounded p-1 text-muted hover:bg-surface-1 hover:text-text"
        aria-label="关闭 AI 面板"
        @click="ui.setChatPanelVisible(false)"
      >
        <X class="h-4 w-4" />
      </button>
    </header>

    <div
      class="flex shrink-0 flex-wrap gap-1 border-b border-border px-2 py-2"
      :class="isPage ? 'ai-chat-page-pad py-2.5' : ''"
      role="tablist"
      aria-label="对话模式"
    >
      <button
        v-for="m in modes"
        :key="m.id"
        type="button"
        role="tab"
        class="focus-ring rounded-md transition-colors"
        :class="[
          isPage ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs',
          chat.mode === m.id
            ? 'bg-link/15 font-medium text-link'
            : 'text-muted hover:bg-surface-1 hover:text-[var(--color-text)]',
        ]"
        :aria-selected="chat.mode === m.id"
        :title="m.desc"
        @click="chat.setMode(m.id)"
      >
        {{ m.label }}
      </button>
    </div>

    <div
      v-if="!(chat.mode === 'rag' && isPage)"
      class="shrink-0 border-b border-border bg-surface-1/40 px-3 py-2 text-xs text-muted"
      :class="isPage ? 'ai-chat-page-pad' : ''"
      data-testid="chat-mode-hint"
    >
      <span class="font-medium text-[var(--color-text)]">{{ activeModeMeta.label }}：</span>
      {{ activeModeMeta.desc }}
    </div>

    <div
      v-if="chat.mode === 'rag' && isPage"
      class="shrink-0 border-b border-border bg-surface-1/40 ai-chat-page-pad py-2"
      data-testid="rag-toolbar-page"
    >
      <RagScopeBar surface="standalone" />
    </div>

    <div
      v-else-if="chat.mode === 'rag'"
      class="shrink-0 border-b border-border px-2 py-2"
      data-testid="rag-toolbar-panel"
    >
      <RagScopeBar compact surface="workspace" />
    </div>

    <div
      ref="listEl"
      class="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4"
      :class="isPage ? 'ai-chat-page-pad ai-chat-thread' : ''"
      data-testid="chat-message-list"
    >
      <div
        v-if="!chat.messages.length"
        class="flex flex-col items-center justify-center gap-3 py-12 text-center"
      >
        <Sparkles class="h-8 w-8 text-link/40" aria-hidden="true" />
        <p class="max-w-sm text-sm text-muted">{{ emptyHint }}</p>
        <RagPromptChips
          v-if="chat.mode === 'rag' && chat.aiEnabled"
          :surface="ragSurface"
          @select="useRagPrompt"
        />
        <p v-if="!chat.aiEnabled" class="text-xs text-muted">
          尚未启用 AI 助手 ·
          <button
            type="button"
            class="text-link underline-offset-2 hover:underline"
            data-testid="chat-open-config-empty"
            @click="openConfig()"
          >
            立即配置
          </button>
        </p>
      </div>
      <ChatMessage
        v-for="(msg, index) in chat.messages"
        :key="msg.id"
        :message="msg"
        :is-last="index === chat.messages.length - 1"
        :is-thinking="isThinking"
        @open-citation="openCitation"
      />
    </div>

    <footer
      class="chat-composer-footer shrink-0 border-t border-border p-3"
      :class="isPage ? 'ai-chat-page-pad bg-surface-0/80 backdrop-blur-sm' : ''"
    >
      <div class="chat-composer" :class="isPage ? 'ai-chat-composer-page' : ''" data-testid="chat-composer">
        <textarea
          ref="inputEl"
          v-model="chat.input"
          :rows="isPage ? 3 : 2"
          class="chat-composer__input"
          :placeholder="inputPlaceholder"
          :disabled="!chat.aiEnabled || chat.isStreaming"
          data-testid="chat-input"
          @keydown="onKeydown"
        />

        <div class="chat-composer__toolbar">
          <LlmModelSelect
            v-if="chat.aiEnabled && chat.llmOptions.length"
            v-model="chat.llmTarget"
            :options="chat.llmOptions"
            :config="chat.aiConfig"
            :disabled="chat.isStreaming"
            placement="top"
            @update:model-value="chat.setLlmTarget"
            @configure="openConfig('models')"
          />
          <button
            v-else
            type="button"
            class="chat-composer__hint text-link underline-offset-2 hover:underline"
            data-testid="chat-open-config-composer"
            @click="openConfig()"
          >
            配置 AI 模型
          </button>

          <div class="chat-composer__actions">
            <button
              v-if="chat.isStreaming"
              type="button"
              class="chat-composer__send chat-composer__send--stop focus-ring"
              aria-label="停止生成"
              data-testid="chat-stop"
              @click="chat.stop()"
            >
              <Square class="h-3.5 w-3.5" />
            </button>
            <button
              v-else
              type="button"
              class="chat-composer__send focus-ring"
              :class="{ 'chat-composer__send--disabled': !chat.canSend }"
              :disabled="!chat.canSend"
              aria-label="发送"
              data-testid="chat-send"
              @click="chat.send()"
            >
              <Send class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <p
        v-if="!chat.aiEnabled"
        class="mt-1.5 text-center text-[10px] text-muted"
        :class="isPage ? 'ai-chat-composer-page' : ''"
      >
        <button
          type="button"
          class="text-link underline-offset-2 hover:underline"
          @click="openConfig()"
        >
          打开模型配置
        </button>
        以启用 AI 助手
      </p>
    </footer>

    <ChatSessionPanel
      :surface="ragSurface"
      :open="historyOpen"
      :compact="!isPage"
      @close="historyOpen = false"
    />

    <AiSettingsDrawer
      :open="configOpen"
      :initial-tab="configInitialTab"
      @close="closeConfig"
      @saved="onConfigSaved"
    />
  </component>
</template>

<style scoped>
.ai-chat-page-pad {
  padding-left: clamp(1rem, 2.5vw, 2rem);
  padding-right: clamp(1rem, 2.5vw, 2rem);
}

.ai-chat-thread {
  width: 100%;
  max-width: none;
}

.ai-chat-composer-page {
  width: 100%;
  max-width: none;
  margin-inline: 0;
}
</style>
