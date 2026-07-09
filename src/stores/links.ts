import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { readAllDocuments, readDocument, saveDocument } from "../services/documentService";
import {
  fetchDocumentBacklinks,
  fetchDocumentOutboundTitles,
  fetchDocumentUnlinkedMentions,
  fetchLinkIndexSnapshot,
  fetchLinkInsights,
} from "../services/knowledgeIndexService";
import { isTauriRuntime } from "../services/vaultService";
import type { DocumentMeta } from "../types/document";
import {
  buildIndexFromContents,
  isIndexComplete,
  isLinkGraphComplete,
  patchDocumentIndex,
  removeDocumentIndex,
  recomputeLinkStats,
  type HubRank,
  type LinkIndexMaps,
  type LinkMention,
  type LinkStats,
} from "../utils/linkIndexOps";
import { normalizeTitle } from "../utils/wikiLinks";
import { useDocumentsStore } from "./documents";

export type { HubRank, LinkMention, LinkStats };

function treeFingerprint(tree: DocumentMeta[]): string {
  if (!tree.length) return "";
  return [...tree]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => `${d.id}:${d.updatedAt}`)
    .join("\n");
}

export const useLinksStore = defineStore("links", () => {
  const backlinkMap = ref<Record<string, LinkMention[]>>({});
  const unlinkedMap = ref<Record<string, LinkMention[]>>({});
  const outboundMap = ref<Record<string, string[]>>({});
  const snippetMap = ref<Record<string, string>>({});
  const plainTextMap = ref<Record<string, string>>({});
  const strippedTextMap = ref<Record<string, string>>({});
  const orphanIds = ref<string[]>([]);
  const stats = ref<LinkStats>({ totalLinks: 0, orphanCount: 0, hubDoc: null });
  const topHubs = ref<HubRank[]>([]);
  const indexing = ref(false);
  const indexedFingerprint = ref("");
  const linkInsightsLoaded = ref(false);
  let ensurePromise: Promise<void> | null = null;
  let activeDocLinksPromise: Promise<void> | null = null;
  let activeDocLinksId = "";

  function liveMaps(): LinkIndexMaps {
    return {
      outboundMap: outboundMap.value,
      backlinkMap: backlinkMap.value,
      unlinkedMap: unlinkedMap.value,
      plainTextMap: plainTextMap.value,
      strippedTextMap: strippedTextMap.value,
      snippetMap: snippetMap.value,
    };
  }

  function isStoreIndexComplete(tree: DocumentMeta[]): boolean {
    if (isTauriRuntime()) {
      return isLinkGraphComplete(tree, outboundMap.value);
    }
    return isIndexComplete(tree, plainTextMap.value);
  }

  const indexReady = computed(() => {
    const docs = useDocumentsStore().tree;
    if (!docs.length) return true;
    if (isTauriRuntime()) {
      return linkInsightsLoaded.value && !indexing.value;
    }
    return (
      isIndexComplete(docs, plainTextMap.value) &&
      treeFingerprint(docs) === indexedFingerprint.value &&
      !indexing.value
    );
  });

  const backlinks = computed(() => {
    const docs = useDocumentsStore();
    if (!docs.activeId) return [];
    return backlinkMap.value[docs.activeId] ?? [];
  });

  const unlinkedMentions = computed(() => {
    const docs = useDocumentsStore();
    if (!docs.activeId) return [];
    return unlinkedMap.value[docs.activeId] ?? [];
  });

  function getSnippet(id: string): string {
    return snippetMap.value[id] ?? "";
  }

  function getSnippetByTitle(title: string): string | null {
    const docs = useDocumentsStore();
    const norm = normalizeTitle(title);
    const doc = docs.tree.find((d) => normalizeTitle(d.title) === norm);
    if (!doc) return null;
    return snippetMap.value[doc.id] ?? null;
  }

  async function ensureSnippetForTitle(title: string): Promise<string | null> {
    const docs = useDocumentsStore();
    const norm = normalizeTitle(title);
    const doc = docs.tree.find((d) => normalizeTitle(d.title) === norm);
    if (!doc) return null;

    const cached = snippetMap.value[doc.id];
    if (cached) return cached;

    const content =
      docs.activeId === doc.id
        ? docs.content
        : (await readDocument(doc.id)).content;
    patchDocument(docs.tree, doc.id, content);
    return snippetMap.value[doc.id] ?? null;
  }

  function applyMaps(maps: LinkIndexMaps) {
    outboundMap.value = maps.outboundMap;
    backlinkMap.value = maps.backlinkMap;
    unlinkedMap.value = maps.unlinkedMap;
    plainTextMap.value = maps.plainTextMap;
    strippedTextMap.value = maps.strippedTextMap;
    snippetMap.value = maps.snippetMap;
  }

  function applyDerived(tree: DocumentMeta[], maps: LinkIndexMaps) {
    const derived = recomputeLinkStats(tree, maps.outboundMap, maps.backlinkMap);
    orphanIds.value = derived.orphanIds;
    stats.value = derived.stats;
    topHubs.value = derived.topHubs;
  }

  function applyLinkInsights(payload: {
    orphanIds: string[];
    stats: LinkStats;
    topHubs: HubRank[];
  }) {
    orphanIds.value = payload.orphanIds;
    stats.value = payload.stats;
    topHubs.value = payload.topHubs;
    linkInsightsLoaded.value = true;
  }

  function trySyncFingerprint(tree: DocumentMeta[]) {
    if (isStoreIndexComplete(tree)) {
      indexedFingerprint.value = treeFingerprint(tree);
    }
  }

  async function syncActiveDocLinksFromRust(docId: string): Promise<void> {
    if (!isTauriRuntime() || !docId) return;

    const [backlinks, unlinked, outbound] = await Promise.all([
      fetchDocumentBacklinks(docId),
      fetchDocumentUnlinkedMentions(docId),
      fetchDocumentOutboundTitles(docId),
    ]);

    if (backlinks.length) backlinkMap.value[docId] = backlinks;
    else delete backlinkMap.value[docId];

    if (unlinked.length) unlinkedMap.value[docId] = unlinked;
    else delete unlinkedMap.value[docId];

    outboundMap.value[docId] = outbound;
  }

  async function ensureActiveDocLinks(docId: string): Promise<void> {
    if (!docId) return;

    if (!isTauriRuntime()) {
      await ensureIndex(useDocumentsStore().tree);
      return;
    }

    if (activeDocLinksId === docId && activeDocLinksPromise) {
      return activeDocLinksPromise;
    }

    activeDocLinksId = docId;
    activeDocLinksPromise = syncActiveDocLinksFromRust(docId).finally(() => {
      activeDocLinksPromise = null;
    });
    return activeDocLinksPromise;
  }

  async function ensureLinkInsights(): Promise<void> {
    const tree = useDocumentsStore().tree;
    if (!tree.length) {
      orphanIds.value = [];
      stats.value = { totalLinks: 0, orphanCount: 0, hubDoc: null };
      topHubs.value = [];
      linkInsightsLoaded.value = true;
      return;
    }

    if (!isTauriRuntime()) {
      await ensureIndex(tree);
      return;
    }

    if (linkInsightsLoaded.value && !indexing.value) return;
    if (ensurePromise) return ensurePromise;

    indexing.value = true;
    ensurePromise = fetchLinkInsights()
      .then((payload) => {
        if (payload) applyLinkInsights(payload);
        indexedFingerprint.value = treeFingerprint(tree);
      })
      .finally(() => {
        indexing.value = false;
        ensurePromise = null;
      });
    return ensurePromise;
  }

  async function rebuildIndex(tree: DocumentMeta[]) {
    if (!tree.length) {
      clear();
      return;
    }

    indexing.value = true;
    try {
      if (isTauriRuntime()) {
        const snap = await fetchLinkIndexSnapshot();
        if (snap) {
          applyMaps(snap);
          applyLinkInsights(snap);
          return;
        }
      }

      const decrypted = await readAllDocuments();
      const byId = new Map(decrypted.map((d) => [d.id, d.content]));
      const contents = tree.map((d) => ({
        id: d.id,
        title: d.title,
        content: byId.get(d.id) ?? "",
      }));

      const built = buildIndexFromContents(tree, contents);
      applyMaps(built);
      orphanIds.value = built.orphanIds;
      stats.value = built.stats;
      topHubs.value = built.topHubs;
      linkInsightsLoaded.value = true;
    } finally {
      indexing.value = false;
    }
  }

  async function ensureIndex(tree: DocumentMeta[]): Promise<void> {
    const fp = treeFingerprint(tree);
    if (!tree.length) {
      clear();
      indexedFingerprint.value = "";
      return;
    }

    if (isTauriRuntime()) {
      await ensureLinkInsights();
      return;
    }

    if (isIndexComplete(tree, plainTextMap.value) && fp === indexedFingerprint.value && !indexing.value) {
      return;
    }
    if (ensurePromise) return ensurePromise;

    ensurePromise = rebuildIndex(tree)
      .then(() => {
        indexedFingerprint.value = fp;
      })
      .finally(() => {
        ensurePromise = null;
      });
    return ensurePromise;
  }

  function patchDocument(tree: DocumentMeta[], docId: string, content: string) {
    const maps = liveMaps();
    patchDocumentIndex(tree, docId, content, maps);
    if (!isTauriRuntime()) {
      applyDerived(tree, maps);
    }
    trySyncFingerprint(tree);
  }

  function removeDocument(tree: DocumentMeta[], docId: string) {
    const maps = liveMaps();
    removeDocumentIndex(tree, docId, maps);
    const remainingTree = tree.filter((d) => d.id !== docId);
    if (!isTauriRuntime()) {
      applyDerived(remainingTree, maps);
    } else {
      delete backlinkMap.value[docId];
      delete unlinkedMap.value[docId];
      delete outboundMap.value[docId];
      linkInsightsLoaded.value = false;
    }
    trySyncFingerprint(remainingTree);
  }

  function invalidateIndex() {
    indexedFingerprint.value = "";
    linkInsightsLoaded.value = false;
    activeDocLinksId = "";
  }

  async function updatePlainTextForDoc(id: string, content: string) {
    const docs = useDocumentsStore();
    patchDocument(docs.tree, id, content);
    if (isTauriRuntime()) {
      await syncActiveDocLinksFromRust(id);
    }
  }

  function clear() {
    backlinkMap.value = {};
    unlinkedMap.value = {};
    outboundMap.value = {};
    snippetMap.value = {};
    plainTextMap.value = {};
    strippedTextMap.value = {};
    orphanIds.value = [];
    stats.value = { totalLinks: 0, orphanCount: 0, hubDoc: null };
    topHubs.value = [];
    indexedFingerprint.value = "";
    linkInsightsLoaded.value = false;
    activeDocLinksId = "";
    ensurePromise = null;
    activeDocLinksPromise = null;
  }

  async function convertUnlinkedMention(sourceId: string, targetTitle: string) {
    const docs = useDocumentsStore();
    const targetNorm = normalizeTitle(targetTitle);
    const targetDoc = docs.tree.find((d) => normalizeTitle(d.title) === targetNorm);
    if (!targetDoc) return;

    const content =
      docs.activeId === sourceId
        ? docs.content
        : (await readDocument(sourceId)).content;
    const escaped = targetTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<!\\[\\[)${escaped}(?!\\]\\])`, "g");
    const updated = content.replace(re, `[[${targetDoc.title}]]`);
    if (updated === content) return;

    await saveDocument(sourceId, updated);
    if (docs.activeId === sourceId) {
      docs.updateContent(updated);
    }
    patchDocument(docs.tree, sourceId, updated);
    if (isTauriRuntime()) {
      await Promise.all([
        syncActiveDocLinksFromRust(sourceId),
        docs.activeId ? syncActiveDocLinksFromRust(docs.activeId) : Promise.resolve(),
      ]);
      linkInsightsLoaded.value = false;
    }
  }

  return {
    backlinkMap,
    unlinkedMap,
    outboundMap,
    snippetMap,
    plainTextMap,
    strippedTextMap,
    orphanIds,
    stats,
    topHubs,
    indexing,
    indexReady,
    linkInsightsLoaded,
    backlinks,
    unlinkedMentions,
    getSnippet,
    getSnippetByTitle,
    ensureSnippetForTitle,
    rebuildIndex,
    ensureIndex,
    ensureActiveDocLinks,
    ensureLinkInsights,
    syncActiveDocLinksFromRust,
    patchDocument,
    removeDocument,
    invalidateIndex,
    updatePlainTextForDoc,
    clear,
    convertUnlinkedMention,
  };
});
