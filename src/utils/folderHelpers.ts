import type { FolderMeta } from "../types/folder";
import { FOLDER_INBOX, FOLDER_PROJECTS } from "../types/folder";

/** 校验 folder 是否存在于目录注册表，否则归入收件箱 */
export function normalizeDocFolder(folder: string | undefined, folders: FolderMeta[]): string {
  if (!folder) return FOLDER_INBOX;
  if (folders.some((f) => f.id === folder)) return folder;
  if (
    folder.startsWith(`${FOLDER_INBOX}/`) ||
    folder.startsWith(`${FOLDER_PROJECTS}/`) ||
    folder === FOLDER_PROJECTS
  ) {
    if (folders.some((f) => f.id === folder)) return folder;
  }
  return FOLDER_INBOX;
}

/** 返回从根到当前的目录链 */
export function getFolderPathSegments(folderId: string, folders: FolderMeta[]): FolderMeta[] {
  const segments: FolderMeta[] = [];
  let current: string | null = folderId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const meta = folders.find((f) => f.id === current);
    if (!meta) break;
    segments.unshift(meta);
    current = meta.parentId;
  }
  return segments;
}

/** 判断 targetId 是否为 folderId 的子孙目录 */
export function isDescendantFolder(folderId: string, targetId: string, folders: FolderMeta[]): boolean {
  if (folderId === targetId) return true;
  let current = folders.find((f) => f.id === targetId)?.parentId ?? null;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current === folderId) return true;
    current = folders.find((f) => f.id === current)?.parentId ?? null;
  }
  return false;
}

/** 重映射目录 ID（含子孙路径） */
export function remapFolderIdInList(
  folders: FolderMeta[],
  oldId: string,
  newId: string,
  newLabel: string,
): FolderMeta[] {
  return folders.map((f) => {
    if (f.id === oldId) {
      return { ...f, id: newId, label: newLabel };
    }
    if (f.parentId === oldId) {
      return { ...f, parentId: newId };
    }
    if (f.id.startsWith(`${oldId}/`)) {
      return {
        ...f,
        id: newId + f.id.slice(oldId.length),
        parentId: f.parentId?.startsWith(`${oldId}/`)
          ? newId + f.parentId.slice(oldId.length)
          : f.parentId === oldId
            ? newId
            : f.parentId,
      };
    }
    if (f.parentId?.startsWith(`${oldId}/`)) {
      return { ...f, parentId: newId + f.parentId.slice(oldId.length) };
    }
    return f;
  });
}

export function remapOrderValues(
  order: Record<string, string[]>,
  oldId: string,
  newId: string,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [key, ids] of Object.entries(order)) {
    next[key] = ids.map((id) => {
      if (id === oldId) return newId;
      if (id.startsWith(`${oldId}/`)) return newId + id.slice(oldId.length);
      return id;
    });
  }
  return next;
}

export function canReparentFolder(
  folderId: string,
  newParentId: string,
  folders: FolderMeta[],
): boolean {
  if (!canDeleteFolder(folderId, folders)) return false;
  if (!folders.some((f) => f.id === newParentId)) return false;
  if (folderId === newParentId) return false;
  if (isDescendantFolder(folderId, newParentId, folders)) return false;
  const folder = folders.find((f) => f.id === folderId);
  return !!folder && folder.parentId !== newParentId;
}

export function getFolderLabel(folderId: string, folders: FolderMeta[]): string {
  return folders.find((f) => f.id === folderId)?.label ?? folderId;
}

/** 面包屑路径，如「知识库 / 写作 / 章节一」 */
export function getFolderPathLabel(folderId: string, folders: FolderMeta[]): string {
  const parts: string[] = [];
  let current: string | null = folderId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const meta = folders.find((f) => f.id === current);
    if (!meta) break;
    parts.unshift(meta.label);
    current = meta.parentId;
  }
  return parts.join(" / ") || folderId;
}

export function listFoldersFlat(
  folders: FolderMeta[],
  folderOrder: Record<string, string[]> = {},
): FolderMeta[] {
  const roots = folders.filter((f) => f.parentId === null);
  const rootOrder = folderOrder["__root__"];
  const sortedRoots = [...roots].sort((a, b) => {
    if (!rootOrder?.length) return a.id === FOLDER_INBOX ? -1 : 1;
    return rootOrder.indexOf(a.id) - rootOrder.indexOf(b.id);
  });

  const result: FolderMeta[] = [];

  function sortSiblings(items: FolderMeta[], parentId: string): FolderMeta[] {
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

  function walk(parent: FolderMeta) {
    result.push(parent);
    sortSiblings(
      folders.filter((f) => f.parentId === parent.id),
      parent.id,
    ).forEach((child) => walk(child));
  }

  sortedRoots.forEach((r) => walk(r));
  return result;
}

export function collectDescendantFolderIds(folderId: string, folders: FolderMeta[]): string[] {
  const ids: string[] = [];
  function walk(parentId: string) {
    for (const f of folders) {
      if (f.parentId === parentId) {
        ids.push(f.id);
        walk(f.id);
      }
    }
  }
  walk(folderId);
  return ids;
}

export function canDeleteFolder(folderId: string, folders: FolderMeta[]): boolean {
  const f = folders.find((x) => x.id === folderId);
  return !!f && !f.system;
}
