<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { Download, MessageSquarePlus, Trash2, X } from "@lucide/vue";
import {
  formatSessionTime,
  sessionModeLabel,
  type ChatSession,
} from "../../utils/chatSessionStorage";
import { formatSessionListSummary } from "../../utils/exportChatSessions";
import type { RagSurface } from "../../stores/chat";
import { useChatStore } from "../../stores/chat";
import { useUiStore } from "../../stores/ui";
import Btn from "../ui/Btn.vue";
import ConfirmDialog from "../common/ConfirmDialog.vue";

const props = defineProps<{
  surface: RagSurface;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const chat = useChatStore();
const ui = useUiStore();
const confirmClear = ref(false);
const exporting = ref(false);
const deletePending = ref<{ id: string; title: string } | null>(null);

const sessions = computed(() => chat.sessionList(props.surface));
const exportableCount = computed(
  () => sessions.value.filter((s) => s.messages.length > 0).length,
);

const surfaceLabel = computed(() =>
  props.surface === "workspace" ? "知识库对话" : "独立页对话",
);

const summary = computed(() => formatSessionListSummary(sessions.value));

function selectSession(id: string) {
  chat.selectSession(id);
  emit("close");
}

function requestDeleteSession(event: Event, id: string) {
  event.stopPropagation();
  const session = sessions.value.find((s) => s.id === id);
  deletePending.value = {
    id,
    title: session?.title?.trim() || "未命名会话",
  };
}

function confirmDeleteSession() {
  if (!deletePending.value) return;
  const { id } = deletePending.value;
  deletePending.value = null;
  chat.deleteSession(id);
  ui.showToast("success", "已删除会话");
}

function startNew() {
  chat.newSession();
  emit("close");
}

function isActive(session: ChatSession) {
  return chat.activeSessionId === session.id && chat.ragSurface === props.surface;
}

async function handleExport(format: "md" | "json") {
  if (exporting.value || !exportableCount.value) return;
  exporting.value = true;
  try {
    const ok = await chat.exportSessions(format, props.surface);
    if (ok) {
      ui.showToast("success", format === "md" ? "已导出 Markdown" : "已导出 JSON");
    }
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "导出失败");
  } finally {
    exporting.value = false;
  }
}

function requestClearAll() {
  if (!sessions.value.length) return;
  confirmClear.value = true;
}

function cancelClearAll() {
  confirmClear.value = false;
}

