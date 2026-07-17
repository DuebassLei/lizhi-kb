<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useAutoSave } from "../../composables/useAutoSave";
import { useDocumentsStore } from "../../stores/documents";
import { useEditorStore } from "../../stores/editor";
import { useFoldersStore } from "../../stores/folders";
import { useLinksStore } from "../../stores/links";
import { useUiStore } from "../../stores/ui";
import { extractHeadings } from "../../utils/headings";
import { scrollToDocumentHeading } from "../../utils/scrollToHeading";
import { scrollToFolderRow } from "../../utils/folderScroll";
import { useHeadingTree } from "../../composables/useHeadingTree";
import DocumentToc from "./DocumentToc.vue";
import RevisionHistoryPanel from "./RevisionHistoryPanel.vue";
import EditorFindReplace from "./EditorFindReplace.vue";
import MarkdownCodeEditor from "./MarkdownCodeEditor.vue";
import MarkdownPreview from "./MarkdownPreview.vue";
import WechatPreviewPanel from "../wechat/WechatPreviewPanel.vue";
import KnowledgeCardPreviewPanel from "../knowledgeCards/KnowledgeCardPreviewPanel.vue";
import EmptyState from "../ui/EmptyState.vue";
import { useSplitPreviewResize } from "../../composables/useSplitPreviewResize";
import { useEditorPreviewScrollSync } from "../../composables/useEditorPreviewScrollSync";
import { useWechatTheme } from "../../composables/useWechatTheme";
import { insertModuleSnippet } from "../../services/wechatExport";
import { appendToMarkdownContent } from "../../utils/editorContentInsert";
import { insertAtCursor } from "../../utils/markdownInsert";
import {
  ignorePrivacyScan,
  isPrivacyScanIgnored,
  privacyScanFingerprint,
  scanSuspectedSecrets,
  wrapPrivacyHits,
  type PrivacyScanHit,
} from "../../utils/aiPrivacyScan";
import AiPrivacyScanBanner from "./AiPrivacyScanBanner.vue";
import EditorPerfHud from "./EditorPerfHud.vue";
import { PenLine } from "@lucide/vue";
import { editorPerfMark, editorPerfMeasure, runWhenIdle } from "../../utils/editorPerf";

const isDev = import.meta.env.DEV;

/** 打字期内容先留在 draft，短 debounce 再写 Pinia，减轻每键响应式风暴 */
const PINIA_CONTENT_SYNC_MS = 120;

const documents = useDocumentsStore();
const route = useRoute();
const editor = useEditorStore();
const ui = useUiStore();
const folders = useFoldersStore();
const links = useLinksStore();
const { themeId: wechatThemeId } = useWechatTheme();

/** 编辑缓冲：CM / 预览读这里；Pinia 延迟对齐 */
const draftContent = ref(documents.content);
let piniaSyncTimer: ReturnType<typeof setTimeout> | null = null;

function flushDraftToStore() {
  if (piniaSyncTimer) {
    clearTimeout(piniaSyncTimer);
    piniaSyncTimer = null;
  }
  if (documents.content !== draftContent.value) {
    documents.updateContent(draftContent.value);
  }
}

function schedulePiniaSync() {
  if (piniaSyncTimer) clearTimeout(piniaSyncTimer);
  piniaSyncTimer = setTimeout(() => {
    piniaSyncTimer = null;
    if (documents.content === draftContent.value) return;
    editorPerfMark("editor:content-update-start");
    documents.updateContent(draftContent.value);
    editorPerfMark("editor:content-update-end");
    editorPerfMeasure(
      "editor:content-update",
      "editor:content-update-start",
      "editor:content-update-end",
    );
  }, PINIA_CONTENT_SYNC_MS);
}

watch(
  () => documents.content,
  (content) => {
    if (content !== draftContent.value) draftContent.value = content;
  },
);

