<script setup lang="ts">
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Inbox,
  Library,
  Lock,
  Star,
  Trash2,
  XCircle,
} from "@lucide/vue";
import { computed } from "vue";
import type { FolderTreeNode as FolderNode } from "../../types/folder";
import { FOLDER_INBOX, FOLDER_PROJECTS } from "../../types/folder";
import {
  docRowPadding,
  folderRowPadding,
  TREE_CHILD_GUIDE_PX,
} from "../../constants/folderTree";
import { useDocumentsStore } from "../../stores/documents";
import { useFoldersStore } from "../../stores/folders";
import { useFolderContextMenu } from "../../composables/useFolderContextMenu";
import { canDeleteFolder } from "../../utils/folderHelpers";
import { isExternalFileDrag } from "../../utils/importMarkdown";
import { useUiStore } from "../../stores/ui";
import { useDocumentDelete } from "../../composables/useDocumentDelete";

const props = defineProps<{
  node: FolderNode;
}>();

const emit = defineEmits<{
  reorder: [folderId: string, docId: string, beforeDocId: string | null];
}>();

const documents = useDocumentsStore();
const folders = useFoldersStore();
const ui = useUiStore();
const { showFolderMenu, showDocMenu } = useFolderContextMenu();
const { requestDelete, requestPurge } = useDocumentDelete();

const DRAG_DOC_MIME = "application/x-lizhi-doc";
const DRAG_FOLDER_MIME = "application/x-lizhi-folder";

const isOpen = computed(() => folders.isExpanded(props.node.id));
const hasActiveDoc = computed(() =>
  props.node.documents.some((d) => documents.activeId === d.id),
);
/** 当前目录内有打开文档时，高亮让给文档行，避免父子双高亮 */
const isSelected = computed(
  () => folders.selectedFolderId === props.node.id && !hasActiveDoc.value,
);
const isCustomFolder = computed(() => canDeleteFolder(props.node.id, folders.folders));
const hasContent = computed(
  () => props.node.documents.length > 0 || props.node.children.length > 0,
);
const isEmpty = computed(
  () => isOpen.value && !props.node.documents.length && !props.node.children.length,
);

const folderDragTarget = computed(() =>
  folders.dragTarget?.kind === "folder" && folders.dragTarget.id === props.node.id
    ? folders.dragTarget
    : null,
);

const indentStyle = computed(() => ({
  paddingLeft: `${folderRowPadding(props.node.depth)}px`,
}));

const docIndentStyle = computed(() => ({
  paddingLeft: `${docRowPadding(props.node.depth + 1)}px`,
}));

function isHalfAfter(e: DragEvent, el: EventTarget | null): boolean {
  const target = el as HTMLElement | null;
  if (!target) return false;
  const rect = target.getBoundingClientRect();
  return e.clientY > rect.top + rect.height / 2;
}

function toggle() {
  folders.toggleExpanded(props.node.id);
}

function selectFolder() {
  folders.selectFolder(props.node.id);
}

function onDocDragStart(e: DragEvent, docId: string) {
  e.stopPropagation();
  e.dataTransfer?.setData(DRAG_DOC_MIME, docId);
  e.dataTransfer!.effectAllowed = "move";
  folders.draggingDocId = docId;
}

function onFolderDragStart(e: DragEvent) {
  if (!isCustomFolder.value) {
    e.preventDefault();
    return;
  }
  e.stopPropagation();
  e.dataTransfer?.setData(DRAG_FOLDER_MIME, props.node.id);
  e.dataTransfer!.effectAllowed = "move";
  folders.draggingFolderId = props.node.id;
}

function onDragEnd() {
  folders.clearDragState();
}

function onFolderDragOver(e: DragEvent) {
  if (isExternalFileDrag(e)) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = "copy";
    folders.setDragTarget({ kind: "folder", id: props.node.id, position: "into" });
    return;
  }

  if (!e.dataTransfer?.types.includes(DRAG_FOLDER_MIME)) return;
  e.preventDefault();
  e.stopPropagation();

  const draggedId = folders.draggingFolderId;
  if (!draggedId || !folders.isFolderDragTargetValid(draggedId, props.node.id)) {
    e.dataTransfer.dropEffect = "none";
    return;
  }

  e.dataTransfer.dropEffect = "move";
  const ratio = (() => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return (e.clientY - rect.top) / rect.height;
  })();
  const position = folders.resolveFolderDropPosition(draggedId, props.node.id, ratio);
  folders.setDragTarget({ kind: "folder", id: props.node.id, position });
}

