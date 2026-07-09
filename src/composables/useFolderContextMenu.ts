import type { ContextMenuItem } from "../stores/contextMenu";
import { useContextMenuStore } from "../stores/contextMenu";
import { useDocumentsStore } from "../stores/documents";
import { useFoldersStore } from "../stores/folders";
import { useFolderActions } from "./useFolderActions";
import { exportDocument } from "../utils/exportFile";
import { canDeleteFolder } from "../utils/folderHelpers";
import { useDocumentDelete } from "./useDocumentDelete";
import { useFolderNameDialog } from "./useFolderNameDialog";

export function useFolderContextMenu() {
  const menu = useContextMenuStore();
  const documents = useDocumentsStore();
  const folders = useFoldersStore();
  const { createSubfolder, renameFolder } = useFolderActions();
  const { requestDelete } = useDocumentDelete();
  const folderDialog = useFolderNameDialog();

  function moveTargetsForDoc(docId: string) {
    const doc = documents.tree.find((d) => d.id === docId);
    const current = doc ? folders.normalizeFolder(doc.folder) : "";
    return folders.flatFolders.filter((f) => f.id !== current);
  }

  function showFolderMenu(event: MouseEvent, folderId: string) {
    const isCustom = canDeleteFolder(folderId, folders.folders);
    const items: ContextMenuItem[] = [
      {
        id: "new-doc",
        label: "在此新建文档",
        run: async () => {
          folders.selectFolder(folderId);
          await documents.create("无标题", folderId);
        },
      },
      {
        id: "new-sub",
        label: "新建子目录…",
        run: async () => {
          const parent = folders.folders.find((f) => f.id === folderId);
          const name = await folderDialog.promptCreateSubfolder(parent?.label);
          if (name) createSubfolder(folderId, name);
        },
      },
    ];

    if (isCustom) {
      items.push(
        {
          id: "rename",
          label: "重命名…",
          run: async () => {
            const current = folders.folders.find((f) => f.id === folderId)?.label ?? "";
            const name = await folderDialog.promptRename(current);
            if (name) await renameFolder(folderId, name);
          },
        },
        {
          id: "delete",
          label: "删除目录",
          danger: true,
          run: async () => {
            if (!window.confirm("删除目录？文档将移至上级目录。")) return;
            const result = folders.deleteFolder(folderId);
            if (!result) return;
            for (const doc of documents.tree) {
              if (result.removeIds.includes(folders.normalizeFolder(doc.folder))) {
                await documents.moveToFolder(doc.id, result.moveDocsTo);
              }
            }
          },
        },
      );
    }

    menu.show(event, items);
  }

  function showDocMenu(event: MouseEvent, docId: string) {
    const doc = documents.tree.find((d) => d.id === docId);
    if (!doc) return;

    const moveItems = moveTargetsForDoc(docId).map((f) => ({
      id: `move-${f.id}`,
      label: `移动到 › ${folders.pathLabel(f.id)}`,
      run: async () => documents.moveToFolder(docId, f.id),
    }));

    async function loadDocContent() {
      return documents.resolveDocumentContent(docId);
    }

    menu.show(event, [
      {
        id: "open",
        label: "打开",
        run: async () => documents.openDocument(docId),
      },
      {
        id: "export-md",
        label: "导出 Markdown",
        run: async () => {
          void exportDocument(doc.title, await loadDocContent(), "md");
        },
      },
      {
        id: "export-docx",
        label: "导出 Word",
        run: async () => {
          void exportDocument(doc.title, await loadDocContent(), "docx");
        },
      },
      {
        id: "export-html",
        label: "导出 HTML",
        run: async () => {
          void exportDocument(doc.title, await loadDocContent(), "html");
        },
      },
      {
        id: "export-pdf",
        label: "导出 PDF",
        run: async () => {
          void exportDocument(doc.title, await loadDocContent(), "pdf");
        },
      },
      ...moveItems,
      {
        id: "pin",
        label: documents.isPinned(docId) ? "取消固定" : "固定文档",
        run: () => documents.togglePin(docId),
      },
      {
        id: "delete",
        label: "删除文档",
        danger: true,
        run: () => requestDelete(docId),
      },
    ]);
  }

  return { showFolderMenu, showDocMenu, moveTargetsForDoc };
}