const privacyScanHits = ref<PrivacyScanHit[]>([]);
const showPrivacyScanBanner = computed(
  () =>
    Boolean(documents.activeId) &&
    privacyScanHits.value.length > 0 &&
    !documents.isAiExcluded(documents.activeId!),
);

function evaluatePrivacyScan(content: string, docId: string | null) {
  if (!docId || documents.isAiExcluded(docId)) {
    privacyScanHits.value = [];
    return;
  }
  const hits = scanSuspectedSecrets(content);
  if (!hits.length) {
    privacyScanHits.value = [];
    return;
  }
  const fp = privacyScanFingerprint(hits);
  if (isPrivacyScanIgnored(docId, fp)) {
    privacyScanHits.value = [];
    return;
  }
  privacyScanHits.value = hits;
}

async function onPrivacyScanWrap() {
  const id = documents.activeId;
  if (!id || !privacyScanHits.value.length) return;
  const hitsSnapshot = [...privacyScanHits.value];
  flushDraftToStore();
  const prevContent = documents.content;
  const next = wrapPrivacyHits(prevContent, hitsSnapshot);
  documents.updateContent(next);
  draftContent.value = next;
  privacyScanHits.value = [];
  editor.clearSaveError();
  await editor.saveNow();
  if (editor.saveError) {
    documents.updateContent(prevContent);
    privacyScanHits.value = hitsSnapshot;
    ui.showToast("error", `${editor.saveError}，已恢复原文`);
    return;
  }
  ui.showToast("success", "已包进隐藏信息围栏");
}

async function onPrivacyScanExclude() {
  const id = documents.activeId;
  if (!id) return;
  try {
    await documents.toggleAiExclude(id);
    privacyScanHits.value = [];
    ui.showToast("success", "已禁止本篇喂给 AI");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "设置失败");
  }
}

function onPrivacyScanIgnore() {
  const id = documents.activeId;
  if (!id || !privacyScanHits.value.length) return;
  ignorePrivacyScan(id, privacyScanFingerprint(privacyScanHits.value));
  privacyScanHits.value = [];
}

function insertWechatModuleSnippet(snippet: string) {
  flushDraftToStore();
  const next = insertModuleSnippet(draftContent.value, snippet);
  draftContent.value = next;
  documents.updateContent(next);
  void editor.saveNow();
}

const editingTitle = ref(false);
const titleDraft = ref("");
const titleInputRef = ref<HTMLInputElement | null>(null);
const cmRef = ref<InstanceType<typeof MarkdownCodeEditor> | null>(null);
const findReplaceRef = ref<InstanceType<typeof EditorFindReplace> | null>(null);
const splitContainerRef = ref<HTMLElement | null>(null);
const gfmPreviewCmp = ref<{ containerRef: HTMLElement | null } | null>(null);
const wechatPreviewCmp = ref<{ containerRef: HTMLElement | null } | null>(null);
const cardPreviewCmp = ref<{ containerRef: HTMLElement | null } | null>(null);
const previewRef = computed(() => {
  if (ui.splitPreviewKind === "wechat") {
    return wechatPreviewCmp.value?.containerRef ?? null;
  }
  if (ui.splitPreviewKind === "card") {
    return cardPreviewCmp.value?.containerRef ?? null;
  }
  return gfmPreviewCmp.value?.containerRef ?? null;
});

const activeTitle = computed(
  () => documents.tree.find((d) => d.id === documents.activeId)?.title ?? "无标题",
);

const breadcrumbFolders = computed(() => {
  const doc = documents.tree.find((d) => d.id === documents.activeId);
  if (!doc) return [];
  const folderId = folders.normalizeFolder(doc.folder);
  return folders.pathSegments(folderId);
});

function selectBreadcrumbFolder(folderId: string) {
  folders.revealFolder(folderId);
  scrollToFolderRow(folderId);
}