function onFolderDragLeave(e: DragEvent) {
  const related = e.relatedTarget as Node | null;
  if (related && (e.currentTarget as HTMLElement).contains(related)) return;
  if (folders.dragTarget?.kind === "folder" && folders.dragTarget.id === props.node.id) {
    folders.setDragTarget(null);
  }
}

async function handleFolderDrop(draggedFolderId: string) {
  const position = folders.dragTarget?.position ?? "into";

  if (position === "before" || position === "after") {
    const targetParentId = props.node.parentId;
    if (!targetParentId) return;

    const beforeId = folders.resolveSiblingDropBeforeId(props.node.id, position);
    const dragged = folders.folders.find((f) => f.id === draggedFolderId);
    if (!dragged) return;

    let folderIdToOrder = draggedFolderId;

    if (dragged.parentId !== targetParentId) {
      const result = folders.reparentFolder(draggedFolderId, targetParentId);
      if (!result) return;
      await documents.migrateFolderPrefix(result.oldId, result.newId);
      folderIdToOrder = result.newId;
    }

    folders.reorderFolderSiblingInTree(targetParentId, folderIdToOrder, beforeId);
    return;
  }

  if (!folders.isFolderDragTargetValid(draggedFolderId, props.node.id)) return;

  const dragged = folders.folders.find((f) => f.id === draggedFolderId);
  if (!dragged) return;

  if (dragged.parentId === props.node.id) {
    folders.reorderFolderSiblingInTree(props.node.id, draggedFolderId, null);
    return;
  }

  const result = folders.reparentFolder(draggedFolderId, props.node.id);
  if (result) {
    await documents.migrateFolderPrefix(result.oldId, result.newId);
  }
}

async function handleExternalFileDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  folders.clearDragState();

  const files = e.dataTransfer?.files;
  if (!files?.length) return;

  try {
    const imported = await documents.importMarkdownFiles(Array.from(files), props.node.id);
    const count = imported.length;
    ui.showToast(
      "success",
      count === 1 ? `已导入「${imported[0].title}」到「${props.node.label}」` : `已导入 ${count} 篇文档到「${props.node.label}」`,
    );
  } catch (err) {
    ui.showToast("error", err instanceof Error ? err.message : "导入失败");
  }
}

async function onFolderDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();

  if (e.dataTransfer?.files?.length) {
    await handleExternalFileDrop(e);
    return;
  }

  const draggedFolderId = e.dataTransfer?.getData(DRAG_FOLDER_MIME);
  if (draggedFolderId) {
    await handleFolderDrop(draggedFolderId);
    folders.clearDragState();
    return;
  }

  const docId = e.dataTransfer?.getData(DRAG_DOC_MIME);
  folders.clearDragState();
  if (!docId) return;
  await documents.moveToFolder(docId, props.node.id);
}

function docDropTarget(docId: string) {
  return folders.dragTarget?.kind === "doc" && folders.dragTarget.id === docId
    ? folders.dragTarget
    : null;
}

function resolveDocDropBeforeId(docId: string, position: "before" | "after"): string | null {
  const docs = props.node.documents;
  const idx = docs.findIndex((d) => d.id === docId);
  if (idx < 0) return null;
  if (position === "before") return docId;
  return idx < docs.length - 1 ? docs[idx + 1].id : null;
}

