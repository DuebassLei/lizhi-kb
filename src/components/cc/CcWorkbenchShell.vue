<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import {
  GitCommit,
  History,
  MessageSquarePlus,
  PanelRight,
  Search,
  Settings,
  X,
} from "@lucide/vue";

import { useCcWorkbenchStore } from "../../stores/ccWorkbench";
import { useUiStore } from "../../stores/ui";
import CcBridgeProcessMenu from "./chat/CcBridgeProcessMenu.vue";
import CcChatInputBox from "./chat/CcChatInputBox.vue";
import CcChatMessage from "./chat/CcChatMessage.vue";
import CcChatWelcome from "./chat/CcChatWelcome.vue";
import CcModeContextBar from "./chat/CcModeContextBar.vue";
import CcWorkbenchDrawer from "./CcWorkbenchDrawer.vue";
import CcWorkbenchSplitPanel from "./CcWorkbenchSplitPanel.vue";
import CcHistoryPanel from "./chat/CcHistoryPanel.vue";
import CcSessionTitleEditor from "./chat/CcSessionTitleEditor.vue";
import CcStatusPanelBar from "./chat/CcStatusPanelBar.vue";
import CcToolPermissionDialog from "./chat/CcToolPermissionDialog.vue";
import CcCommitAiDialog from "./settings/CcCommitAiDialog.vue";
import { ccWorkbenchGitUndoEdits } from "../../services/ccWorkbenchService";
import type { CcFileChangeItem, CcSubagentItem } from "../../composables/cc/useCcStatusPanel";
import { resolveMessageBlocks } from "../../utils/ccMessageBlocks";
import {
  buildSessionMarkdown,
  buildCcSessionsMarkdown,
} from "../../utils/exportCcSessions";
import { copyToClipboard } from "../../utils/copyToClipboard";
import {
  messageHasSuccessfulLizhiQueryTool,
  vaultKbQueryModelHint,
} from "../../utils/ccVaultQueryGuard";

const cc = useCcWorkbenchStore();
const ui = useUiStore();
const {
  config,
  messages,
  input,
  streaming,
  loadError,
  statusHint,
  ready,
  status,
  sessionId,
  sessionBoundCwdMode,
  activeProvider,
  providers,
  switchingProvider,
  modelOptions,
  selectedModelId,
  effectiveLongContextEnabled,
  context1mDisabled,
  permissionMode,
  reasoningEffort,
  statusPanelExpanded,
  statusPanelTab,
  statusPanelData,
  contextLabel,
  contextPercentage,
  contextUsedTokens,
  effectiveContextMax,
  sessionTitleText,
  history,
  activeHistoryId,
  openedFiles,
  attachments,
  selectedAgent,
  disableThinking,
  pendingToolPermission,
} = storeToRefs(cc);

const listEl = ref<HTMLElement | null>(null);
const settingsOpen = ref(false);
const searchOpen = ref(false);
const searchQuery = ref("");
const historyOpen = ref(false);
const splitOpen = ref(false);
const selectedFileChange = ref<CcFileChangeItem | null>(null);
const selectedSubagent = ref<CcSubagentItem | null>(null);
const exporting = ref(false);
const commitDialogOpen = ref(false);

const filteredMessages = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return messages.value.filter(
    (m) =>
      !q ||
      m.content.toLowerCase().includes(q) ||
      (m.thinking?.toLowerCase().includes(q) ?? false),
  );
});

const isThinking = computed(
  () => streaming.value && !disableThinking.value,
);

const searchMatchCount = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return 0;
  return messages.value.filter((m) => m.content.toLowerCase().includes(q)).length;
});

const displayContextLabel = computed(() => {
  if (contextLabel.value) return contextLabel.value;
  return "";
});

const sessionCwdMismatch = computed(() => {
  if (!sessionId.value || !config.value) return false;
  return sessionBoundCwdMode.value !== null && sessionBoundCwdMode.value !== config.value.cwdMode;
});

