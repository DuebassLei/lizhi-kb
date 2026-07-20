import { ref } from "vue";
import { useDocumentsStore } from "../stores/documents";

type PendingKind = "soft" | "purge";

const pending = ref<{ id: string; title: string; kind: PendingKind } | null>(null);

/** 文档删除二次确认（软删 / 永久删除；工作区统一入口，单例状态） */
export function useDocumentDelete() {
  const documents = useDocumentsStore();

  function requestDelete(docId: string) {
    const doc = documents.tree.find((d) => d.id === docId);
    if (!doc) return;
    pending.value = { id: docId, title: doc.title || "无标题", kind: "soft" };
  }

  function requestPurge(docId: string, title?: string) {
    const doc = documents.tree.find((d) => d.id === docId);
    const resolvedTitle = title ?? doc?.title ?? "无标题";
    if (!doc && !title) return;
    pending.value = { id: docId, title: resolvedTitle || "无标题", kind: "purge" };
  }

  /** 回收站内永久删除（文档可能已不在活跃树） */
  function requestPurgeTrashed(docId: string, title: string) {
    pending.value = { id: docId, title: title || "无标题", kind: "purge" };
  }

  async function confirmDelete() {
    if (!pending.value) return;
    const { id, kind } = pending.value;
    pending.value = null;
    if (kind === "purge") {
      await documents.purge(id);
    } else {
      await documents.remove(id);
    }
  }

  function cancelDelete() {
    pending.value = null;
  }

  return {
    pending,
    requestDelete,
    requestPurge,
    requestPurgeTrashed,
    confirmDelete,
    cancelDelete,
  };
}
