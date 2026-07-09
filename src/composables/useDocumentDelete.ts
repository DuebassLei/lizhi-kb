import { ref } from "vue";
import { useDocumentsStore } from "../stores/documents";

const pending = ref<{ id: string; title: string } | null>(null);

/** 文档删除二次确认（工作区统一入口，单例状态） */
export function useDocumentDelete() {
  const documents = useDocumentsStore();

  function requestDelete(docId: string) {
    const doc = documents.tree.find((d) => d.id === docId);
    if (!doc) return;
    pending.value = { id: docId, title: doc.title || "无标题" };
  }

  async function confirmDelete() {
    if (!pending.value) return;
    const { id } = pending.value;
    pending.value = null;
    await documents.remove(id);
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
