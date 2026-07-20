import { ref } from "vue";
import { useDocumentsStore } from "../stores/documents";
import { useFoldersStore } from "../stores/folders";

const pending = ref<{ folderId: string; label: string } | null>(null);

/** 目录删除二次确认（App 级单例） */
export function useFolderDeleteConfirm() {
  const documents = useDocumentsStore();
  const folders = useFoldersStore();

  function requestDelete(folderId: string) {
    const label = folders.folders.find((f) => f.id === folderId)?.label ?? folderId;
    pending.value = { folderId, label };
  }

  async function confirmDelete() {
    if (!pending.value) return;
    const { folderId } = pending.value;
    pending.value = null;
    const result = folders.deleteFolder(folderId);
    if (!result) return;
    for (const doc of documents.tree) {
      if (result.removeIds.includes(folders.normalizeFolder(doc.folder))) {
        await documents.moveToFolder(doc.id, result.moveDocsTo);
      }
    }
  }

  function cancelDelete() {
    pending.value = null;
  }

  return {
    pending,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}
