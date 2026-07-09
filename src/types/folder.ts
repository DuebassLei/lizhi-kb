/** 系统内置目录 ID */
export const FOLDER_INBOX = "inbox";
export const FOLDER_PROJECTS = "projects";

export interface FolderMeta {
  id: string;
  label: string;
  parentId: string | null;
  /** 系统目录不可删除 */
  system?: boolean;
}

export interface FolderTreeNode extends FolderMeta {
  children: FolderTreeNode[];
  documents: import("./document").DocumentMeta[];
  depth: number;
}

export interface FolderUiState {
  expanded: Record<string, boolean>;
  order: Record<string, string[]>;
  /** 同级子目录排序 */
  folderOrder: Record<string, string[]>;
  folders: FolderMeta[];
}
