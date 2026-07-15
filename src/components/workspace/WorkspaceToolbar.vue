<script setup lang="ts">
import { computed } from "vue";
import {
  ArrowLeft,
  Star,
  List,
  Type,
  Focus,
  Link2,
  Bot,
  Save,
  Columns2,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
} from "@lucide/vue";
import { useDocumentsStore } from "../../stores/documents";
import { useEditorStore } from "../../stores/editor";
import { useUiStore, type WorkspaceViewMode } from "../../stores/ui";
import { useChatStore } from "../../stores/chat";
import { useWechatTheme } from "../../composables/useWechatTheme";
import { insertModuleSnippet } from "../../services/wechatExport";
import BtnIcon from "../ui/BtnIcon.vue";
import ExportMenu from "./ExportMenu.vue";
import WechatToolbarMenu from "../wechat/WechatToolbarMenu.vue";
const ui = useUiStore();
const editor = useEditorStore();
const documents = useDocumentsStore();
const chat = useChatStore();
const { themeId: wechatThemeId } = useWechatTheme();

const modes: { id: WorkspaceViewMode; label: string }[] = [
  { id: "edit", label: "编辑" },
  { id: "graph", label: "图谱" },
  { id: "mindmap", label: "导图" },
];

const activeTitle = computed(
  () => documents.tree.find((d) => d.id === documents.activeId)?.title ?? "文档",
);

const showToc = computed(
  () => ui.workspaceViewMode === "edit" && !!documents.activeId && !ui.focusMode,
);
const showSplitPreview = computed(
  () => ui.workspaceViewMode === "edit" && !!documents.activeId,
);
const showPreviewKind = computed(
  () => showSplitPreview.value && ui.splitPreviewVisible && !ui.focusMode,
);
const showTypewriter = computed(() => ui.workspaceViewMode === "edit");
const showChat = computed(
  () => ui.workspaceViewMode === "edit" && !ui.focusMode && chat.aiEnabled,
);
const showBacklinks = computed(
  () => ui.workspaceViewMode === "edit" && !ui.focusMode,
);

function toggleChatPanel() {
  ui.toggleChatPanel();
  if (ui.chatPanelVisible) {
    void chat.loadAiEnabled();
  }
}

const showExport = computed(
  () => ui.workspaceViewMode === "edit" && !!documents.activeId && !ui.focusMode,
);
function toggleSplitPreview() {
  if (ui.previewOnlyMode) {
    ui.setPreviewOnly(false);
    ui.setSplitPreview(true);
    return;
  }
  ui.toggleSplitPreview();
}

function togglePreviewOnly() {
  ui.togglePreviewOnly();
}

function insertModuleSnippetInDoc(snippet: string) {
  documents.updateContent(insertModuleSnippet(documents.content, snippet));
  void editor.saveNow();
}

function onSelectView(mode: WorkspaceViewMode) {
  if (mode === "graph" || mode === "mindmap") {
    ui.setSplitGraph(false);
  }
  ui.setWorkspaceView(mode);
  documents.persistSession();
}

function toggleSplitGraph() {
  ui.toggleSplitGraph();
  documents.persistSession();
}

const isPinned = computed(() =>
  documents.activeId ? documents.isPinned(documents.activeId) : false,
);
</script>

