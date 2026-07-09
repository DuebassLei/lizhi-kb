import { useDocumentsStore } from "../stores/documents";
import { useFoldersStore } from "../stores/folders";
import type { FolderIdPreview } from "../utils/folderTree";

function confirmSlugConflict(preview: FolderIdPreview): boolean {
  if (!preview.slugAdjusted) return true;
  return window.confirm(
    `目录路径「${preview.preferredId}」已存在，将使用「${preview.id}」。\n\n是否继续？`,
  );
}

function confirmPathMigration(oldId: string, newId: string): boolean {
  if (oldId === newId) return true;
  return window.confirm(
    `目录路径将从「${oldId}」变更为「${newId}」，下属文档会同步更新。\n\n是否继续？`,
  );
}

export function useFolderActions() {
  const folders = useFoldersStore();
  const documents = useDocumentsStore();

  function createSubfolder(parentId: string, label: string) {
    const trimmed = label.trim();
    if (!trimmed) return null;

    const preview = folders.previewSubfolder(parentId, trimmed);
    if (!preview) return null;
    if (!confirmSlugConflict(preview)) return null;

    const created = folders.addSubfolder(parentId, trimmed);
    if (created) folders.revealFolder(created.id);
    return created;
  }

  async function renameFolder(folderId: string, label: string): Promise<boolean> {
    const trimmed = label.trim();
    if (!trimmed) return false;

    const preview = folders.previewRename(folderId, trimmed);
    if (!preview) return false;

    if (preview.slugAdjusted && !confirmSlugConflict(preview)) return false;
    if (preview.migrated && !confirmPathMigration(preview.oldId, preview.id)) return false;

    const result = folders.renameFolder(folderId, trimmed);
    if (!result) return false;
    if (result.migrated) {
      await documents.migrateFolderPrefix(result.oldId, result.newId);
    }
    folders.revealFolder(result.newId);
    return true;
  }

  return { createSubfolder, renameFolder };
}