const { tree: headingTree, refreshImmediate: refreshHeadingTree } = useHeadingTree({
  title: () => activeTitle.value,
  content: () => draftContent.value,
  debounceMs: 280,
});

watch(
  () => documents.activeId,
  () => refreshHeadingTree(),
);

const showSplitPreview = computed(
  () => ui.workspaceViewMode === "edit" && ui.splitPreviewVisible && !ui.previewOnlyMode,
);

const showPreviewOnly = computed(
  () => ui.workspaceViewMode === "edit" && ui.previewOnlyMode,
);

const showWechatPreview = computed(() => ui.splitPreviewKind === "wechat");
const showCardPreview = computed(() => ui.splitPreviewKind === "card");
const showWechatSplitPreview = computed(
  () => showSplitPreview.value && showWechatPreview.value,
);
const showGfmSplitPreview = computed(
  () => showSplitPreview.value && !showWechatPreview.value && !showCardPreview.value,
);

const { editorRatio, dragging: splitDragging, onResizeStart: onSplitResizeStart } =
  useSplitPreviewResize(splitContainerRef);

const editorPaneStyle = computed(() => ({
  width: `${editorRatio.value * 100}%`,
  flex: "0 0 auto",
}));

const { scheduleSave, flush, cancel } = useAutoSave({
  getContent: () => draftContent.value,
  getDocId: () => documents.activeId,
  debounceMs: 1200,
  onSaved: (savedAt) => {
    flushDraftToStore();
    if (!documents.activeId) return;
    const id = documents.activeId;
    const content = draftContent.value;
    documents.patchMeta(id, { updatedAt: savedAt });
    runWhenIdle(() => {
      if (documents.activeId !== id) return;
      void links.updatePlainTextForDoc(id, content);
      evaluatePrivacyScan(content, id);
    });
  },
  onError: (error) => {
    const message = error instanceof Error ? error.message : "自动保存失败";
    ui.showToast("error", `${message}，请检查网络或稍后重试`);
  },
});

watch(
  () => documents.activeId,
  async (id, prev) => {
    editingTitle.value = false;
    privacyScanHits.value = [];
    if (prev && editor.isDirty) {
      flushDraftToStore();
      await flush();
    }
    draftContent.value = documents.content;
    if (id) {
      const doc = documents.tree.find((d) => d.id === id);
      if (doc) {
        folders.revealFolder(folders.normalizeFolder(doc.folder));
      }
      await nextTick();
      evaluatePrivacyScan(draftContent.value, id);
    }
  },
);

watch(
  () => documents.loading,
  (loading) => {
    if (!loading && documents.activeId) {
      draftContent.value = documents.content;
      evaluatePrivacyScan(draftContent.value, documents.activeId);
    }
  },
);

function onFindShortcut(e: KeyboardEvent) {
  if (route.path !== "/workspace" || !documents.activeId) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
    e.preventDefault();
    findReplaceRef.value?.toggle();
  }
}

onMounted(() => {
  editor.registerSaveHandler(async () => {
    flushDraftToStore();
    await flush();
  });
  window.addEventListener("keydown", onFindShortcut);
});

onBeforeUnmount(() => {
  if (piniaSyncTimer) clearTimeout(piniaSyncTimer);
  flushDraftToStore();
  editor.unregisterSaveHandler();
  window.removeEventListener("keydown", onFindShortcut);
});

function onUpdate(value: string) {
  draftContent.value = value;
  schedulePiniaSync();
  scheduleSave();
}

function onWordCount(count: number) {
  editor.wordCount = count;
}

async function startEditTitle() {
  titleDraft.value = activeTitle.value;
  editingTitle.value = true;
  await nextTick();
  const el = titleInputRef.value;
  if (!el) return;
  el.focus();
  el.select();
}

function cancelTitleEdit() {
  editingTitle.value = false;
  titleDraft.value = activeTitle.value;
}

