import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";

export interface RevisionMeta {
  id: string;
  createdAt: number;
  sizeBytes: number;
}

export async function listDocumentRevisions(docId: string): Promise<RevisionMeta[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<RevisionMeta[]>("list_document_revisions", { docId });
}

export async function readDocumentRevision(docId: string, revisionId: string): Promise<string> {
  return tauriInvoke<string>("read_document_revision", { docId, revisionId });
}
