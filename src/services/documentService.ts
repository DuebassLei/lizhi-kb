import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "./vaultService";
import { runConcurrent } from "../utils/readConcurrent";
import { stripAiPrivateBlocks } from "../utils/aiPrivacy";
import { searchDocuments, type SearchHit } from "../utils/documentSearch";
import type {
  DashboardStats,
  DecryptedContent,
  DocumentMeta,
  EditActivityDay,
  PurgeExpiredResult,
  SaveResult,
  TrashedDocumentMeta,
} from "../types/document";

const STORAGE_KEY = "lizhi-kb-data";

interface StoredDocument {
  id: string;
  title: string;
  path: string;
  folder: string;
  createdAt: number;
  updatedAt: number;
  content: string;
  aiExclude?: boolean;
  deletedAt?: number | null;
}

interface LocalData {
  documents: Record<string, StoredDocument>;
  activity: Record<string, number>;
}

function loadLocal(): LocalData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { documents: {}, activity: {} };
    return JSON.parse(raw) as LocalData;
  } catch {
    return { documents: {}, activity: {} };
  }
}

function saveLocal(data: LocalData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return localDateStr(new Date());
}

function countWords(text: string): number {
  return text.replace(/\s+/g, "").length;
}

function toMeta(doc: StoredDocument): DocumentMeta {
  return {
    id: doc.id,
    title: doc.title,
    path: doc.path,
    folder: doc.folder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    aiExclude: doc.aiExclude ?? false,
  };
}

function bumpActivity(data: LocalData): void {
  const today = todayStr();
  data.activity[today] = (data.activity[today] ?? 0) + 1;
}

async function invokeBackend<T>(
  cmd: string,
  args: Record<string, unknown>,
  fallback: () => T,
): Promise<T> {
  if (!isTauriRuntime()) return fallback();
  return tauriInvoke<T>(cmd, args);
}

