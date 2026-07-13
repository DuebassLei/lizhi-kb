<script setup lang="ts">
import { computed, ref } from "vue";
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

const props = defineProps<{
  surface: RagSurface;
  open: boolean;
  compact?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const chat = useChatStore();
const ui = useUiStore();
const confirmClear = ref(false);
const exporting = ref(false);

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

function deleteSession(event: Event, id: string) {
  event.stopPropagation();
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
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-40 flex"
    :class="compact ? 'justify-end' : ''"
    data-testid="chat-session-panel"
  >
    <button
      type="button"
      class="absolute inset-0 bg-overlay/60 backdrop-blur-[1px]"
      aria-label="关闭历史会话"
      @click="emit('close')"
    />

    <aside
      class="relative flex min-h-0 flex-col border-border bg-surface-0 shadow-xl"
      :class="
        compact
          ? 'h-full w-72 border-l'
          : 'm-3 h-[calc(100%-1.5rem)] w-full max-w-sm rounded-xl border'
      "
      role="dialog"
      aria-label="历史会话"
      @click.stop
    >
      <header class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">历史会话</p>
          <p class="text-[10px] text-muted">{{ surfaceLabel }} · {{ summary }}</p>
        </div>
        <Btn variant="ghost" size="sm" :disabled="chat.isStreaming" @click="startNew">
          <MessageSquarePlus class="h-4 w-4" />
        </Btn>
        <button
          type="button"
          class="focus-ring rounded p-1 text-muted hover:bg-surface-1"
          aria-label="关闭"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </header>

      <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
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
              @click="deleteSession($event, session.id)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </li>
        </ul>
      </div>

      <footer class="shrink-0 space-y-2 border-t border-border p-3">
        <div
          v-if="confirmClear"
          class="rounded-lg border border-danger/30 bg-danger/5 p-2.5"
          data-testid="chat-session-clear-confirm"
        >
          <p class="text-xs text-[var(--color-text)]">
            确定清空「{{ surfaceLabel }}」的全部历史？此操作不可恢复。
          </p>
          <div class="mt-2 flex justify-end gap-2">
            <Btn variant="ghost" size="sm" @click="cancelClearAll">取消</Btn>
            <Btn variant="secondary" size="sm" @click="confirmClearAll">确认清空</Btn>
          </div>
        </div>

        <div v-else class="flex flex-wrap gap-2">
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
          v-if="!confirmClear"
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
</template>