<template>
  <header
    class="flex min-h-[var(--toolbar-height)] shrink-0 items-center gap-1 border-b border-border px-2"
    data-testid="workspace-toolbar"
  >
    <BtnIcon
      v-if="!ui.focusMode"
      :label="ui.sidebarCollapsed ? '显示侧栏' : '隐藏侧栏'"
      :pressed="!ui.sidebarCollapsed"
      data-testid="toolbar-sidebar-toggle"
      @click="ui.toggleSidebarCollapsed()"
    >
      <PanelLeftOpen v-if="ui.sidebarCollapsed" class="h-3.5 w-3.5" aria-hidden="true" />
      <PanelLeftClose v-else class="h-3.5 w-3.5" aria-hidden="true" />
    </BtnIcon>

    <BtnIcon
      v-if="!ui.focusMode && documents.canGoBack"
      label="返回上一篇 (Alt+←)"
      data-testid="nav-back"
      @click="documents.navigateBack()"
    >
      <ArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
    </BtnIcon>

    <BtnIcon
      v-if="documents.activeId && !ui.focusMode"
      :label="isPinned ? '取消固定 (Alt+P)' : '固定文档 (Alt+P)'"
      :pressed="isPinned"
      data-testid="toggle-pin-toolbar"
      @click="documents.togglePin(documents.activeId!)"
    >
      <Star
        class="h-3.5 w-3.5"
        :class="isPinned ? 'fill-paw text-paw' : ''"
        aria-hidden="true"
      />
    </BtnIcon>

    <div
      v-if="!ui.focusMode"
      class="flex rounded-md bg-surface-1 p-0.5 text-xs"
      aria-label="知识库视图"
    >
      <button
        v-for="m in modes"
        :key="m.id"
        type="button"
        role="button"
        class="focus-ring rounded px-2.5 py-0.5 transition-colors"
        :class="ui.workspaceViewMode === m.id ? 'bg-surface-2 text-[var(--color-text)]' : 'text-muted hover:text-[var(--color-text)]'"
        :aria-pressed="ui.workspaceViewMode === m.id"
        @click="onSelectView(m.id)"
      >
        {{ m.label }}
      </button>
    </div>
    <span v-else class="text-xs text-paw">专注模式</span>

    <div
      v-if="!ui.focusMode && ui.workspaceViewMode === 'edit'"
      class="ml-1 flex shrink-0 items-center gap-1 border-l border-border pl-2"
      data-testid="toolbar-editor-tools"
    >
      <BtnIcon
        v-if="ui.workspaceViewMode === 'edit' && documents.activeId && !ui.focusMode"
        label="编辑+图谱分屏"
        :pressed="ui.splitGraphVisible"
        data-testid="toolbar-split-graph"
        @click="toggleSplitGraph()"
      >
        <Columns2 class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>

      <template v-if="ui.workspaceViewMode === 'edit'">
        <BtnIcon
          v-if="showToc"
          label="目录"
          :pressed="ui.tocVisible"
          data-testid="toolbar-toc"
          @click="ui.toggleToc()"
        >
          <List class="h-3.5 w-3.5" aria-hidden="true" />
        </BtnIcon>

          <BtnIcon
          v-if="showSplitPreview"
          label="分栏预览"
          :pressed="ui.splitPreviewVisible && !ui.previewOnlyMode"
          data-testid="toolbar-split-preview"
          @click="toggleSplitPreview()"
        >
          <Columns2 class="h-3.5 w-3.5" aria-hidden="true" />
        </BtnIcon>

        <BtnIcon
          v-if="showSplitPreview"
          label="全屏预览"
          :pressed="ui.previewOnlyMode"
          data-testid="toolbar-preview-only"
          @click="togglePreviewOnly()"
        >
          <Eye class="h-3.5 w-3.5" aria-hidden="true" />
        </BtnIcon>

        <div
          v-if="showPreviewKind"
          class="flex shrink-0 items-center gap-1.5"
          data-testid="toolbar-preview-cluster"
        >
          <div
            class="flex shrink-0 rounded-md bg-surface-1 p-0.5 text-xs"
            aria-label="预览类型"
          >
            <button
              type="button"
              class="focus-ring shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 transition-colors"
              :class="ui.splitPreviewKind === 'gfm' ? 'bg-surface-2 text-[var(--color-text)]' : 'text-muted hover:text-[var(--color-text)]'"
              :aria-pressed="ui.splitPreviewKind === 'gfm'"
              data-testid="toolbar-preview-kind-gfm"
              @click="ui.setSplitPreviewKind('gfm')"
            >
              阅读
            </button>
            <button
              type="button"
              class="focus-ring shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 transition-colors"
              :class="ui.splitPreviewKind === 'wechat' ? 'bg-surface-2 text-[var(--color-text)]' : 'text-muted hover:text-[var(--color-text)]'"
              :aria-pressed="ui.splitPreviewKind === 'wechat'"
              data-testid="toolbar-preview-kind-wechat"
              @click="ui.setSplitPreviewKind('wechat')"
            >
              公众号
            </button>
            <button
              type="button"
              class="focus-ring shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 transition-colors"
              :class="ui.splitPreviewKind === 'card' ? 'bg-surface-2 text-[var(--color-text)]' : 'text-muted hover:text-[var(--color-text)]'"
              :aria-pressed="ui.splitPreviewKind === 'card'"
              data-testid="toolbar-preview-kind-card"
              @click="ui.setSplitPreviewKind('card')"
            >
              知识卡片
            </button>
          </div>

          <WechatToolbarMenu
            :visible="ui.splitPreviewKind === 'wechat'"
            variant="toolbar"
            v-model:theme-id="wechatThemeId"
            :content="documents.content"
            @insert="insertModuleSnippetInDoc"
          />
        </div>
      </template>
    </div>

    <div class="ml-auto flex shrink-0 items-center gap-1">
      <BtnIcon
        v-if="ui.focusMode && ui.workspaceViewMode === 'edit' && documents.activeId"
        label="保存 (Ctrl+S)"
        data-testid="editor-save"
        :disabled="editor.isSaving"
        @click="editor.saveNow()"
      >
        <Save class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>

      <BtnIcon
        v-if="showTypewriter"
        label="打字机模式"
        :pressed="ui.typewriterMode"
        data-testid="toolbar-typewriter"
        @click="ui.toggleTypewriterMode()"
      >
        <Type class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>

      <BtnIcon
        label="专注模式"
        :pressed="ui.focusMode"
        data-testid="toolbar-focus"
        @click="ui.toggleFocusMode()"
      >
        <Focus class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>

      <BtnIcon
        v-if="showChat"
        label="AI 助手 (Ctrl+Shift+A)"
        :pressed="ui.chatPanelVisible"
        data-testid="toolbar-chat"
        @click="toggleChatPanel()"
      >
        <Bot class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>

      <BtnIcon
        v-if="showBacklinks"
        label="反向链接"
        :pressed="ui.backlinksVisible"
        data-testid="toolbar-backlinks"
        @click="ui.toggleBacklinksPanel()"
      >
        <Link2 class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>

      <div
        v-if="showExport"
        class="mx-0.5 h-4 w-px shrink-0 bg-border"
        aria-hidden="true"
      />

      <ExportMenu
        v-if="showExport"
        :title="activeTitle"
        :content="documents.content"
        :disabled="!documents.activeId"
      />

      <button
        v-if="ui.focusMode"
        type="button"
        role="button"
        class="focus-ring rounded-md px-2 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
        data-testid="exit-focus"
        @click="ui.toggleFocusMode()"
      >
        退出专注
      </button>
    </div>
  </header>
</template>