async function commitTitle() {
  if (!editingTitle.value) return;
  editingTitle.value = false;
  const next = titleDraft.value.replace(/\s+/g, " ").trim();
  if (!documents.activeId || !next || next === activeTitle.value) {
    titleDraft.value = activeTitle.value;
    return;
  }

  cancel();
  if (editor.isDirty) {
    flushDraftToStore();
    await flush();
  }
  await documents.renameTitle(documents.activeId, next);
}

function onTocSelect(payload: { text: string; lineIndex: number }) {
  const occurrence = extractHeadings(draftContent.value).filter(
    (h) => h.text === payload.text && h.lineIndex < payload.lineIndex,
  ).length;
  void scrollToHeading(payload.text, payload.lineIndex, occurrence);
}

async function scrollToHeading(text: string, lineIndex?: number, occurrence = 0) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const ok = scrollToDocumentHeading({
      headingText: text,
      lineIndex,
      occurrence,
      content: draftContent.value,
      scrollEditorLine: (line) => cmRef.value?.scrollToLine(line),
      splitPreviewVisible: ui.splitPreviewVisible || ui.previewOnlyMode,
      splitPreviewKind: ui.splitPreviewKind,
    });
    if (ok) return;
  }
}

watch(
  () =>
    [ui.pendingHeadingScroll, documents.activeId, ui.splitPreviewVisible, ui.splitPreviewKind] as const,
  ([text]) => {
    if (!text || !documents.activeId) return;
    void scrollToHeading(text).finally(() => ui.clearHeadingScroll());
  },
);

watch(
  () => [ui.pendingLineScroll, documents.activeId] as const,
  ([line]) => {
    if (line == null || !documents.activeId) return;
    void scrollToHeading("", line, 0).finally(() => ui.clearLineScroll());
  },
);

const cmView = computed(() => {
  const exposed = cmRef.value as { editorView?: import("@codemirror/view").EditorView | null } | null;
  return exposed?.editorView ?? null;
});

function insertEditorSnippet(snippet: string) {
  const view = cmView.value;
  if (view) {
    insertAtCursor(view, snippet);
    const next = view.state.doc.toString();
    draftContent.value = next;
    documents.updateContent(next);
  } else {
    flushDraftToStore();
    const next = appendToMarkdownContent(draftContent.value, snippet);
    draftContent.value = next;
    documents.updateContent(next);
  }
  void editor.saveNow();
}

watch(
  () => ui.pendingEditorInsert,
  (md) => {
    if (!md) return;
    const view = cmView.value;
    if (view && documents.activeId) {
      insertAtCursor(view, md.endsWith("\n") ? md : `${md}\n`);
      draftContent.value = view.state.doc.toString();
      flushDraftToStore();
      void editor.saveNow();
      ui.showToast("success", "已插入到光标位置");
    } else if (documents.activeId) {
      flushDraftToStore();
      const next = appendToMarkdownContent(draftContent.value, md);
      draftContent.value = next;
      documents.updateContent(next);
      void editor.saveNow();
      ui.showToast("success", "已追加到文档末尾");
    } else {
      ui.showToast("error", "请先打开一篇文档");
    }
    ui.clearEditorInsert();
  },
);

const scrollSyncEnabled = computed(() => showSplitPreview.value);
const scrollSyncContent = computed(() => draftContent.value);

useEditorPreviewScrollSync(cmView, previewRef, scrollSyncEnabled, scrollSyncContent);

async function retrySave() {
  editor.clearSaveError();
  await flush();
}
</script>

