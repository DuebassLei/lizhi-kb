import { computed, type ComputedRef } from "vue";
import type { DocumentMeta } from "../types/document";
import type { FolderTreeNode } from "../types/folder";
import { useDocumentsStore } from "../stores/documents";
import { useFoldersStore } from "../stores/folders";
import { useFolderContextMenu } from "./useFolderContextMenu";
import { canDeleteFolder } from "../utils/folderHelpers";
import { isExternalFileDrag } from "../utils/importMarkdown";
import { useUiStore } from "../stores/ui";

export const DRAG_DOC_MIME = "application/x-lizhi-doc";
export const DRAG_FOLDER_MIME = "application/x-lizhi-folder";

export function isHalfAfter(e: DragEvent, el: EventTarget | null): boolean {
  const target = el as HTMLElement | null;
  if (!target) return false;
  const rect = target.getBoundingClientRect();
  return e.clientY > rect.top + rect.height / 2;
}

type ReorderEmit = (folderId: string, docId: string, beforeDocId: string | null) => void;

export function useFolderTreeRow(
  node: ComputedRef<FolderTreeNode>,
  emitReorder: ReorderEmit,
) {
  const documents = useDocumentsStore();
  const folders = useFoldersStore();
  const ui = useUiStore();
  const { showFolderMenu, showDocMenu } = useFolderContextMenu();

  const isOpen = computed(() => folders.isExpanded(node.value.id));
  const hasActiveDoc = computed(() =>
    node.value.documents.some((d) => documents.activeId === d.id),
  );
  const isSelected = computed(
    () => folders.selectedFolderId === node.value.id && !hasActiveDoc.value,
  );
  const isCustomFolder = computed(() => canDeleteFolder(node.value.id, folders.folders));
  const hasContent = computed(
    () => node.value.documents.length > 0 || node.value.children.length > 0,
  );
  const isEmpty = computed(
    () => isOpen.value && !node.value.documents.length && !node.value.children.length,
  );

  const folderDragTarget = computed(() =>
    folders.dragTarget?.kind === "folder" && folders.dragTarget.id === node.value.id
      ? folders.dragTarget
      : null,
  );

  function toggle() {
    folders.toggleExpanded(node.value.id);
  }

  function selectFolder() {
    folders.selectFolder(node.value.id);
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
    e.dataTransfer?.setData(DRAG_FOLDER_MIME, node.value.id);
    e.dataTransfer!.effectAllowed = "move";
    folders.draggingFolderId = node.value.id;
  }

  function onDragEnd() {
    folders.clearDragState();
  }

  function onFolderDragOver(e: DragEvent) {
    if (isExternalFileDrag(e)) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer!.dropEffect = "copy";
      folders.setDragTarget({ kind: "folder", id: node.value.id, position: "into" });
      return;
    }

    if (!e.dataTransfer?.types.includes(DRAG_FOLDER_MIME)) return;
    e.preventDefault();
    e.stopPropagation();

    const draggedId = folders.draggingFolderId;
    if (!draggedId || !folders.isFolderDragTargetValid(draggedId, node.value.id)) {
      e.dataTransfer.dropEffect = "none";
      return;
    }

    e.dataTransfer.dropEffect = "move";
    const ratio = (() => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      return (e.clientY - rect.top) / rect.height;
    })();
    const position = folders.resolveFolderDropPosition(draggedId, node.value.id, ratio);
    folders.setDragTarget({ kind: "folder", id: node.value.id, position });
  }

  function onFolderDragLeave(e: DragEvent) {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) return;
    if (folders.dragTarget?.kind === "folder" && folders.dragTarget.id === node.value.id) {
      folders.setDragTarget(null);
    }
  }

  async function handleFolderDrop(draggedFolderId: string) {
    const position = folders.dragTarget?.position ?? "into";

    if (position === "before" || position === "after") {
      const targetParentId = node.value.parentId;
      if (!targetParentId) return;

      const beforeId = folders.resolveSiblingDropBeforeId(node.value.id, position);
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

    if (!folders.isFolderDragTargetValid(draggedFolderId, node.value.id)) return;

    const dragged = folders.folders.find((f) => f.id === draggedFolderId);
    if (!dragged) return;

    if (dragged.parentId === node.value.id) {
      folders.reorderFolderSiblingInTree(node.value.id, draggedFolderId, null);
      return;
    }

    const result = folders.reparentFolder(draggedFolderId, node.value.id);
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
      const imported = await documents.importMarkdownFiles(Array.from(files), node.value.id);
      const count = imported.length;
      ui.showToast(
        "success",
        count === 1
          ? `已导入「${imported[0].title}」到「${node.value.label}」`
          : `已导入 ${count} 篇文档到「${node.value.label}」`,
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
    await documents.moveToFolder(docId, node.value.id);
  }

  function docDropTarget(docId: string) {
    return folders.dragTarget?.kind === "doc" && folders.dragTarget.id === docId
      ? folders.dragTarget
      : null;
  }

  function resolveDocDropBeforeId(docId: string, position: "before" | "after"): string | null {
    const docs = node.value.documents;
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

  function onDocDragLeave(e: DragEvent, targetDocId: string) {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) return;
    if (folders.dragTarget?.kind === "doc" && folders.dragTarget.id === targetDocId) {
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
    const targetFolder = node.value.id;
    const doc = documents.tree.find((d) => d.id === docId);
    if (doc && doc.folder !== targetFolder) {
      await documents.moveToFolder(docId, targetFolder);
    }
    emitReorder(targetFolder, docId, beforeDocId);
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

  return {
    documents,
    folders,
    showFolderMenu,
    showDocMenu,
    isOpen,
    isSelected,
    isCustomFolder,
    hasContent,
    isEmpty,
    folderDragTarget,
    toggle,
    selectFolder,
    onDocDragStart,
    onFolderDragStart,
    onDragEnd,
    onFolderDragOver,
    onFolderDragLeave,
    onFolderDrop,
    docDropTarget,
    onDocDragOver,
    onDocDragLeave,
    onDocDrop,
    onDocListDragOver,
    onDocListDrop,
    handleExternalFileDrop,
    openDoc,
    onDocKeydown,
  };
}

/** 虚拟行文档拖拽：用 folderNode 的 documents 列表解析 beforeId */
export function resolveVirtualDocDropBeforeId(
  documents: DocumentMeta[],
  docId: string,
  position: "before" | "after",
): string | null {
  const idx = documents.findIndex((d) => d.id === docId);
  if (idx < 0) return null;
  if (position === "before") return docId;
  return idx < documents.length - 1 ? documents[idx + 1].id : null;
}
