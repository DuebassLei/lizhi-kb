import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { DocumentMeta } from "../types/document";
import { FOLDER_INBOX, FOLDER_PROJECTS, type FolderMeta } from "../types/folder";
import {
  canDeleteFolder,
  canReparentFolder,
  collectDescendantFolderIds,
  ensureFolderPathInState,
  getFolderPathLabel,
  getFolderPathSegments,
  isDescendantFolder,
  listFoldersFlat,
  mergeFolderUiStates,
  normalizeDocFolder,
  remapFolderIdInList,
} from "../utils/folderHelpers";
import {
  buildFolderTree,
  createSubfolderId,
  loadFolderState,
  migrateFolderUiState,
  previewSubfolderId,
  reorderFolderSibling,
  reorderInFolder,
  saveFolderState,
  sortFoldersByOrder,
  type FolderIdPreview,
} from "../utils/folderTree";
import { schedulePersistVaultUiState } from "../services/vaultUiStateService";

export type TreeDragTarget = {
  kind: "folder" | "doc";
  id: string;
  position: "before" | "after" | "into";
};

export type FolderRenamePreview = FolderIdPreview & {
  oldId: string;
  migrated: boolean;
};

export const useFoldersStore = defineStore("folders", () => {
  const expanded = ref<Record<string, boolean>>(loadFolderState().expanded);
  const order = ref<Record<string, string[]>>(loadFolderState().order);
  const folderOrder = ref<Record<string, string[]>>(loadFolderState().folderOrder);
  const folders = ref<FolderMeta[]>(loadFolderState().folders);
  const selectedFolderId = ref<string>(FOLDER_INBOX);
  const dragOverFolderId = ref<string | null>(null);
  const dragTarget = ref<TreeDragTarget | null>(null);
  const draggingFolderId = ref<string | null>(null);
  const draggingDocId = ref<string | null>(null);

  function persist() {
    saveFolderState({
      expanded: expanded.value,
      order: order.value,
      folderOrder: folderOrder.value,
      folders: folders.value,
    });
    schedulePersistVaultUiState();
  }

  function load() {
    const state = loadFolderState();
    expanded.value = state.expanded;
    order.value = state.order;
    folderOrder.value = state.folderOrder;
    folders.value = state.folders;
  }

  function isExpanded(folderId: string): boolean {
    return expanded.value[folderId] ?? false;
  }

  function toggleExpanded(folderId: string) {
    expanded.value = { ...expanded.value, [folderId]: !isExpanded(folderId) };
    persist();
  }

  function setExpanded(folderId: string, open: boolean) {
    expanded.value = { ...expanded.value, [folderId]: open };
    persist();
  }

  function expandAll() {
    const next = { ...expanded.value };
    for (const f of folders.value) next[f.id] = true;
    expanded.value = next;
    persist();
  }

  function collapseAll() {
    expanded.value = { [FOLDER_INBOX]: true, [FOLDER_PROJECTS]: true };
    persist();
  }

  function selectFolder(folderId: string) {
    selectedFolderId.value = folderId;
  }

  function revealFolder(folderId: string) {
    const segments = getFolderPathSegments(folderId, folders.value);
    const next = { ...expanded.value };
    for (const seg of segments) next[seg.id] = true;
    expanded.value = next;
    selectedFolderId.value = folderId;
    persist();
  }

  function setDragTarget(target: TreeDragTarget | null) {
    dragTarget.value = target;
    dragOverFolderId.value = target?.kind === "folder" ? target.id : null;
  }

  function clearDragState() {
    dragTarget.value = null;
    dragOverFolderId.value = null;
    draggingFolderId.value = null;
    draggingDocId.value = null;
  }

  function existingIdsExcludingSubtree(folderId: string): string[] {
    return folders.value
      .map((f) => f.id)
      .filter((id) => id !== folderId && !id.startsWith(`${folderId}/`));
  }

  function previewSubfolder(parentId: string, label: string): FolderIdPreview | null {
    if (!folderExists(parentId)) return null;
    const trimmed = label.trim();
    if (!trimmed) return null;
    return previewSubfolderId(parentId, trimmed, folders.value.map((f) => f.id));
  }

  function previewRename(folderId: string, label: string): FolderRenamePreview | null {
    const trimmed = label.trim();
    if (!trimmed || !canDeleteFolder(folderId, folders.value)) return null;
    const folder = folders.value.find((f) => f.id === folderId);
    if (!folder || folder.parentId === null) return null;

    const parentId = folder.parentId;
    const existingIds = existingIdsExcludingSubtree(folderId);
    const preview = previewSubfolderId(parentId, trimmed, existingIds);
    return {
      ...preview,
      oldId: folderId,
      migrated: preview.id !== folderId,
    };
  }

  function getOrderedSiblingIds(parentId: string | null): string[] {
    const items = folders.value.filter((f) => f.parentId === parentId);
    const key = parentId ?? "__root__";
    return sortFoldersByOrder(items, key, folderOrder.value).map((f) => f.id);
  }

  function resolveSiblingDropBeforeId(
    targetId: string,
    position: "before" | "after",
  ): string | null {
    const target = folders.value.find((f) => f.id === targetId);
    if (!target) return null;
    const siblings = getOrderedSiblingIds(target.parentId);
    const idx = siblings.indexOf(targetId);
    if (idx < 0) return null;
    if (position === "before") return targetId;
    return idx < siblings.length - 1 ? siblings[idx + 1] : null;
  }

  function resolveFolderDropPosition(
    draggedFolderId: string,
    targetFolderId: string,
    ratio: number,
  ): "before" | "after" | "into" {
    const dragged = folders.value.find((f) => f.id === draggedFolderId);
    const target = folders.value.find((f) => f.id === targetFolderId);
    if (!dragged || !target) return "into";
    if (
      dragged.parentId === target.parentId &&
      dragged.parentId !== null &&
      dragged.parentId !== targetFolderId
    ) {
      return ratio < 0.5 ? "before" : "after";
    }
    return "into";
  }

  function folderExists(folderId: string): boolean {
    return folders.value.some((f) => f.id === folderId);
  }

  /** 确保路径注册到侧栏；返回规范化后的 folder id */
  function ensureFolderPath(folderPath: string): string {
    const result = ensureFolderPathInState(folderPath, {
      folders: folders.value,
      folderOrder: folderOrder.value,
      expanded: expanded.value,
    });
    if (result.created.length > 0) {
      folders.value = result.folders;
      folderOrder.value = result.folderOrder;
      expanded.value = result.expanded;
      persist();
    }
    return result.folderId;
  }

  /** 根据文档 meta 自愈：补齐侧栏缺失路径 */
  function ensureMissingFromDocuments(docs: DocumentMeta[]) {
    let changed = false;
    let nextFolders = folders.value;
    let nextOrder = folderOrder.value;
    let nextExpanded = expanded.value;
    const seen = new Set<string>();
    for (const doc of docs) {
      const raw = doc.folder?.trim();
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      if (nextFolders.some((f) => f.id === raw)) continue;
      // 文档已有 folder 字符串：按原样注册，避免 slugify 与旧路径不一致
      const result = ensureFolderPathInState(
        raw,
        {
          folders: nextFolders,
          folderOrder: nextOrder,
          expanded: nextExpanded,
        },
        { slugifySegments: false },
      );
      if (result.created.length > 0) {
        changed = true;
        nextFolders = result.folders;
        nextOrder = result.folderOrder;
        nextExpanded = result.expanded;
      }
    }
    if (changed) {
      folders.value = nextFolders;
      folderOrder.value = nextOrder;
      expanded.value = nextExpanded;
      persist();
    }
  }

  /** 与磁盘/MCP 写入的侧栏树做并集合并 */
  function mergeFromFolderUiState(incoming: {
    folders?: FolderMeta[];
    folderOrder?: Record<string, string[]>;
    expanded?: Record<string, boolean>;
    order?: Record<string, string[]>;
  }) {
    const merged = mergeFolderUiStates(
      {
        folders: folders.value,
        folderOrder: folderOrder.value,
        expanded: expanded.value,
        order: order.value,
      },
      incoming,
    );
    folders.value = merged.folders;
    folderOrder.value = merged.folderOrder;
    expanded.value = merged.expanded;
    order.value = merged.order;
    persist();
  }

  function applyFolderIdMigration(
    oldId: string,
    newId: string,
    newLabel: string,
    newParentId?: string | null,
  ) {
    folders.value = remapFolderIdInList(folders.value, oldId, newId, newLabel);
    if (newParentId !== undefined) {
      const root = folders.value.find((f) => f.id === newId);
      if (root) root.parentId = newParentId;
    }

    const migrated = migrateFolderUiState(
      {
        expanded: expanded.value,
        order: order.value,
        folderOrder: folderOrder.value,
      },
      oldId,
      newId,
    );
    expanded.value = migrated.expanded;
    order.value = migrated.order;
    folderOrder.value = migrated.folderOrder;

    if (selectedFolderId.value === oldId || selectedFolderId.value.startsWith(`${oldId}/`)) {
      selectedFolderId.value =
        selectedFolderId.value === oldId
          ? newId
          : newId + selectedFolderId.value.slice(oldId.length);
    }
  }

  function addSubfolder(parentId: string, label: string): FolderMeta | null {
    if (!folderExists(parentId)) return null;
    const trimmed = label.trim();
    if (!trimmed) return null;

    const existingIds = folders.value.map((f) => f.id);
    const id = createSubfolderId(parentId, trimmed, existingIds);
    if (folders.value.some((f) => f.id === id)) return null;

    const folder: FolderMeta = { id, label: trimmed, parentId };
    folders.value = [...folders.value, folder];
    expanded.value = { ...expanded.value, [parentId]: true, [id]: true };
    folderOrder.value = reorderFolderSibling(folderOrder.value, parentId, id, null);
    persist();
    return folder;
  }

  function renameFolder(folderId: string, label: string): { migrated: boolean; oldId: string; newId: string } | null {
    const trimmed = label.trim();
    if (!trimmed || !canDeleteFolder(folderId, folders.value)) return null;
    const folder = folders.value.find((f) => f.id === folderId);
    if (!folder || folder.parentId === null) return null;

    const parentId = folder.parentId;
    const existingIds = folders.value
      .map((f) => f.id)
      .filter((id) => id !== folderId && !id.startsWith(`${folderId}/`));
    const newId = createSubfolderId(parentId, trimmed, existingIds);

    if (newId === folderId) {
      folders.value = folders.value.map((f) =>
        f.id === folderId ? { ...f, label: trimmed } : f,
      );
      persist();
      return { migrated: false, oldId: folderId, newId: folderId };
    }

    applyFolderIdMigration(folderId, newId, trimmed);
    persist();
    return { migrated: true, oldId: folderId, newId };
  }

  function reparentFolder(folderId: string, newParentId: string): { oldId: string; newId: string } | null {
    if (!canReparentFolder(folderId, newParentId, folders.value)) return null;

    const folder = folders.value.find((f) => f.id === folderId)!;
    const subtreeIds = [folderId, ...collectDescendantFolderIds(folderId, folders.value)];
    const existingIds = folders.value.map((f) => f.id).filter((id) => !subtreeIds.includes(id));
    const newRootId = createSubfolderId(newParentId, folder.label, existingIds);

    const oldParentId = folder.parentId!;
    applyFolderIdMigration(folderId, newRootId, folder.label, newParentId);

    folderOrder.value = {
      ...folderOrder.value,
      [oldParentId]: (folderOrder.value[oldParentId] ?? []).filter((id) => id !== folderId),
    };
    folderOrder.value = reorderFolderSibling(folderOrder.value, newParentId, newRootId, null);

    expanded.value = { ...expanded.value, [newParentId]: true };
    persist();
    return { oldId: folderId, newId: newRootId };
  }

  function reorderFolderSiblingInTree(
    parentId: string,
    folderId: string,
    beforeFolderId: string | null,
  ) {
    folderOrder.value = reorderFolderSibling(folderOrder.value, parentId, folderId, beforeFolderId);
    persist();
  }

  /** 删除目录及其子目录，返回需迁移文档的 folderId 列表和目标目录 */
  function deleteFolder(folderId: string): { removeIds: string[]; moveDocsTo: string } | null {
    if (!canDeleteFolder(folderId, folders.value)) return null;
    const folder = folders.value.find((f) => f.id === folderId);
    if (!folder) return null;

    const descendants = collectDescendantFolderIds(folderId, folders.value);
    const removeIds = [folderId, ...descendants];
    const moveDocsTo = folder.parentId ?? FOLDER_INBOX;

    folders.value = folders.value.filter((f) => !removeIds.includes(f.id));
    for (const id of removeIds) {
      delete expanded.value[id];
      delete order.value[id];
      delete folderOrder.value[id];
    }
    if (folder.parentId) {
      folderOrder.value = {
        ...folderOrder.value,
        [folder.parentId]: (folderOrder.value[folder.parentId] ?? []).filter(
          (id) => !removeIds.includes(id),
        ),
      };
    }
    if (selectedFolderId.value && removeIds.includes(selectedFolderId.value)) {
      selectedFolderId.value = moveDocsTo;
    }
    persist();
    return { removeIds, moveDocsTo };
  }

  function onDocumentMoved(docId: string, fromFolder: string, toFolder: string) {
    const next = { ...order.value };
    if (fromFolder && next[fromFolder]) {
      next[fromFolder] = next[fromFolder].filter((id) => id !== docId);
    }
    next[toFolder] = [...(next[toFolder] ?? []).filter((id) => id !== docId), docId];
    order.value = next;
    persist();
  }

  function onDocumentReordered(folderId: string, docId: string, beforeDocId: string | null) {
    order.value = reorderInFolder(order.value, folderId, docId, beforeDocId);
    persist();
  }

  function onDocumentRemoved(docId: string) {
    const next: Record<string, string[]> = {};
    for (const [fid, ids] of Object.entries(order.value)) {
      next[fid] = ids.filter((id) => id !== docId);
    }
    order.value = next;
    persist();
  }

  function buildTree(allDocs: DocumentMeta[]) {
    return buildFolderTree(allDocs, {
      expanded: expanded.value,
      order: order.value,
      folderOrder: folderOrder.value,
      folders: folders.value,
    });
  }

  const flatFolders = computed(() => listFoldersFlat(folders.value, folderOrder.value));

  function pathLabel(folderId: string): string {
    return getFolderPathLabel(folderId, folders.value);
  }

  function pathSegments(folderId: string): FolderMeta[] {
    return getFolderPathSegments(folderId, folders.value);
  }

  function normalizeFolder(folder: string | undefined): string {
    return normalizeDocFolder(folder, folders.value);
  }

  function isFolderDragTargetValid(draggedFolderId: string, targetFolderId: string): boolean {
    if (draggedFolderId === targetFolderId) return false;
    if (isDescendantFolder(draggedFolderId, targetFolderId, folders.value)) return false;
    return canDeleteFolder(draggedFolderId, folders.value);
  }

  return {
    expanded,
    order,
    folderOrder,
    folders,
    selectedFolderId,
    dragOverFolderId,
    dragTarget,
    draggingFolderId,
    draggingDocId,
    flatFolders,
    load,
    persist,
    isExpanded,
    toggleExpanded,
    setExpanded,
    expandAll,
    collapseAll,
    selectFolder,
    revealFolder,
    setDragTarget,
    clearDragState,
    previewSubfolder,
    previewRename,
    getOrderedSiblingIds,
    resolveSiblingDropBeforeId,
    resolveFolderDropPosition,
    folderExists,
    ensureFolderPath,
    ensureMissingFromDocuments,
    mergeFromFolderUiState,
    addSubfolder,
    renameFolder,
    reparentFolder,
    reorderFolderSiblingInTree,
    deleteFolder,
    onDocumentMoved,
    onDocumentReordered,
    onDocumentRemoved,
    buildTree,
    pathLabel,
    pathSegments,
    normalizeFolder,
    isFolderDragTargetValid,
  };
});
