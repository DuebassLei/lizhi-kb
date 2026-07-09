import type { DocumentMeta } from "../types/document";
import {
  FOLDER_INBOX,
  FOLDER_PROJECTS,
  type FolderMeta,
  type FolderTreeNode,
  type FolderUiState,
} from "../types/folder";
import { normalizeDocFolder } from "./folderHelpers";

const STORAGE_KEY = "lizhi-kb-folders";

const SYSTEM_FOLDERS: FolderMeta[] = [
  { id: FOLDER_INBOX, label: "收件箱", parentId: null, system: true },
  { id: FOLDER_PROJECTS, label: "知识库", parentId: null, system: true },
];

function defaultState(): FolderUiState {
  return {
    expanded: { [FOLDER_INBOX]: true, [FOLDER_PROJECTS]: true },
    order: {},
    folderOrder: {},
    folders: [...SYSTEM_FOLDERS],
  };
}

export function loadFolderState(): FolderUiState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<FolderUiState>;
    const folders = mergeSystemFolders(parsed.folders ?? []);
    return {
      expanded: { ...defaultState().expanded, ...parsed.expanded },
      order: parsed.order ?? {},
      folderOrder: parsed.folderOrder ?? {},
      folders,
    };
  } catch {
    return defaultState();
  }
}

export function saveFolderState(state: FolderUiState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mergeSystemFolders(custom: FolderMeta[]): FolderMeta[] {
  const map = new Map<string, FolderMeta>();
  for (const f of SYSTEM_FOLDERS) map.set(f.id, { ...f });
  for (const f of custom) {
    if (!f.system && f.id !== FOLDER_INBOX && f.id !== FOLDER_PROJECTS) {
      map.set(f.id, f);
    }
  }
  // 始终同步系统目录显示名（如「项目」→「知识库」）
  for (const sys of SYSTEM_FOLDERS) {
    const existing = map.get(sys.id);
    if (existing) {
      map.set(sys.id, { ...existing, label: sys.label, system: true, parentId: sys.parentId });
    }
  }
  return [...map.values()];
}

export function slugifyFolderName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "")
    .slice(0, 32);
}