function onDocDragOver(e: DragEvent, targetDocId: string) {
  if (isExternalFileDrag(e)) {
    onFolderDragOver(e);
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer!.dropEffect = "move";
  const position = isHalfAfter(e, e.currentTarget) ? "after" : "before";
  folders.setDragTarget({ kind: "doc", id: targetDocId, position });
}

function onDocDragLeave(e: DragEvent) {
  const related = e.relatedTarget as Node | null;
  if (related && (e.currentTarget as HTMLElement).contains(related)) return;
  if (folders.dragTarget?.kind === "doc" && folders.dragTarget.id === props.node.id) {
    folders.setDragTarget(null);
  }
}

async function onDocDrop(e: DragEvent, targetDocId: string) {
  e.preventDefault();
  e.stopPropagation();

  if (e.dataTransfer?.files?.length) {
    await handleExternalFileDrop(e);
    return;
  }

  const docId = e.dataTransfer?.getData(DRAG_DOC_MIME);
  const position =
    folders.dragTarget?.kind === "doc" && folders.dragTarget.id === targetDocId
      ? folders.dragTarget.position
      : "before";
  folders.clearDragState();

  if (!docId || docId === targetDocId) return;

  const dropPosition = position === "after" ? "after" : "before";
  const beforeDocId = resolveDocDropBeforeId(targetDocId, dropPosition);
  const targetFolder = props.node.id;
  const doc = documents.tree.find((d) => d.id === docId);
  if (doc && doc.folder !== targetFolder) {
    await documents.moveToFolder(docId, targetFolder);
  }
  emit("reorder", targetFolder, docId, beforeDocId);
}

function onDocListDragOver(e: DragEvent) {
  if (isExternalFileDrag(e)) {
    onFolderDragOver(e);
    return;
  }
  e.preventDefault();
}

async function onDocListDrop(e: DragEvent) {
  if (e.dataTransfer?.files?.length) {
    await handleExternalFileDrop(e);
    return;
  }
  e.preventDefault();
  onFolderDrop(e);
}

function openDoc(docId: string) {
  documents.setActive(docId);
}

function onDocKeydown(e: KeyboardEvent, docId: string) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openDoc(docId);
  }
}
</script>

