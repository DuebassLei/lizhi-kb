import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "./vaultService";
import { runConcurrent } from "../utils/readConcurrent";
import { extractH1Title } from "../utils/documentTitle";
import type {
  DashboardStats,
  DecryptedContent,
  DocumentMeta,
  EditActivityDay,
  SaveResult,
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

function extractTitle(content: string, fallback: string): string {
  return extractH1Title(content) ?? fallback;
}

function toMeta(doc: StoredDocument): DocumentMeta {
  return {
    id: doc.id,
    title: doc.title,
    path: doc.path,
    folder: doc.folder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
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
  const now = Date.now();
  doc.content = content;
  doc.title = extractTitle(content, doc.title);
  doc.updatedAt = now;
  bumpActivity(data);
  saveLocal(data);
  return { id, savedAt: now };
}

function localDeleteDocument(id: string): void {
  const data = loadLocal();
  delete data.documents[id];
  saveLocal(data);
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
  const docs = Object.values(data.documents);
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
  return Object.values(data.documents).map((doc) => ({
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
    localDeleteDocument(id);
  });
}

export async function moveDocumentToFolder(id: string, folder: string): Promise<DocumentMeta> {
  return invokeBackend(
    "move_document",
    { id, folder },
    () => localMoveDocument(id, folder),
  );
}

export async function getEditActivity(days: number): Promise<EditActivityDay[]> {
  return invokeBackend("get_edit_activity", { days }, () => localGetEditActivity(days));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return invokeBackend("get_dashboard_stats", {}, localGetDashboardStats);
}

export { countWords };
