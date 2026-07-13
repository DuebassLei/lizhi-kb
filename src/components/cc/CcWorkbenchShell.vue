<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import {
  History,
  MessageSquarePlus,
  PanelRight,
  Search,
  Settings,
  SquarePen,
  X,
} from "@lucide/vue";

import { useDocumentsStore } from "../../stores/documents";
import { useCcWorkbenchStore } from "../../stores/ccWorkbench";
import { useUiStore } from "../../stores/ui";
import CcChatInputBox from "./chat/CcChatInputBox.vue";
import CcChatMessage from "./chat/CcChatMessage.vue";
import CcChatWelcome from "./chat/CcChatWelcome.vue";
import CcWorkbenchDrawer from "./CcWorkbenchDrawer.vue";
import CcWorkbenchSplitPanel from "./CcWorkbenchSplitPanel.vue";
import CcHistoryPanel from "./chat/CcHistoryPanel.vue";
import CcSessionTitleEditor from "./chat/CcSessionTitleEditor.vue";
import CcStatusPanelBar from "./chat/CcStatusPanelBar.vue";
import CcToolPermissionDialog from "./chat/CcToolPermissionDialog.vue";
import type { CcFileChangeItem, CcSubagentItem } from "../../composables/cc/useCcStatusPanel";

const cc = useCcWorkbenchStore();
const documents = useDocumentsStore();
const ui = useUiStore();
const {
  config,
  messages,
  input,
  streaming,
  loadError,
  statusHint,
  ready,
  activeProvider,
  providers,
  switchingProvider,
  modelOptions,
  selectedModelId,
  longContextEnabled,
  permissionMode,
  reasoningEffort,
  statusPanelExpanded,
  statusPanelTab,
  statusPanelData,
  cwdModeLabelText,
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

const activeDocumentPath = computed(() => {
  const id = documents.activeId;
  if (!id) return null;
  return documents.tree.find((d) => d.id === id)?.path ?? null;
});

function renameSessionTitle(title: string) {
  cc.renameCurrentSessionTitle(title);
  ui.showToast("success", "已重命名会话");
}

function attachCurrentDocument() {
  const path = activeDocumentPath.value;
  if (!path) return;
  cc.attachContextPaths([path]);
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

function onAddCustomModel(payload: { id: string; label?: string }) {
  const ok = cc.addCustomModel(payload.id, payload.label);
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

function clearAllHistory() {
  cc.clearAllHistory();
  ui.showToast("success", "已清空历史会话");
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
            type="button"
            class="cc-workbench-icon-btn"
            :class="{ 'cc-workbench-icon-btn--active': historyOpen }"
            title="历史会话"
            @click="toggleHistory"
          >
            <History class="h-4 w-4" />
          </button>
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

    <div
      v-if="historyOpen"
      class="shrink-0 border-b border-border bg-surface-0 px-4 py-3"
    >
      <div class="mx-auto max-w-3xl">
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
          @clear-all="clearAllHistory"
        />
      </div>
    </div>

    <div class="flex min-h-0 flex-1">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    <div
      v-if="loadError || statusHint || !config?.enabled"
      class="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200"
    >
      <template v-if="loadError">{{ loadError }}</template>
      <template v-else-if="!config?.enabled">
        工作台未启用，请
        <button type="button" class="underline" @click="openSettings">打开设置</button>
        开启。
      </template>
      <template v-else-if="statusHint">{{ statusHint }}</template>
    </div>

    <div ref="listEl" class="cc-workbench-messages min-h-0 flex-1 overflow-y-auto px-5 py-2">
      <CcChatWelcome
        v-if="!messages.length"
        :provider-name="activeProvider?.name"
        :selected-agent="selectedAgent"
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
          @select-file-change="onSelectFileChange"
          @select-subagent="onSelectSubagent"
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
          :file-change-count="statusPanelData.fileChangeCount"
          :todos="statusPanelData.todos"
          :subagents="statusPanelData.subagents"
          :file-changes="statusPanelData.fileChanges"
          :streaming="streaming"
          @toggle-tab="cc.toggleStatusPanelTab"
          @select-file="onSelectFileChange"
          @select-subagent="onSelectSubagent"
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
          :long-context-enabled="longContextEnabled"
          :permission-mode="permissionMode"
          :reasoning-effort="reasoningEffort"
          :cwd-mode-label="cwdModeLabelText"
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
          :active-document-path="activeDocumentPath"
          :runtime-ready="ready"
          :runtime-hint="statusHint"
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
          @attach-current-document="attachCurrentDocument"
          @submit="cc.send()"
          @stop="cc.stop()"
        />
        <p class="mt-2 flex items-center justify-center gap-1 text-[0.625rem] text-muted">
          <SquarePen class="h-3 w-3" />
          工作目录在
          <button type="button" class="text-link underline" @click="openSettings">设置</button>
          中切换（{{ cwdModeLabelText }}）
        </p>
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
</style>