<template>
  <div class="folder-node" :data-folder-id="node.id">
    <div
      class="group relative flex items-center gap-0.5 rounded-md py-1 pr-1.5 tree-row-hover"
      :class="[
        isSelected ? 'tree-row-selected' : '',
        folderDragTarget?.position === 'into' ? 'bg-paw/10 ring-1 ring-paw/35' : '',
      ]"
      :style="indentStyle"
      :draggable="isCustomFolder"
      data-testid="folder-row"
      @dragstart="onFolderDragStart"
      @dragend="onDragEnd"
      @dragover="onFolderDragOver"
      @dragleave="onFolderDragLeave"
      @drop="onFolderDrop"
      @click="selectFolder"
      @contextmenu="showFolderMenu($event, node.id)"
    >
      <span
        v-if="folderDragTarget?.position === 'before'"
        class="pointer-events-none absolute left-1 right-1 top-0 h-0.5 rounded bg-paw"
        data-testid="folder-drop-before"
      />
      <span
        v-if="folderDragTarget?.position === 'after'"
        class="pointer-events-none absolute bottom-0 left-1 right-1 h-0.5 rounded bg-paw"
        data-testid="folder-drop-after"
      />

      <button
        type="button"
        class="focus-ring flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface-2/80 hover:text-text"
        :aria-expanded="hasContent ? isOpen : undefined"
        :aria-label="hasContent ? (isOpen ? '折叠目录' : '展开目录') : undefined"
        :tabindex="hasContent ? 0 : -1"
        @click.stop="toggle"
      >
        <ChevronRight
          v-if="hasContent"
          :size="12"
          class="transition-transform duration-150"
          :class="{ 'rotate-90': isOpen }"
          aria-hidden="true"
        />
      </button>

      <span class="flex h-4 w-4 shrink-0 items-center justify-center text-muted">
        <Inbox v-if="node.id === FOLDER_INBOX" :size="13" class="text-paw/80" aria-hidden="true" />
        <Library
          v-else-if="node.id === FOLDER_PROJECTS"
          :size="13"
          class="text-paw/80"
          aria-hidden="true"
        />
        <FolderOpen
          v-else-if="isOpen && hasContent"
          :size="13"
          class="text-text-secondary"
          aria-hidden="true"
        />
        <Folder v-else :size="13" class="text-text-secondary" aria-hidden="true" />
      </span>

      <span class="min-w-0 flex-1 truncate text-xs" :class="isSelected ? 'font-medium' : ''">
        {{ node.label }}
      </span>

      <span v-if="node.documents.length" class="tree-count-badge mr-0.5">
        {{ node.documents.length }}
      </span>
    </div>

    <div
      v-show="isOpen"
      class="folder-children"
      :style="{ marginLeft: `${TREE_CHILD_GUIDE_PX}px` }"
    >
      <FolderTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        @reorder="(fid, did, bid) => emit('reorder', fid, did, bid)"
      />

      <ul class="space-y-px" @dragover="onDocListDragOver" @drop="onDocListDrop">
        <li
          v-for="doc in node.documents"
          :key="doc.id"
          draggable="true"
          role="button"
          tabindex="0"
          class="group/doc relative flex cursor-grab items-center gap-1 rounded-md py-1 pr-1.5 tree-row-hover focus-ring active:cursor-grabbing"
          :class="documents.activeId === doc.id ? 'tree-row-selected' : ''"
          :style="docIndentStyle"
          :aria-current="documents.activeId === doc.id ? 'page' : undefined"
          data-testid="folder-doc-item"
          @dragstart="onDocDragStart($event, doc.id)"
          @dragend="onDragEnd"
          @dragover="onDocDragOver($event, doc.id)"
          @dragleave="onDocDragLeave"
          @drop="onDocDrop($event, doc.id)"
          @click="openDoc(doc.id)"
          @keydown="onDocKeydown($event, doc.id)"
          @contextmenu="showDocMenu($event, doc.id)"
        >
          <span
            v-if="docDropTarget(doc.id)?.position === 'before'"
            class="pointer-events-none absolute left-2 right-1 top-0 h-0.5 rounded bg-paw"
            data-testid="doc-drop-indicator"
          />
          <span
            v-if="docDropTarget(doc.id)?.position === 'after'"
            class="pointer-events-none absolute bottom-0 left-2 right-1 h-0.5 rounded bg-paw"
            data-testid="doc-drop-indicator-after"
          />
          <FileText :size="12" class="shrink-0 text-muted" aria-hidden="true" />
          <Lock
            v-if="doc.aiExclude"
            :size="11"
            class="shrink-0 text-muted"
            aria-label="已禁止喂 AI"
            title="已禁止喂 AI"
          />
          <span class="min-w-0 flex-1 truncate text-xs" :title="doc.title">{{ doc.title }}</span>
          <button
            type="button"
            class="focus-ring ml-auto hidden shrink-0 rounded p-0.5 text-muted hover:bg-surface-1 hover:text-paw group-hover/doc:inline-flex"
            :title="documents.isPinned(doc.id) ? '取消固定' : '固定'"
            :aria-label="documents.isPinned(doc.id) ? '取消固定' : '固定'"
            @click.stop="documents.togglePin(doc.id)"
          >
            <Star
              :size="11"
              :class="documents.isPinned(doc.id) ? 'fill-paw text-paw' : ''"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            class="focus-ring hidden shrink-0 rounded p-0.5 text-muted hover:bg-surface-1 hover:text-danger group-hover/doc:inline-flex"
            title="移至回收站"
            aria-label="移至回收站"
            data-testid="doc-soft-delete-btn"
            @click.stop="requestDelete(doc.id)"
          >
            <Trash2 :size="11" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="focus-ring hidden shrink-0 rounded p-0.5 text-danger hover:bg-surface-1 group-hover/doc:inline-flex"
            title="永久删除"
            aria-label="永久删除"
            data-testid="doc-purge-btn"
            @click.stop="requestPurge(doc.id)"
          >
            <XCircle :size="11" aria-hidden="true" />
          </button>
        </li>
      </ul>

      <div
        v-if="isEmpty"
        class="tree-empty-state"
        role="status"
        data-testid="folder-empty-drop-zone"
        @dragover="onFolderDragOver"
        @dragleave="onFolderDragLeave"
        @drop="handleExternalFileDrop"
      >
        <Inbox
          v-if="node.id === FOLDER_INBOX"
          :size="12"
          class="shrink-0 text-paw/60"
          aria-hidden="true"
        />
        <Folder v-else :size="12" class="shrink-0 text-muted/70" aria-hidden="true" />
        <div class="tree-empty-state__text">
          <p class="text-[11px] font-medium text-text-secondary">
            {{ node.id === FOLDER_INBOX ? "收件箱为空" : "目录为空" }}
          </p>
          <p class="truncate text-[10px] text-muted" title="拖入文档，或点击上方「新建文档」">
            拖入或点「新建」
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.folder-children {
  border-left: 1px solid color-mix(in srgb, var(--color-text) 7%, transparent);
  padding-left: 2px;
}
</style>

<script lang="ts">
export default { name: "FolderTreeNode" };
</script>