const vaultKbModelHint = computed(() => {
  const historyHasLizhiMcpResult = messages.value.some((msg) => {
    if (msg.role !== "assistant") return false;
    const blocks = resolveMessageBlocks(msg);
    return messageHasSuccessfulLizhiQueryTool(undefined, blocks);
  });
  return vaultKbQueryModelHint({
    cwdMode: config.value?.cwdMode ?? "vault",
    modelId: selectedModelId.value,
    inputText: input.value,
    historyHasLizhiMcpResult,
  });
});

function priorUserTextForMessage(index: number): string | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    const msg = filteredMessages.value[i];
    if (msg?.role === "user") return msg.content;
  }
  return null;
}

function renameSessionTitle(title: string) {
  cc.renameCurrentSessionTitle(title);
  ui.showToast("success", "已重命名会话");
}

function scrollToBottom() {
  void nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight;
  });
}

watch(
  () => messages.value.map((m) => `${m.id}:${m.content}:${m.streaming}`).join("|"),
  () => scrollToBottom(),
);

onMounted(() => {
  void cc.refresh();
});

function openSettings() {
  settingsOpen.value = true;
}

function onSettingsSaved() {
  void cc.refresh();
}

function onAddCustomModel(payload: {
  id: string;
  label?: string;
  inputPrice?: number;
  outputPrice?: number;
}) {
  const ok = cc.addCustomModel(payload.id, payload.label, {
    inputPrice: payload.inputPrice,
    outputPrice: payload.outputPrice,
  });
  if (!ok) {
    ui.showToast("error", "模型 ID 无效或已存在");
  }
}

function toggleSearch() {
  searchOpen.value = !searchOpen.value;
  if (!searchOpen.value) searchQuery.value = "";
}

function toggleHistory() {
  historyOpen.value = !historyOpen.value;
}

function onHistoryDrawerKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && historyOpen.value) {
    event.preventDefault();
    historyOpen.value = false;
  }
}

watch(historyOpen, (open) => {
  if (open) {
    window.addEventListener("keydown", onHistoryDrawerKeydown);
  } else {
    window.removeEventListener("keydown", onHistoryDrawerKeydown);
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", onHistoryDrawerKeydown);
});

function loadHistoryEntry(id: string) {
  cc.loadHistorySession(id);
  historyOpen.value = false;
}

function toggleSplit() {
  splitOpen.value = !splitOpen.value;
  if (!splitOpen.value) {
    selectedFileChange.value = null;
    selectedSubagent.value = null;
  }
}

function onSelectFileChange(item: CcFileChangeItem) {
  selectedFileChange.value = item;
  selectedSubagent.value = null;
  splitOpen.value = true;
  cc.statusPanelTab = "files";
  cc.statusPanelExpanded = true;
}

function onSelectSubagent(item: CcSubagentItem) {
  selectedSubagent.value = item;
  selectedFileChange.value = null;
  splitOpen.value = true;
  cc.statusPanelTab = "subagent";
  cc.statusPanelExpanded = true;
}

function onClarifyFill(text: string) {
  input.value = text;
  ui.showToast("success", "已填入输入框");
}

function onClarifySubmit(text: string) {
  if (streaming.value) return;
  input.value = text;
  void cc.send();
}

function deleteHistoryEntry(id: string) {
  cc.deleteHistorySession(id);
  ui.showToast("success", "已删除会话");
}

function renameHistoryEntry(id: string, title: string) {
  cc.renameHistorySession(id, title);
  ui.showToast("success", "已重命名");
}

async function handleExportCurrent(format: "md" | "json") {
  if (exporting.value || !messages.value.length) return;
  exporting.value = true;
  try {
    const ok = await cc.exportCurrentSession(format);
    if (ok) ui.showToast("success", format === "md" ? "已导出当前会话" : "已导出 JSON");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "导出失败");
  } finally {
    exporting.value = false;
  }
}

async function handleExportHistory(format: "md" | "json") {
  if (exporting.value || !history.value.length) return;
  exporting.value = true;
  try {
    const ok = await cc.exportHistory(format);
    if (ok) ui.showToast("success", format === "md" ? "已导出全部历史" : "已导出 JSON");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "导出失败");
  } finally {
    exporting.value = false;
  }
}

