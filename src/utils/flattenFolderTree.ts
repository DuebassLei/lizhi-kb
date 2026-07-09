import type { DocumentMeta } from "../types/document";
import type { FolderTreeNode } from "../types/folder";

export const TREE_ROW_HEIGHT = 30;
export const TREE_EMPTY_ROW_HEIGHT = 72;

export type FlatTreeRow =
  | { kind: "folder"; key: string; node: FolderTreeNode }
  | {
      kind: "doc";
      key: string;
      doc: DocumentMeta;
      folderId: string;
      depth: number;
      folderNode: FolderTreeNode;
    }
  | {
      kind: "empty";
      key: string;
      folderId: string;
      depth: number;
      folderNode: FolderTreeNode;
    };

export function rowHeight(row: FlatTreeRow): number {
  return row.kind === "empty" ? TREE_EMPTY_ROW_HEIGHT : TREE_ROW_HEIGHT;
}

export interface FlatFolderTree {
  rows: FlatTreeRow[];
  offsets: number[];
  totalHeight: number;
}

export function flattenFolderTree(
  nodes: FolderTreeNode[],
  isExpanded: (folderId: string) => boolean,
): FlatFolderTree {
  const rows: FlatTreeRow[] = [];

  function visit(node: FolderTreeNode) {
    rows.push({ kind: "folder", key: `f-${node.id}`, node });
    if (!isExpanded(node.id)) return;

    for (const child of node.children) {
      visit(child);
    }
    for (const doc of node.documents) {
      rows.push({
        kind: "doc",
        key: `d-${doc.id}`,
        doc,
        folderId: node.id,
        depth: node.depth + 1,
        folderNode: node,
      });
    }
    if (!node.documents.length && !node.children.length) {
      rows.push({
        kind: "empty",
        key: `e-${node.id}`,
        folderId: node.id,
        depth: node.depth + 1,
        folderNode: node,
      });
    }
  }

  for (const node of nodes) {
    visit(node);
  }

  const offsets: number[] = [];
  let y = 0;
  for (const row of rows) {
    offsets.push(y);
    y += rowHeight(row);
  }

  return { rows, offsets, totalHeight: y };
}

/** 可见行数（用于决定是否启用虚拟滚动） */
export function countFlatTreeRows(nodes: FolderTreeNode[], isExpanded: (id: string) => boolean): number {
  return flattenFolderTree(nodes, isExpanded).rows.length;
}
