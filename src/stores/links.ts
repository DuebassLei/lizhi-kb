import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { readAllDocuments, readDocument, saveDocument } from "../services/documentService";
import { fetchLinkIndexSnapshot } from "../services/knowledgeIndexService";
import { isTauriRuntime } from "../services/vaultService";
import type { DocumentMeta } from "../types/document";
import {
  buildIndexFromContents,
  isIndexComplete,
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

function snapshotMaps(
  outboundMap: Record<string, string[]>,
  backlinkMap: Record<string, LinkMention[]>,
  unlinkedMap: Record<string, LinkMention[]>,
  plainTextMap: Record<string, string>,
  strippedTextMap: Record<string, string>,
  snippetMap: Record<string, string>,
): LinkIndexMaps {
  return {
    outboundMap: { ...outboundMap },
    backlinkMap: Object.fromEntries(
      Object.entries(backlinkMap).map(([k, v]) => [k, [...v]]),
    ),
    unlinkedMap: Object.fromEntries(
      Object.entries(unlinkedMap).map(([k, v]) => [k, [...v]]),
    ),
    plainTextMap: { ...plainTextMap },
    strippedTextMap: { ...strippedTextMap },
    snippetMap: { ...snippetMap },
  };
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
  let ensurePromise: Promise<void> | null = null;

  const indexReady = computed(() => {
    const docs = useDocumentsStore().tree;
    if (!docs.length) return true;
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

  /** 按需加载单篇摘要（悬浮预览等），避免为预览触发全库索引 */
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

  function applyDerived(
    tree: DocumentMeta[],
    maps: LinkIndexMaps,
  ) {
    const derived = recomputeLinkStats(tree, maps.outboundMap, maps.backlinkMap);
    orphanIds.value = derived.orphanIds;
    stats.value = derived.stats;
    topHubs.value = derived.topHubs;
  }

  function trySyncFingerprint(tree: DocumentMeta[]) {
    if (isIndexComplete(tree, plainTextMap.value)) {
      indexedFingerprint.value = treeFingerprint(tree);
    }
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
          orphanIds.value = snap.orphanIds;
          stats.value = snap.stats;
          topHubs.value = snap.topHubs;
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
    } finally {
      indexing.value = false;
    }
  }

  /** 按需全量构建；指纹一致且索引完整时跳过 */
  async function ensureIndex(tree: DocumentMeta[]): Promise<void> {
    const fp = treeFingerprint(tree);
    if (!tree.length) {
      clear();
      indexedFingerprint.value = "";
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

  /** 增量更新单篇（保存/编辑后，无磁盘 IO） */
  function patchDocument(tree: DocumentMeta[], docId: string, content: string) {
    const maps = snapshotMaps(
      outboundMap.value,
      backlinkMap.value,
      unlinkedMap.value,
      plainTextMap.value,
      strippedTextMap.value,
      snippetMap.value,
    );
    patchDocumentIndex(tree, docId, content, maps);
    applyMaps(maps);
    applyDerived(tree, maps);
    trySyncFingerprint(tree);
  }

  /** 增量移除单篇（删除前调用） */
  function removeDocument(tree: DocumentMeta[], docId: string) {
    const maps = snapshotMaps(
      outboundMap.value,
      backlinkMap.value,
      unlinkedMap.value,
      plainTextMap.value,
      strippedTextMap.value,
      snippetMap.value,
    );
    removeDocumentIndex(tree, docId, maps);
    applyMaps(maps);
    const remainingTree = tree.filter((d) => d.id !== docId);
    applyDerived(remainingTree, maps);
    trySyncFingerprint(remainingTree);
  }

  function invalidateIndex() {
    indexedFingerprint.value = "";
  }

  function updatePlainTextForDoc(id: string, content: string) {
    const docs = useDocumentsStore();
    patchDocument(docs.tree, id, content);
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
    ensurePromise = null;
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
    backlinks,
    unlinkedMentions,
    getSnippet,
    getSnippetByTitle,
    ensureSnippetForTitle,
    rebuildIndex,
    ensureIndex,
    patchDocument,
    removeDocument,
    invalidateIndex,
    updatePlainTextForDoc,
    clear,
    convertUnlinkedMention,
  };
});