function confirmClearAll() {
  chat.clearAllSessions(props.surface);
  confirmClear.value = false;
  ui.showToast("success", "已清空全部历史");
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && props.open) {
    event.preventDefault();
    emit("close");
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      confirmClear.value = false;
      window.addEventListener("keydown", onKeydown);
    } else {
      window.removeEventListener("keydown", onKeydown);
    }
  },
);

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="chat-history-drawer"
      data-testid="chat-session-panel"
    >
      <button
        type="button"
        class="chat-history-drawer__backdrop"
        aria-label="关闭历史会话"
        @click="emit('close')"
      />

      <aside
        class="chat-history-drawer__panel"
        role="dialog"
        aria-label="历史会话"
        @click.stop
      >
        <header class="chat-history-drawer__head">
          <div class="min-w-0 flex-1">
            <p class="chat-history-drawer__title">历史会话</p>
            <p class="chat-history-drawer__subtitle">{{ surfaceLabel }} · {{ summary }}</p>
          </div>
          <Btn variant="ghost" size="sm" :disabled="chat.isStreaming" title="新会话" @click="startNew">
            <MessageSquarePlus class="h-4 w-4" />
          </Btn>
          <button
            type="button"
            class="chat-history-drawer__close focus-ring"
            aria-label="关闭"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </header>

        <div class="chat-history-drawer__list scrollbar-thin">
          <p v-if="!sessions.length" class="px-2 py-8 text-center text-xs text-muted">
            暂无历史会话
          </p>

          <ul v-else class="space-y-1" role="list">
            <li
              v-for="session in sessions"
              :key="session.id"
              class="group flex items-start gap-1 rounded-lg border transition-colors"
              :class="
                isActive(session)
                  ? 'border-link/30 bg-link/10'
                  : 'border-transparent hover:border-border hover:bg-surface-1'
              "
            >
              <button
                type="button"
                class="focus-ring min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left"
                :data-testid="`chat-session-item-${session.id}`"
                @click="selectSession(session.id)"
              >
                <span class="block truncate text-sm font-medium text-[var(--color-text)]">
                  {{ session.title }}
                </span>
                <span class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                  <span class="rounded bg-surface-2 px-1 py-0.5">
                    {{ sessionModeLabel(session.mode) }}
                  </span>
                  <span>{{ formatSessionTime(session.updatedAt) }}</span>
                  <span>{{ session.messages.length }} 条</span>
                </span>
              </button>
              <button
                type="button"
                class="focus-ring shrink-0 rounded p-1 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
                :class="isActive(session) ? 'opacity-100' : ''"
                aria-label="删除此会话"
                :data-testid="`chat-session-delete-${session.id}`"
                :disabled="chat.isStreaming"
                @click="requestDeleteSession($event, session.id)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </li>
          </ul>
        </div>

        <footer class="chat-history-drawer__foot">
          <div class="flex flex-wrap gap-2">
            <Btn
              variant="secondary"
              size="sm"
              class="flex-1"
              :disabled="!exportableCount || exporting || chat.isStreaming"
              data-testid="chat-session-export-md"
              @click="handleExport('md')"
            >
              <Download class="mr-1 h-3.5 w-3.5" />
              导出 MD
            </Btn>
            <Btn
              variant="secondary"
              size="sm"
              class="flex-1"
              :disabled="!exportableCount || exporting || chat.isStreaming"
              data-testid="chat-session-export-json"
              @click="handleExport('json')"
            >
              <Download class="mr-1 h-3.5 w-3.5" />
              导出 JSON
            </Btn>
          </div>

          <Btn
            variant="ghost"
            size="sm"
            class="w-full text-danger hover:bg-danger/10"
            :disabled="!sessions.length || chat.isStreaming"
            data-testid="chat-session-clear-all"
            @click="requestClearAll"
          >
            <Trash2 class="mr-1 h-3.5 w-3.5" />
            清空全部历史
          </Btn>
        </footer>
      </aside>
    </div>

    <ConfirmDialog
      :open="!!deletePending"
      title="删除会话"
      :item-name="deletePending?.title"
      description="删除后无法恢复，请确认是否继续。"
      confirm-label="删除"
      destructive
      test-id="delete-chat-session-dialog"
      @confirm="confirmDeleteSession"
      @cancel="deletePending = null"
    />

    <ConfirmDialog
      :open="confirmClear"
      title="清空全部历史"
      :item-name="surfaceLabel"
      description="将清空该面板下全部会话，删除后无法恢复。"
      confirm-label="清空"
      destructive
      test-id="chat-session-clear-confirm"
      @confirm="confirmClearAll"
      @cancel="cancelClearAll"
    />
  </Teleport>
</template>

<style scoped>
.chat-history-drawer {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
}

.chat-history-drawer__backdrop {
  position: absolute;
  inset: 0;
  border: none;
  background: color-mix(in srgb, var(--color-base) 55%, transparent);
  backdrop-filter: blur(1px);
  cursor: default;
}

.chat-history-drawer__panel {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  width: min(22rem, 92vw);
  flex-direction: column;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: -12px 0 32px rgb(0 0 0 / 0.18);
  animation: chat-history-drawer-in 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes chat-history-drawer-in {
  from {
    opacity: 0.7;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.chat-history-drawer__head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  padding: 0.75rem 0.875rem;
}

.chat-history-drawer__title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.chat-history-drawer__subtitle {
  margin-top: 0.125rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.chat-history-drawer__close {
  flex-shrink: 0;
  border-radius: 0.375rem;
  padding: 0.25rem;
  color: var(--color-muted);
}

.chat-history-drawer__close:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.chat-history-drawer__list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.chat-history-drawer__foot {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 40%, var(--color-surface-0));
  padding: 0.75rem;
}
</style>