function localListDocuments(): DocumentMeta[] {
  const data = loadLocal();
  return Object.values(data.documents)
    .filter((doc) => !doc.deletedAt)
    .map(toMeta)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function localCreateDocument(title: string, folder = "inbox"): DocumentMeta {
  const data = loadLocal();
  const id = crypto.randomUUID();
  const now = Date.now();
  const path = `${folder}/${id}.md`;
  const doc: StoredDocument = {
    id,
    title,
    path,
    folder,
    createdAt: now,
    updatedAt: now,
    content: `# ${title}\n\n`,
  };
  data.documents[id] = doc;
  bumpActivity(data);
  saveLocal(data);
  return toMeta(doc);
}

function localReadDocument(id: string): DecryptedContent {
  const data = loadLocal();
  const doc = data.documents[id];
  if (!doc) throw new Error(`Document not found: ${id}`);
  if (doc.deletedAt) throw new Error("文档在回收站中，请先恢复后再打开");
  return { id, content: doc.content };
}

function localRenameDocument(id: string, title: string): void {
  const data = loadLocal();
  const doc = data.documents[id];
  if (!doc) throw new Error(`Document not found: ${id}`);
  doc.title = title.slice(0, 80);
  saveLocal(data);
}

function localSaveDocument(id: string, content: string): SaveResult {
  if (
    typeof localStorage !== "undefined" &&
    localStorage.getItem("lizhi-kb-e2e-save-fail") === "1"
  ) {
    throw new Error("E2E 模拟保存失败");
  }
  const data = loadLocal();
  const doc = data.documents[id];
  if (!doc) throw new Error(`Document not found: ${id}`);
  if (doc.deletedAt) throw new Error("文档在回收站中，请先恢复后再编辑");
  const now = Date.now();
  doc.content = content;
  doc.updatedAt = now;
  bumpActivity(data);
  saveLocal(data);
  return { id, savedAt: now };
}

function localSoftDeleteDocument(id: string): void {
  const data = loadLocal();
  const doc = data.documents[id];
  if (!doc) throw new Error(`Document not found: ${id}`);
  if (doc.deletedAt) return;
  doc.deletedAt = Date.now();
  saveLocal(data);
}

function localPurgeDocument(id: string): void {
  const data = loadLocal();
  delete data.documents[id];
  saveLocal(data);
}

function localListTrashedDocuments(): TrashedDocumentMeta[] {
  const data = loadLocal();
  return Object.values(data.documents)
    .filter((doc): doc is StoredDocument & { deletedAt: number } => !!doc.deletedAt)
    .map((doc) => ({ ...toMeta(doc), deletedAt: doc.deletedAt }))
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

function localRestoreDocument(id: string): DocumentMeta {
  const data = loadLocal();
  const doc = data.documents[id];
  if (!doc) throw new Error(`Document not found: ${id}`);
  if (!doc.deletedAt) throw new Error("文档不在回收站");
  doc.deletedAt = null;
  saveLocal(data);
  return toMeta(doc);
}

function localEmptyTrash(): PurgeExpiredResult {
  const data = loadLocal();
  let purged = 0;
  for (const [id, doc] of Object.entries(data.documents)) {
    if (doc.deletedAt) {
      delete data.documents[id];
      purged += 1;
    }
  }
  saveLocal(data);
  return { purged };
}

function localGetTrashRetentionDays(): number {
  try {
    const raw = localStorage.getItem("lizhi-kb-trash-retention-days");
    if (!raw) return 30;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 30;
    return Math.min(365, Math.max(1, Math.round(n)));
  } catch {
    return 30;
  }
}

function localSetTrashRetentionDays(days: number): number {
  const clamped = Math.min(365, Math.max(1, Math.round(days)));
  localStorage.setItem("lizhi-kb-trash-retention-days", String(clamped));
  return clamped;
}

function localPurgeExpiredDocuments(): PurgeExpiredResult {
  const days = localGetTrashRetentionDays();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const data = loadLocal();
  let purged = 0;
  for (const [id, doc] of Object.entries(data.documents)) {
    if (doc.deletedAt && doc.deletedAt <= cutoff) {
      delete data.documents[id];
      purged += 1;
    }
  }
  saveLocal(data);
  return { purged };
}

function localMoveDocument(id: string, folder: string): DocumentMeta {
  const data = loadLocal();
  const doc = data.documents[id];
  if (!doc) throw new Error(`Document not found: ${id}`);
  doc.folder = folder;
  doc.path = `${folder}/${id}.md`;
  saveLocal(data);
  return toMeta(doc);
}

function localGetEditActivity(days: number): EditActivityDay[] {
  const data = loadLocal();
  const result: EditActivityDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = localDateStr(d);
    result.push({ date, editCount: data.activity[date] ?? 0 });
  }
  return result;
}

function localGetDashboardStats(): DashboardStats {
  const data = loadLocal();
  const docs = Object.values(data.documents).filter((d) => !d.deletedAt);
  const totalWords = docs.reduce((sum, d) => sum + countWords(d.content), 0);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let editsThisWeek = 0;
  for (const [date, count] of Object.entries(data.activity)) {
    if (new Date(date).getTime() >= weekAgo - 86400000) {
      editsThisWeek += count;
    }
  }

  const lastEditDate =
    docs.length > 0
      ? localDateStr(new Date(Math.max(...docs.map((d) => d.updatedAt))))
      : null;

  return {
    totalDocs: docs.length,
    totalWords,
    editsThisWeek,
    lastEditDate,
  };
}

function localMigrateFolderPrefix(oldPrefix: string, newPrefix: string): DocumentMeta[] {
  const data = loadLocal();
  const updated: DocumentMeta[] = [];
  for (const doc of Object.values(data.documents)) {
    if (doc.folder === oldPrefix || doc.folder.startsWith(`${oldPrefix}/`)) {
      doc.folder = newPrefix + doc.folder.slice(oldPrefix.length);
      doc.path = `${doc.folder}/${doc.id}.md`;
      updated.push(toMeta(doc));
    }
  }
  saveLocal(data);
  return updated;
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  return invokeBackend("list_documents", {}, localListDocuments);
}

export async function migrateDocumentsFolderPrefix(
  oldPrefix: string,
  newPrefix: string,
): Promise<DocumentMeta[]> {
  return invokeBackend(
    "migrate_documents_folder",
    { oldPrefix, newPrefix },
    () => localMigrateFolderPrefix(oldPrefix, newPrefix),
  );
}

export async function createDocument(
  title: string,
  folder?: string,
): Promise<DocumentMeta> {
  return invokeBackend(
    "create_document",
    { title, folder: folder ?? null },
    () => localCreateDocument(title, folder ?? "inbox"),
  );
}

export async function readDocument(id: string): Promise<DecryptedContent> {
  return invokeBackend("read_document", { id }, () => localReadDocument(id));
}

function localReadAllDocuments(): DecryptedContent[] {
  const data = loadLocal();
  return Object.values(data.documents)
    .filter((doc) => !doc.deletedAt)
    .map((doc) => ({
      id: doc.id,
      content: doc.content,
    }));
}

/** 批量读取全部文档（Tauri 单次 IPC；浏览器模式本地直读） */
export async function readAllDocuments(): Promise<DecryptedContent[]> {
  return invokeBackend("read_all_documents", {}, localReadAllDocuments);
}

/** 按 id 有限并发读取（用于无 bulk 命令时的回退） */
export async function readDocumentsByIds(
  ids: string[],
  concurrency = 8,
): Promise<DecryptedContent[]> {
  return runConcurrent(ids, (id) => readDocument(id), concurrency);
}

export async function saveDocument(id: string, content: string): Promise<SaveResult> {
  return invokeBackend("save_document", { id, content }, () => localSaveDocument(id, content));
}

export async function renameDocument(id: string, title: string): Promise<void> {
  return invokeBackend(
    "rename_document",
    { id, title },
    () => {
      localRenameDocument(id, title);
    },
  );
}

export async function deleteDocument(id: string): Promise<void> {
  return invokeBackend("delete_document", { id }, () => {
    localSoftDeleteDocument(id);
  });
}

export async function restoreDocument(id: string): Promise<DocumentMeta> {
  return invokeBackend("restore_document", { id }, () => localRestoreDocument(id));
}

export async function purgeDocument(id: string): Promise<void> {
  return invokeBackend("purge_document", { id }, () => {
    localPurgeDocument(id);
  });
}

export async function listTrashedDocuments(): Promise<TrashedDocumentMeta[]> {
  return invokeBackend("list_trashed_documents", {}, () => localListTrashedDocuments());
}

export async function emptyTrash(): Promise<PurgeExpiredResult> {
  return invokeBackend("empty_trash", {}, () => localEmptyTrash());
}

export async function purgeExpiredDocuments(): Promise<PurgeExpiredResult> {
  return invokeBackend("purge_expired_documents", {}, () => localPurgeExpiredDocuments());
}

export async function getTrashRetentionDays(): Promise<number> {
  return invokeBackend("get_trash_retention_days", {}, () => localGetTrashRetentionDays());
}

export async function setTrashRetentionDays(days: number): Promise<number> {
  return invokeBackend("set_trash_retention_days", { days }, () =>
    localSetTrashRetentionDays(days),
  );
}

export async function moveDocumentToFolder(id: string, folder: string): Promise<DocumentMeta> {
  return invokeBackend(
    "move_document",
    { id, folder },
    () => localMoveDocument(id, folder),
  );
}

function localSetDocumentAiExclude(id: string, exclude: boolean): DocumentMeta {
  const data = loadLocal();
  const doc = data.documents[id];
  if (!doc) throw new Error("document not found");
  doc.aiExclude = exclude;
  saveLocal(data);
  return toMeta(doc);
}

function localReadDocumentForAi(id: string): DecryptedContent {
  const data = loadLocal();
  const doc = data.documents[id];
  if (!doc) throw new Error("document not found");
  if (doc.aiExclude) throw new Error("该笔记已禁止提供给 AI");
  return { id: doc.id, content: stripAiPrivateBlocks(doc.content) };
}

function localSearchDocumentsForAi(query: string, limit: number): SearchHit[] {
  const tree = localListDocuments();
  const plainTextMap = Object.fromEntries(
    Object.values(loadLocal().documents).map((d) => [d.id, d.content]),
  );
  return searchDocuments(tree, plainTextMap, query, limit)
    .filter((h) => !tree.find((d) => d.id === h.id)?.aiExclude)
    .map((h) => ({ ...h, snippet: stripAiPrivateBlocks(h.snippet) }));
}

export async function setDocumentAiExclude(id: string, exclude: boolean): Promise<DocumentMeta> {
  return invokeBackend(
    "set_document_ai_exclude",
    { id, exclude },
    () => localSetDocumentAiExclude(id, exclude),
  );
}

export async function readDocumentForAi(id: string): Promise<DecryptedContent> {
  return invokeBackend("read_document_for_ai", { id }, () => localReadDocumentForAi(id));
}

export async function searchDocumentsForAi(query: string, limit = 20): Promise<SearchHit[]> {
  return invokeBackend(
    "search_documents_for_ai",
    { query, limit },
    () => localSearchDocumentsForAi(query, limit),
  );
}

export async function getEditActivity(days: number): Promise<EditActivityDay[]> {
  return invokeBackend("get_edit_activity", { days }, () => localGetEditActivity(days));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return invokeBackend("get_dashboard_stats", {}, localGetDashboardStats);
}

export { countWords };
