import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  countWords,
  createDocument,
  deleteDocument,
  getDashboardStats,
  getEditActivity,
  listDocuments,
  migrateDocumentsFolderPrefix,
  moveDocumentToFolder,
  readDocument,
  renameDocument,
  saveDocument,
} from "../services/documentService";
import { extractH1Title, syncTitleInContent } from "../utils/documentTitle";
import { isMarkdownFile, readFileAsText, titleFromFileName } from "../utils/importMarkdown";
import type { DashboardStats, DocumentMeta, EditActivityDay } from "../types/document";
import { loadWorkspaceSession, saveWorkspaceSession } from "../utils/workspaceSession";
import { loadPinnedIds, savePinnedIds, togglePinnedId } from "../utils/pinnedDocs";
import { loadRecentDocIds, touchRecentDocId } from "../utils/recentDocs";
import { docHasWikiLinkTo, isIndexComplete } from "../utils/linkIndexOps";
import { replaceWikiLinkTitle } from "../utils/wikiLinkQuery";
import { normalizeTitle } from "../utils/wikiLinks";
import { useEditorStore } from "./editor";
import { useLinksStore } from "./links";
import { useFoldersStore } from "./folders";
import { useUiStore } from "./ui";
import { useVaultStore } from "./vault";

export const useDocumentsStore = defineStore("documents", () => {
  const tree = ref<DocumentMeta[]>([]);
  const activeId = ref<string | null>(null);
  const content = ref("");
  const loading = ref(false);
  const error = ref<string | null>(null);
  const stats = ref<DashboardStats | null>(null);
  const editActivity = ref<EditActivityDay[]>([]);
  const navStack = ref<string[]>([]);
  const pinnedIds = ref<string[]>(loadPinnedIds());
  const recentIds = ref<string[]>(loadRecentDocIds());

  let fetchTreeInflight: Promise<void> | null = null;

  function persistSession() {
    const ui = useUiStore();
    const editor = useEditorStore();
    saveWorkspaceSession({
      activeId: activeId.value,
      workspaceViewMode: ui.workspaceViewMode,
      editorMode: editor.mode,
    });
  }

  async function restoreWorkspaceSession() {
    const session = loadWorkspaceSession();
    const ui = useUiStore();
    const editor = useEditorStore();

    ui.setWorkspaceView(session.workspaceViewMode);
    if (session.editorMode === "preview") {
      ui.setSplitPreview(true);
    }
    editor.mode = "edit";

    if (session.activeId && tree.value.some((d) => d.id === session.activeId)) {
      await openDocument(session.activeId, { pushHistory: false });
    }
  }

  async function fetchTree() {
    if (fetchTreeInflight) return fetchTreeInflight;

    fetchTreeInflight = (async () => {
      error.value = null;
      pinnedIds.value = loadPinnedIds();
      useFoldersStore().load();
      try {
        tree.value = await listDocuments();
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
      }
    })().finally(() => {
      fetchTreeInflight = null;
    });

    return fetchTreeInflight;
  }

  async function fetchDashboard() {
    const [s, activity] = await Promise.all([
      getDashboardStats(),
      getEditActivity(365),
    ]);
    stats.value = s;
    editActivity.value = activity;
  }

  async function loadContent(id: string) {
    loading.value = true;
    error.value = null;
    const editor = useEditorStore();
    try {
      const doc = await readDocument(id);
      content.value = doc.content;
      editor.isDirty = false;
      editor.wordCount = countWords(doc.content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("VAULT_LOCKED")) {
        error.value = "库已锁定，请重新解锁后再打开文档";
      } else if (/document not found/i.test(msg)) {
        error.value = `文档不存在或正文文件已丢失（${id}）`;
      } else {
        error.value = msg;
      }
    } finally {
      loading.value = false;
    }
  }

  async function openDocument(id: string, options: { pushHistory?: boolean } = {}) {
    const { pushHistory = true } = options;
    if (pushHistory && activeId.value && activeId.value !== id) {
      navStack.value.push(activeId.value);
      if (navStack.value.length > 30) navStack.value.shift();
    }
    activeId.value = id;
    recentIds.value = touchRecentDocId(id);
    persistSession();
    const meta = tree.value.find((d) => d.id === id);
    if (meta) {
      const folders = useFoldersStore();
      folders.revealFolder(meta.folder);
      folders.selectFolder(meta.folder);
    }
    await loadContent(id);
  }

  async function create(title = "无标题", folder?: string) {
    error.value = null;
    const folders = useFoldersStore();
    const targetFolder = folders.normalizeFolder(folder ?? folders.selectedFolderId);
    try {
      const meta = await createDocument(title, targetFolder);
      tree.value = [meta, ...tree.value];
      folders.onDocumentMoved(meta.id, "", targetFolder);
      useLinksStore().patchDocument(tree.value, meta.id, "");
      await openDocument(meta.id);
      return meta;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }

  async function importMarkdownFiles(files: File[], folderId?: string): Promise<DocumentMeta[]> {
    const vault = useVaultStore();
    if (vault.needsUnlock) {
      throw new Error("请先解锁知识库后再导入文档");
    }

    const mdFiles = files.filter(isMarkdownFile);
    if (mdFiles.length === 0) {
      throw new Error("请拖入 Markdown 文件（.md / .markdown / .txt）");
    }

    error.value = null;
    const folders = useFoldersStore();
    const targetFolder = folders.normalizeFolder(folderId ?? folders.selectedFolderId);
    const imported: DocumentMeta[] = [];

    try {
      for (const file of mdFiles) {
        const content = await readFileAsText(file);
        const fallbackTitle = titleFromFileName(file.name);
        const title = extractH1Title(content) ?? fallbackTitle;
        const meta = await createDocument(title, targetFolder);
        const saved = await saveDocument(meta.id, content);
        const finalTitle = extractH1Title(content) ?? title;
        const finalMeta: DocumentMeta = {
          ...meta,
          title: finalTitle,
          updatedAt: saved.savedAt,
        };
        tree.value = [finalMeta, ...tree.value];
        folders.onDocumentMoved(finalMeta.id, "", targetFolder);
        useLinksStore().patchDocument(tree.value, finalMeta.id, content);
        imported.push(finalMeta);
      }

      folders.setExpanded(targetFolder, true);
      folders.selectFolder(targetFolder);
      await openDocument(imported[imported.length - 1].id);
      return imported;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }

  async function moveToFolder(docId: string, folderId: string) {
    const doc = tree.value.find((d) => d.id === docId);
    if (!doc) return;
    const folders = useFoldersStore();
    const from = folders.normalizeFolder(doc.folder);
    const to = folders.normalizeFolder(folderId);
    if (from === to) return;

    const meta = await moveDocumentToFolder(docId, to);
    patchMeta(docId, { title: meta.title, updatedAt: meta.updatedAt });
    const idx = tree.value.findIndex((d) => d.id === docId);
    if (idx >= 0) {
      tree.value[idx] = { ...tree.value[idx], folder: to, path: meta.path };
    }
    useFoldersStore().onDocumentMoved(docId, from, to);
  }

  async function migrateFolderPrefix(oldPrefix: string, newPrefix: string) {
    const updated = await migrateDocumentsFolderPrefix(oldPrefix, newPrefix);
    for (const meta of updated) {
      patchMeta(meta.id, { folder: meta.folder, path: meta.path });
    }
  }

  async function saveContent(value: string) {
    if (!activeId.value) return;
    const result = await saveDocument(activeId.value, value);
    content.value = value;
    patchMeta(activeId.value, { updatedAt: result.savedAt });
    const h1Title = extractH1Title(value);
    if (h1Title) patchMeta(activeId.value, { title: h1Title });
    await useLinksStore().updatePlainTextForDoc(activeId.value, value);
  }

  async function remove(id: string) {
    useLinksStore().removeDocument(tree.value, id);
    await deleteDocument(id);
    tree.value = tree.value.filter((d) => d.id !== id);
    navStack.value = navStack.value.filter((nid) => nid !== id);
    if (pinnedIds.value.includes(id)) {
      pinnedIds.value = pinnedIds.value.filter((pid) => pid !== id);
      savePinnedIds(pinnedIds.value);
    }
    if (activeId.value === id) clearActive();
    useFoldersStore().onDocumentRemoved(id);
  }

  function setActive(id: string) {
    void openDocument(id);
  }

  function clearActive() {
    activeId.value = null;
    content.value = "";
    useEditorStore().clear();
    persistSession();
  }

  function updateContent(value: string) {
    content.value = value;
  }

  function patchMeta(
    id: string,
    patch: Partial<Pick<DocumentMeta, "title" | "updatedAt" | "folder" | "path">>,
  ) {
    const idx = tree.value.findIndex((d) => d.id === id);
    if (idx >= 0) {
      tree.value[idx] = { ...tree.value[idx], ...patch };
    }
  }

  function findIdByTitle(title: string): string | undefined {
    const norm = normalizeTitle(title);
    return tree.value.find((d) => normalizeTitle(d.title) === norm)?.id;
  }

  async function openWikiLink(title: string, options: { pushHistory?: boolean } = {}) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const existing = findIdByTitle(trimmed);
    if (existing) {
      await openDocument(existing, options);
      return;
    }
    const meta = await create(trimmed);
    if (options.pushHistory === false) {
      navStack.value.pop();
    }
    return meta;
  }

  function openDocumentInNewTab(id: string) {
    const url = `${window.location.origin}/workspace?doc=${encodeURIComponent(id)}`;
    window.open(url, "_blank", "noopener");
  }

  async function openWikiLinkInNewTab(title: string) {
    const id = findIdByTitle(title);
    if (id) {
      openDocumentInNewTab(id);
      return;
    }
    const meta = await create(title.trim());
    openDocumentInNewTab(meta.id);
  }

  function navigateBack() {
    const prev = navStack.value.pop();
    if (prev) void openDocument(prev, { pushHistory: false });
  }

  function isPinned(id: string): boolean {
    return pinnedIds.value.includes(id);
  }

  function togglePin(id: string) {
    pinnedIds.value = togglePinnedId(id);
  }

  const pinnedDocs = computed(() => {
    const map = new Map(tree.value.map((d) => [d.id, d]));
    return pinnedIds.value.map((id) => map.get(id)).filter(Boolean) as DocumentMeta[];
  });

  async function renameTitle(id: string, newTitle: string) {
    const title = newTitle.trim().slice(0, 80) || "无标题";
    const oldTitle = tree.value.find((d) => d.id === id)?.title ?? "";
    patchMeta(id, { title });
    await renameDocument(id, title);

    if (oldTitle && oldTitle !== title) {
      await propagateWikiLinkRename(oldTitle, title);
    }

    if (activeId.value === id) {
      const updated = syncTitleInContent(content.value, oldTitle, title);
      if (updated !== content.value) {
        content.value = updated;
        await saveContent(updated);
      } else if (oldTitle !== title) {
        useLinksStore().patchDocument(tree.value, id, content.value);
      }
      useEditorStore().isDirty = false;
      return;
    }

    try {
      const body = await resolveDocumentContent(id);
      useLinksStore().patchDocument(tree.value, id, body);
    } catch {
      // ignore unreadable docs
    }
  }

  async function resolveDocumentContent(id: string): Promise<string> {
    if (activeId.value === id) return content.value;
    return (await readDocument(id)).content;
  }

  async function propagateWikiLinkRename(oldTitle: string, newTitle: string) {
    const links = useLinksStore();
    const canSkipByIndex = isIndexComplete(tree.value, links.plainTextMap);

    for (const doc of tree.value) {
      if (doc.id === activeId.value && content.value) {
        const updated = replaceWikiLinkTitle(content.value, oldTitle, newTitle);
        if (updated !== content.value) {
          content.value = updated;
          await saveDocument(doc.id, updated);
          links.patchDocument(tree.value, doc.id, updated);
        }
        continue;
      }

      if (canSkipByIndex && !docHasWikiLinkTo(links.outboundMap[doc.id], oldTitle)) {
        continue;
      }

      try {
        const body = await resolveDocumentContent(doc.id);
        const updated = replaceWikiLinkTitle(body, oldTitle, newTitle);
        if (updated === body) continue;
        await saveDocument(doc.id, updated);
        links.patchDocument(tree.value, doc.id, updated);
      } catch {
        // skip unreadable docs
      }
    }
  }

  const recentDocs = computed(() => {
    const map = new Map(tree.value.map((d) => [d.id, d]));
    return recentIds.value.map((id) => map.get(id)).filter(Boolean) as DocumentMeta[];
  });
  const canGoBack = computed(() => navStack.value.length > 0);

  function reloadLocalDocPrefs() {
    pinnedIds.value = loadPinnedIds();
    recentIds.value = loadRecentDocIds();
  }

  return {
    tree,
    activeId,
    content,
    loading,
    error,
    stats,
    editActivity,
    navStack,
    canGoBack,
    pinnedIds,
    pinnedDocs,
    fetchTree,
    fetchDashboard,
    create,
    importMarkdownFiles,
    moveToFolder,
    migrateFolderPrefix,
    loadContent,
    openDocument,
    saveContent,
    remove,
    setActive,
    clearActive,
    updateContent,
    patchMeta,
    findIdByTitle,
    openWikiLink,
    openDocumentInNewTab,
    openWikiLinkInNewTab,
    navigateBack,
    isPinned,
    togglePin,
    renameTitle,
    resolveDocumentContent,
    restoreWorkspaceSession,
    persistSession,
    recentDocs,
    reloadLocalDocPrefs,
  };
});