async function handleCopyCurrent() {
  if (!messages.value.length) return;
  const entry = {
    id: activeHistoryId.value ?? `cc-export-${Date.now()}`,
    title: sessionTitleText.value,
    updatedAt: Date.now(),
    messages: messages.value,
    sessionId: sessionId.value,
    openedFiles: [...openedFiles.value],
    selectedAgent: selectedAgent.value ? { name: selectedAgent.value.name } : null,
  };
  try {
    const md = buildSessionMarkdown(entry);
    const ok = await copyToClipboard(md);
    if (ok) ui.showToast("success", "已复制当前会话 Markdown");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "复制失败");
  }
}

async function handleCopyAll() {
  if (!history.value.length) return;
  try {
    const md = buildCcSessionsMarkdown(history.value);
    const ok = await copyToClipboard(md);
    if (ok) ui.showToast("success", "已复制全部历史 Markdown");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "复制失败");
  }
}

function clearAllHistory() {
  cc.clearAllHistory();
  ui.showToast("success", "已清空历史会话");
}

async function onUndoEdits() {
  const path = config.value?.projectPath;
  if (!path || config.value?.cwdMode !== "project") {
    ui.showToast("error", "仅项目模式可撤销文件编辑");
    return;
  }
  const files = statusPanelData.value.fileChanges.map((f) => f.path);
  if (!files.length) return;
  try {
    const count = await ccWorkbenchGitUndoEdits(path, files);
    ui.showToast("success", `已撤销 ${count} 个文件的编辑`);
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "撤销失败");
  }
}

function onKeepAllEdits() {
  ui.showToast("success", "已保留全部编辑");
}

