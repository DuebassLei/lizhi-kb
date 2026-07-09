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
import DocumentToc from "./DocumentToc.vue";
import EditorFindReplace from "./EditorFindReplace.vue";
import MarkdownCodeEditor from "./MarkdownCodeEditor.vue";
import MarkdownPreview from "./MarkdownPreview.vue";
import WechatPreviewPanel from "../wechat/WechatPreviewPanel.vue";
import EmptyState from "../ui/EmptyState.vue";
import { useSplitPreviewResize } from "../../composables/useSplitPreviewResize";
import { useWechatTheme } from "../../composables/useWechatTheme";
import { getDocumentTags, setDocumentTags } from "../../utils/documentTags";
import { getTagPillClass } from "../../utils/tagColor";
import { PenLine, Tag } from "@lucide/vue";

const documents = useDocumentsStore();
const route = useRoute();
const editor = useEditorStore();
const ui = useUiStore();
const folders = useFoldersStore();
const links = useLinksStore();
const { themeId: wechatThemeId } = useWechatTheme();

const editingTitle = ref(false);
const titleDraft = ref("");
const cmRef = ref<InstanceType<typeof MarkdownCodeEditor> | null>(null);
const findReplaceRef = ref<InstanceType<typeof EditorFindReplace> | null>(null);
const splitContainerRef = ref<HTMLElement | null>(null);
const tagDraft = ref("");
const tagsTick = ref(0);

const docTags = computed(() => {
  void tagsTick.value;
  return documents.activeId ? getDocumentTags(documents.activeId) : [];
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

const headings = computed(() => extractHeadings(documents.content));

const showSplitPreview = computed(
  () => ui.workspaceViewMode === "edit" && ui.splitPreviewVisible,
);

const showWechatSplitPreview = computed(
  () => showSplitPreview.value && ui.splitPreviewKind === "wechat",
);

const { editorRatio, dragging: splitDragging, onResizeStart: onSplitResizeStart } =
  useSplitPreviewResize(splitContainerRef);

const editorPaneStyle = computed(() => ({
  width: `${editorRatio.value * 100}%`,
  flex: "0 0 auto",
}));

const { scheduleSave, flush, cancel } = useAutoSave({
  getContent: () => documents.content,
  getDocId: () => documents.activeId,
  debounceMs: 800,
  onSaved: (savedAt) => {
    if (documents.activeId) {
      documents.patchMeta(documents.activeId, { updatedAt: savedAt });
      links.updatePlainTextForDoc(documents.activeId, documents.content);
    }
  },
});

watch(
  () => documents.activeId,
  async (id, prev) => {
    editingTitle.value = false;
    if (prev && editor.isDirty) {
      await flush();
    }
    if (id) {
      const doc = documents.tree.find((d) => d.id === id);
      if (doc) {
        folders.revealFolder(folders.normalizeFolder(doc.folder));
      }
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
    await flush();
  });
  window.addEventListener("keydown", onFindShortcut);
});

onBeforeUnmount(() => {
  editor.unregisterSaveHandler();
  window.removeEventListener("keydown", onFindShortcut);
});

function onUpdate(value: string) {
  documents.updateContent(value);
  scheduleSave();
}

function onWordCount(count: number) {
  editor.wordCount = count;
}

function startEditTitle() {
  titleDraft.value = activeTitle.value;
  editingTitle.value = true;
}

async function commitTitle() {
  editingTitle.value = false;
  if (!documents.activeId || titleDraft.value.trim() === activeTitle.value) return;

  cancel();
  if (editor.isDirty) {
    await flush();
  }
  await documents.renameTitle(documents.activeId, titleDraft.value);
}

function onTocSelect(text: string) {
  void scrollToHeading(text);
}

async function scrollToHeading(text: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const ok = scrollToDocumentHeading(text, {
      content: documents.content,
      splitPreviewVisible: ui.splitPreviewVisible,
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

const cmView = computed(() => {
  const exposed = cmRef.value as { editorView?: import("@codemirror/view").EditorView | null } | null;
  return exposed?.editorView ?? null;
});

function addTag() {
  if (!documents.activeId) return;
  const tag = tagDraft.value.trim();
  if (!tag) return;
  const next = [...docTags.value, tag];
  setDocumentTags(documents.activeId, next);
  tagDraft.value = "";
  tagsTick.value++;
}

function removeTag(tag: string) {
  if (!documents.activeId) return;
  setDocumentTags(
    documents.activeId,
    docTags.value.filter((t) => t !== tag),
  );
  tagsTick.value++;
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
        <span>工作区</span>
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

      <div class="flex items-center gap-2">
        <input
          v-if="editingTitle"
          v-model="titleDraft"
          type="text"
          class="field-input focus-ring w-full rounded-md border border-border bg-surface-1 px-3 py-1 text-[2rem] font-semibold leading-tight"
          data-testid="title-input"
          aria-label="文档标题"
          @keydown.enter="commitTitle"
          @blur="commitTitle"
        />
        <h1
          v-else
          class="cursor-text text-[2rem] font-semibold leading-tight tracking-tight text-[var(--color-text)]"
          data-testid="doc-title"
          @click="startEditTitle"
        >
          {{ activeTitle }}
        </h1>
      </div>

      <div
        v-if="docTags.length || tagDraft !== undefined"
        class="doc-tags-row mt-3 flex items-center gap-2"
        data-testid="doc-tags-row"
      >
        <Tag :size="14" class="shrink-0 text-muted" aria-hidden="true" />
        <div
          v-if="docTags.length"
          class="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
          data-testid="doc-tags-list"
        >
          <span
            v-for="tag in docTags"
            :key="tag"
            :class="[getTagPillClass(tag), 'shrink-0']"
          >
            {{ tag }}
            <button
              type="button"
              class="doc-tag-pill__remove focus-ring rounded-sm leading-none"
              :aria-label="`移除标签 ${tag}`"
              @click="removeTag(tag)"
            >
              ×
            </button>
          </span>
        </div>
        <input
          v-model="tagDraft"
          type="text"
          placeholder="添加标签，回车确认"
          class="doc-tag-input focus-ring shrink-0 rounded-full border border-dashed border-border bg-transparent px-2 py-0.5 text-[11px] outline-none"
          :class="docTags.length ? 'w-[9.5rem]' : 'min-w-0 flex-1'"
          data-testid="doc-tag-input"
          @keydown.enter.prevent="addTag"
        />
      </div>
    </header>

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
              :model-value="documents.content"
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
              v-if="!showWechatSplitPreview"
              :key="`split-preview-${documents.activeId}`"
              :content="documents.content"
              :typewriter="ui.typewriterMode"
              class="h-full min-h-0"
            />
            <WechatPreviewPanel
              v-else
              :key="`wechat-split-preview-${documents.activeId}`"
              :content="documents.content"
              :theme-id="wechatThemeId"
              embedded
              class="h-full min-h-0"
            />
          </div>
        </div>

        <div
          v-else
          class="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <EditorFindReplace ref="findReplaceRef" :view="cmView" />
          <MarkdownCodeEditor
            ref="cmRef"
            :key="documents.activeId!"
            :model-value="documents.content"
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
        :headings="headings"
        @select="onTocSelect"
      />
    </div>
  </div>
</template>