<template>
  <div class="flex h-full flex-col bg-canvas">
    <header
      v-if="documents.activeId && !ui.focusMode"
      class="shrink-0 px-6 py-4 sm:px-10 lg:px-16"
    >
      <nav
        class="mb-2 text-xs text-muted"
        aria-label="面包屑"
        data-testid="doc-breadcrumb"
      >
        <span>知识库</span>
        <template v-for="seg in breadcrumbFolders" :key="seg.id">
          <span class="mx-1 text-border-strong">/</span>
          <button
            type="button"
            class="focus-ring rounded px-0.5 transition-colors hover:text-link"
            :class="folders.selectedFolderId === seg.id ? 'text-link' : 'text-text-secondary'"
            @click="selectBreadcrumbFolder(seg.id)"
          >
            {{ seg.label }}
          </button>
        </template>
        <span class="mx-1 text-border-strong">/</span>
        <span class="text-text-secondary">{{ activeTitle }}</span>
      </nav>

      <div class="doc-title-row flex min-w-0 items-center gap-3">
        <input
          v-if="editingTitle"
          ref="titleInputRef"
          v-model="titleDraft"
          type="text"
          class="doc-title-field doc-title-field--editing"
          data-testid="title-input"
          aria-label="文档标题"
          spellcheck="false"
          @keydown.enter.prevent="commitTitle"
          @keydown.escape.prevent="cancelTitleEdit"
          @blur="commitTitle"
        />
        <h1
          v-else
          class="doc-title-field doc-title-field--view"
          data-testid="doc-title"
          title="点击编辑标题"
          @click="startEditTitle"
        >
          {{ activeTitle }}
        </h1>
        <div class="shrink-0">
          <RevisionHistoryPanel :doc-id="documents.activeId" />
        </div>
      </div>
    </header>

    <div
      v-if="editor.saveError && documents.activeId"
      class="mx-6 mb-2 flex items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger sm:mx-10 lg:mx-16"
      role="alert"
      data-testid="autosave-error-banner"
    >
      <span>自动保存失败：{{ editor.saveError }}</span>
      <button
        type="button"
        class="focus-ring shrink-0 rounded-md border border-danger/40 px-2 py-1 text-[11px] font-medium hover:bg-danger/10"
        data-testid="autosave-retry"
        @click="retrySave"
      >
        重试
      </button>
    </div>

    <AiPrivacyScanBanner
      v-if="showPrivacyScanBanner"
      :hit-count="privacyScanHits.length"
      @wrap="onPrivacyScanWrap"
      @exclude="onPrivacyScanExclude"
      @ignore="onPrivacyScanIgnore"
    />

    <div
      v-if="documents.loading"
      class="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted"
      role="status"
      aria-live="polite"
    >
      <span
        class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-link"
        aria-hidden="true"
      />
      加载中…
    </div>

    <div
      v-else-if="documents.error && documents.activeId"
      class="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
      role="alert"
    >
      <div
        class="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 text-2xl text-danger"
      >
        !
      </div>
      <div class="space-y-1">
        <p class="text-sm font-medium text-[var(--color-text)]">文档加载失败</p>
        <p class="max-w-sm text-xs text-muted">{{ documents.error }}</p>
      </div>
      <button
        type="button"
        class="focus-ring btn-secondary rounded-lg px-4 py-2 text-sm"
        @click="documents.loadContent(documents.activeId!)"
      >
        重试
      </button>
    </div>

    <div v-else-if="!documents.activeId" class="flex flex-1 items-center justify-center">
      <EmptyState title="选择或创建文档" description="从左侧栏打开文档，或点击「新建文档」开始写作">
        <template #icon>
          <PenLine :size="24" aria-hidden="true" />
        </template>
        <template #action>
          <button
            type="button"
            data-testid="new-doc-empty"
            class="focus-ring btn-primary !h-auto !px-4 !py-2"
            @click="documents.create()"
          >
            新建文档
          </button>
        </template>
      </EmptyState>
    </div>

    <div v-else class="flex min-h-0 flex-1 bg-canvas">
      <template v-if="ui.workspaceViewMode === 'edit'">
        <div
          v-if="showSplitPreview"
          ref="splitContainerRef"
          class="relative flex min-h-0 min-w-0 flex-1"
          data-testid="split-editor-preview"
        >
          <div
            class="flex min-h-0 min-w-0 flex-col"
            :style="editorPaneStyle"
          >
            <EditorFindReplace ref="findReplaceRef" :view="cmView" />
            <MarkdownCodeEditor
              ref="cmRef"
              :key="documents.activeId!"
              :model-value="draftContent"
              class="min-h-0 flex-1"
              compact
              :typewriter="ui.typewriterMode && !showSplitPreview"
              :show-toolbar="!ui.focusMode"
              @update:model-value="onUpdate"
              @word-count="onWordCount"
            />
          </div>

          <div
            class="split-preview-resize-handle"
            :class="{ 'split-preview-resize-handle--active': splitDragging }"
            role="separator"
            aria-orientation="vertical"
            aria-label="调整编辑区与预览区宽度"
            aria-valuemin="32"
            aria-valuemax="78"
            :aria-valuenow="Math.round(editorRatio * 100)"
            data-testid="split-preview-resize-handle"
            @pointerdown="onSplitResizeStart"
          />

          <div
            class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-canvas"
            data-testid="split-preview-pane"
          >
            <MarkdownPreview
              v-if="showGfmSplitPreview"
              :key="`split-preview-${documents.activeId}`"
              ref="gfmPreviewCmp"
              :content="draftContent"
              :typewriter="ui.typewriterMode"
              class="h-full min-h-0"
            />
            <WechatPreviewPanel
              v-else-if="showWechatSplitPreview"
              :key="`wechat-split-preview-${documents.activeId}`"
              ref="wechatPreviewCmp"
              v-model:theme-id="wechatThemeId"
              :content="draftContent"
              embedded
              :show-toolbar="true"
              class="h-full min-h-0"
              @insert="insertWechatModuleSnippet"
            />
            <KnowledgeCardPreviewPanel
              v-else
              :key="`card-split-preview-${documents.activeId}`"
              ref="cardPreviewCmp"
              :content="draftContent"
              embedded
              class="h-full min-h-0"
              @insert="insertEditorSnippet"
            />
          </div>
        </div>

        <div
          v-else-if="showPreviewOnly"
          class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          data-testid="preview-only-pane"
        >
          <MarkdownPreview
            v-if="!showWechatPreview && !showCardPreview"
            :key="`preview-only-${documents.activeId}`"
            ref="gfmPreviewCmp"
            :content="draftContent"
            :typewriter="ui.typewriterMode"
            class="h-full min-h-0"
          />
          <WechatPreviewPanel
            v-else-if="showWechatPreview"
            :key="`wechat-preview-only-${documents.activeId}`"
            ref="wechatPreviewCmp"
            v-model:theme-id="wechatThemeId"
            :content="draftContent"
            embedded
            :show-toolbar="true"
            class="h-full min-h-0"
            @insert="insertWechatModuleSnippet"
          />
          <KnowledgeCardPreviewPanel
            v-else
            :key="`card-preview-only-${documents.activeId}`"
            ref="cardPreviewCmp"
            :content="draftContent"
            embedded
            class="h-full min-h-0"
            @insert="insertEditorSnippet"
          />
        </div>

        <div
          v-else
          class="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <EditorFindReplace ref="findReplaceRef" :view="cmView" />
          <MarkdownCodeEditor
            ref="cmRef"
            :key="documents.activeId!"
            :model-value="draftContent"
            class="min-h-0 flex-1"
            :typewriter="ui.typewriterMode"
            :show-toolbar="!ui.focusMode"
            @update:model-value="onUpdate"
            @word-count="onWordCount"
          />
        </div>
      </template>

      <DocumentToc
        v-if="ui.tocVisible && ui.workspaceViewMode === 'edit' && !ui.focusMode"
        :key="documents.activeId ?? 'none'"
        :tree="headingTree"
        @select="onTocSelect"
      />
    </div>

    <EditorPerfHud v-if="isDev && documents.activeId" />
  </div>
</template>