function onDiscardAllEdits() {
  void onUndoEdits();
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col" data-testid="cc-workbench-shell">
    <header class="cc-workbench-header shrink-0 border-b border-border px-4 py-2.5">
      <div class="flex items-center justify-between gap-3">
        <CcSessionTitleEditor
          :title="sessionTitleText"
          :editable="messages.length > 0"
          @rename="renameSessionTitle"
        />

        <div class="flex items-center gap-0.5">
          <button
            type="button"
            class="cc-workbench-icon-btn"
            :class="{ 'cc-workbench-icon-btn--active': searchOpen }"
            title="搜索会话"
            @click="toggleSearch"
          >
            <Search class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="cc-workbench-icon-btn"
            title="新会话"
            @click="cc.clearMessages()"
          >
            <MessageSquarePlus class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="cc-workbench-icon-btn"
            :class="{ 'cc-workbench-icon-btn--active': splitOpen }"
            title="分屏详情"
            @click="toggleSplit"
          >
            <PanelRight class="h-4 w-4" />
          </button>
          <button
            v-if="config?.cwdMode === 'project' && config?.projectPath"
            type="button"
            class="cc-workbench-icon-btn"
            title="Commit AI"
            @click="commitDialogOpen = true"
          >
            <GitCommit class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="cc-workbench-icon-btn"
            :class="{ 'cc-workbench-icon-btn--active': historyOpen }"
            title="历史会话"
            @click="toggleHistory"
          >
            <History class="h-4 w-4" />
          </button>
          <CcBridgeProcessMenu />
          <button
            type="button"
            class="cc-workbench-icon-btn"
            title="工作台设置"
            @click="openSettings"
          >
            <Settings class="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>

    <div
      v-if="searchOpen"
      class="shrink-0 border-b border-border bg-surface-0 px-4 py-2"
    >
      <div class="mx-auto flex max-w-3xl items-center gap-2">
        <input
          v-model="searchQuery"
          type="search"
          class="cc-workbench-search-input"
          placeholder="搜索当前会话消息…"
          autofocus
        />
        <span v-if="searchQuery.trim()" class="text-xs text-muted">
          {{ searchMatchCount }} 条匹配
        </span>
        <button type="button" class="cc-workbench-icon-btn" title="关闭搜索" @click="toggleSearch">
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div class="flex min-h-0 flex-1">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    <CcModeContextBar
      :cwd-mode="config?.cwdMode ?? 'vault'"
      :mcp-enabled="status?.mcpEnabled"
      :runtime-ready="ready"
      :status-hint="statusHint"
      :load-error="loadError"
      :workbench-enabled="config?.enabled"
      :session-cwd-mismatch="sessionCwdMismatch"
      @open-settings="openSettings"
    />

    <div ref="listEl" class="cc-workbench-messages min-h-0 flex-1 overflow-y-auto px-5 py-2">
      <CcChatWelcome
        v-if="!messages.length"
        :provider-name="activeProvider?.name"
        :selected-agent="selectedAgent"
        :cwd-mode="config?.cwdMode ?? 'vault'"
        :mcp-enabled="status?.mcpEnabled"
        :runtime-ready="ready"
        @select-agent="cc.setSelectedAgent($event)"
      />
      <div v-else class="mx-auto max-w-3xl">
        <CcChatMessage
          v-for="(msg, index) in filteredMessages"
          :key="msg.id"
          :message="msg"
          :is-last="index === filteredMessages.length - 1"
          :streaming="streaming"
          :is-thinking="isThinking"
          :clarify-agent-id="selectedAgent?.id ?? null"
          :cwd-mode="config?.cwdMode ?? 'vault'"
          :prior-user-text="priorUserTextForMessage(index)"
          :prev-created-at="index > 0 ? filteredMessages[index - 1]?.createdAt : undefined"
          @select-file-change="onSelectFileChange"
          @select-subagent="onSelectSubagent"
          @clarify-fill="onClarifyFill"
          @clarify-submit="onClarifySubmit"
        />
      </div>
    </div>

    <footer class="shrink-0 border-t border-border bg-surface-0/80 px-4 pb-4 pt-2">
      <div class="mx-auto max-w-3xl">
        <CcStatusPanelBar
          :expanded="statusPanelExpanded"
          :active-tab="statusPanelTab"
          :todo-count="statusPanelData.todoCount"
          :subagent-count="statusPanelData.subagentCount"
          :subagent-running-count="statusPanelData.subagentRunningCount"
          :file-change-count="statusPanelData.fileChangeCount"
          :todos="statusPanelData.todos"
          :subagents="statusPanelData.subagents"
          :file-changes="statusPanelData.fileChanges"
          :streaming="streaming"
          :cwd-mode="config?.cwdMode"
          :project-path="config?.projectPath"
          @toggle-tab="cc.toggleStatusPanelTab"
          @select-file="onSelectFileChange"
          @select-subagent="onSelectSubagent"
          @keep-all-edits="onKeepAllEdits"
          @discard-all-edits="onDiscardAllEdits"
          @undo-edits="onUndoEdits"
        />
        <CcChatInputBox
          v-model="input"
          :streaming="streaming"
          :disabled="streaming || !ready"
          :model-options="modelOptions"
          :selected-model-id="selectedModelId"
          :providers="providers"
          :active-provider-id="activeProvider?.id"
          :switching-provider="switchingProvider"
          :long-context-enabled="effectiveLongContextEnabled"
          :context-1m-disabled="context1mDisabled"
          :permission-mode="permissionMode"
          :reasoning-effort="reasoningEffort"
          :context-label="displayContextLabel"
          :context-percentage="contextPercentage"
          :context-used-tokens="contextUsedTokens"
          :context-max-tokens="effectiveContextMax"
          :cwd-mode="config?.cwdMode ?? 'vault'"
          :project-path="config?.projectPath"
          :opened-files="openedFiles"
          :attachments="attachments"
          :disable-thinking="disableThinking"
          :selected-agent="selectedAgent"
          :runtime-ready="ready"
          :runtime-hint="statusHint"
          :prompt-enhancer-enabled="config?.promptEnhancer?.enabled !== false"
          :session-cwd-mismatch="sessionCwdMismatch"
          :vault-kb-model-hint="vaultKbModelHint"
          :mcp-enabled="status?.mcpEnabled"
          @update:selected-model-id="cc.setSelectedModelId($event)"
          @update:long-context-enabled="cc.setLongContextEnabled($event)"
          @switch-provider="cc.switchProvider($event)"
          @add-custom-model="onAddCustomModel($event)"
          @update:permission-mode="cc.permissionMode = $event"
          @update:reasoning-effort="cc.reasoningEffort = $event"
          @update:opened-files="cc.openedFiles = $event"
          @update:attachments="cc.attachments = $event"
          @update:disable-thinking="cc.disableThinking = $event"
          @update:selected-agent="cc.setSelectedAgent($event)"
          @remove-opened-file="cc.removeOpenedFile"
          @clear-context="cc.clearContext"
          @pick-attachments="cc.pickAttachments()"
          @remove-attachment="cc.removeAttachment"
          @clear-attachments="cc.clearAttachments"
          @attach-files-from-browser="cc.attachFilesFromBrowser"
          @set-cwd-mode="cc.setCwdMode($event)"
          @pick-project="cc.pickProject()"
          @submit="cc.send()"
          @stop="cc.stop()"
        />
      </div>
    </footer>
      </div>

      <CcWorkbenchSplitPanel
        v-if="splitOpen"
        :file-change="selectedFileChange"
        :subagent="selectedSubagent"
        :context-files="openedFiles"
        @close="toggleSplit"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="historyOpen"
        class="cc-history-drawer"
        data-testid="cc-history-drawer"
      >
        <button
          type="button"
          class="cc-history-drawer__backdrop"
          aria-label="关闭历史会话"
          @click="historyOpen = false"
        />
        <aside
          class="cc-history-drawer__panel"
          role="dialog"
          aria-label="历史会话"
          @click.stop
        >
          <CcHistoryPanel
            :history="history"
            :active-id="activeHistoryId"
            :exporting="exporting"
            :has-current-messages="messages.length > 0"
            @close="historyOpen = false"
            @load="loadHistoryEntry"
            @delete="deleteHistoryEntry"
            @rename="renameHistoryEntry"
            @export-current="handleExportCurrent"
            @export-all="handleExportHistory"
            @copy-current="handleCopyCurrent"
            @copy-all="handleCopyAll"
            @clear-all="clearAllHistory"
          />
        </aside>
      </div>
    </Teleport>

    <CcWorkbenchDrawer
      :open="settingsOpen"
      @close="settingsOpen = false"
      @saved="onSettingsSaved"
    />

    <CcToolPermissionDialog
      :pending="pendingToolPermission"
      @allow="cc.respondToolPermission('allow')"
      @deny="cc.respondToolPermission('deny', '用户拒绝')"
    />

    <CcCommitAiDialog
      :open="commitDialogOpen"
      :project-path="config?.projectPath ?? null"
      @close="commitDialogOpen = false"
    />
  </div>
</template>

<style scoped>
.cc-workbench-header {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-surface-1) 40%, transparent) 0%,
    transparent 100%
  );
}

.cc-workbench-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  padding: 0.4375rem;
  color: var(--color-muted);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.cc-workbench-icon-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
  color: var(--color-text);
}

.cc-workbench-icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.cc-workbench-icon-btn--active {
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
}

.cc-workbench-search-input {
  flex: 1;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.375rem 0.625rem;
  font-size: 0.8125rem;
  outline: none;
}

.cc-history-drawer {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
}

.cc-history-drawer__backdrop {
  position: absolute;
  inset: 0;
  border: none;
  background: color-mix(in srgb, var(--color-base) 55%, transparent);
  backdrop-filter: blur(1px);
  cursor: default;
}

.cc-history-drawer__panel {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  width: min(22rem, 92vw);
  flex-direction: column;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: -12px 0 32px rgb(0 0 0 / 0.18);
  animation: cc-history-drawer-in 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes cc-history-drawer-in {
  from {
    opacity: 0.7;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