export function createSubfolderId(parentId: string, label: string, existingIds: string[]): string {
  const base = slugifyFolderName(label) || "folder";
  let id = `${parentId}/${base}`;
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${parentId}/${base}-${n}`;
    n++;
  }
  return id;
}

export interface FolderIdPreview {
  id: string;
  preferredId: string;
  /** 因同名冲突自动追加后缀 */
  slugAdjusted: boolean;
}

export function previewSubfolderId(
  parentId: string,
  label: string,
  existingIds: string[],
): FolderIdPreview {
  const base = slugifyFolderName(label) || "folder";
  const preferredId = `${parentId}/${base}`;
  const id = createSubfolderId(parentId, label, existingIds);
  return { id, preferredId, slugAdjusted: id !== preferredId };
}

export function sortFoldersByOrder(
  items: FolderMeta[],
  parentId: string,
  folderOrder: Record<string, string[]>,
): FolderMeta[] {
  const ids = folderOrder[parentId];
  if (!ids?.length) {
    return [...items].sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  }
  return [...items].sort((a, b) => {
    const ia = ids.indexOf(a.id);
    const ib = ids.indexOf(b.id);
    if (ia === -1 && ib === -1) return a.label.localeCompare(b.label, "zh-CN");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function reorderFolderSibling(
  folderOrder: Record<string, string[]>,
  parentId: string,
  folderId: string,
  beforeFolderId: string | null,
): Record<string, string[]> {
  const next = { ...folderOrder };
  const list = [...(next[parentId] ?? [])].filter((id) => id !== folderId);
  if (beforeFolderId) {
    const idx = list.indexOf(beforeFolderId);
    if (idx >= 0) list.splice(idx, 0, folderId);
    else list.push(folderId);
  } else {
    list.push(folderId);
  }
  next[parentId] = list;
  return next;
}

export function sortDocsInFolder(
  docs: DocumentMeta[],
  folderId: string,
  order: Record<string, string[]>,
): DocumentMeta[] {
  const ids = order[folderId];
  if (!ids?.length) {
    return [...docs].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return [...docs].sort((a, b) => {
    const ia = ids.indexOf(a.id);
    const ib = ids.indexOf(b.id);
    if (ia === -1 && ib === -1) return b.updatedAt - a.updatedAt;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function buildFolderTree(
  allDocs: DocumentMeta[],
  state: FolderUiState,
): FolderTreeNode[] {
  const docsByFolder = new Map<string, DocumentMeta[]>();
  for (const doc of allDocs) {
    const fid = normalizeDocFolder(doc.folder, state.folders);
    if (!docsByFolder.has(fid)) docsByFolder.set(fid, []);
    docsByFolder.get(fid)!.push(doc);
  }

  function buildNode(folder: FolderMeta, depth: number): FolderTreeNode {
    const rawDocs = docsByFolder.get(folder.id) ?? [];
    const documents = sortDocsInFolder(rawDocs, folder.id, state.order);
    const childFolders = state.folders.filter((f) => f.parentId === folder.id);
    const children = sortFoldersByOrder(childFolders, folder.id, state.folderOrder).map((f) =>
      buildNode(f, depth + 1),
    );
    return { ...folder, children, documents, depth };
  }

  return state.folders
    .filter((f) => f.parentId === null)
    .sort((a, b) => {
      const order = state.folderOrder["__root__"];
      if (!order?.length) return a.id === FOLDER_INBOX ? -1 : 1;
      return order.indexOf(a.id) - order.indexOf(b.id);
    })
    .map((f) => buildNode(f, 0));
}

export function appendToFolderOrder(
  order: Record<string, string[]>,
  folderId: string,
  docId: string,
): Record<string, string[]> {
  const next = { ...order };
  const list = [...(next[folderId] ?? []).filter((id) => id !== docId), docId];
  next[folderId] = list;
  return next;
}

export function reorderInFolder(
  order: Record<string, string[]>,
  folderId: string,
  docId: string,
  beforeDocId: string | null,
): Record<string, string[]> {
  const next = { ...order };
  const list = [...(next[folderId] ?? [])].filter((id) => id !== docId);
  if (beforeDocId) {
    const idx = list.indexOf(beforeDocId);
    if (idx >= 0) list.splice(idx, 0, docId);
    else list.push(docId);
  } else {
    list.push(docId);
  }
  next[folderId] = list;
  return next;
}

export function migrateFolderUiState(
  state: Pick<FolderUiState, "expanded" | "order" | "folderOrder">,
  oldId: string,
  newId: string,
): Pick<FolderUiState, "expanded" | "order" | "folderOrder"> {
  const remapBool = (record: Record<string, boolean>): Record<string, boolean> => {
    const next: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(record)) {
      let newKey = key;
      if (key === oldId) newKey = newId;
      else if (key.startsWith(`${oldId}/`)) newKey = newId + key.slice(oldId.length);
      next[newKey] = val;
    }
    return next;
  };

  const remapArr = (record: Record<string, string[]>): Record<string, string[]> => {
    const next: Record<string, string[]> = {};
    for (const [key, ids] of Object.entries(record)) {
      let newKey = key;
      if (key === oldId) newKey = newId;
      else if (key.startsWith(`${oldId}/`)) newKey = newId + key.slice(oldId.length);
      next[newKey] = ids.map((id) => {
        if (id === oldId) return newId;
        if (id.startsWith(`${oldId}/`)) return newId + id.slice(oldId.length);
        return id;
      });
    }
    return next;
  };

  return {
    expanded: remapBool(state.expanded),
    order: remapArr(state.order),
    folderOrder: remapArr(state.folderOrder),
  };
}

export function removeFromAllOrders(
  order: Record<string, string[]>,
  docId: string,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [fid, ids] of Object.entries(order)) {
    next[fid] = ids.filter((id) => id !== docId);
  }
  return next;
}

export { SYSTEM_FOLDERS, FOLDER_INBOX, FOLDER_PROJECTS };
