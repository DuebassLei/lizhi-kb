import type { DocumentMeta } from "../types/document";
import { contentSnippet, markdownToPlainText } from "./textMatch";
import { extractWikiLinks, normalizeTitle } from "./wikiLinks";

export interface LinkMention {
  id: string;
  title: string;
}

export interface HubRank {
  id: string;
  title: string;
  inbound: number;
  outbound: number;
}

export interface LinkStats {
  totalLinks: number;
  orphanCount: number;
  hubDoc: { id: string; title: string; inbound: number } | null;
}

export interface LinkIndexMaps {
  outboundMap: Record<string, string[]>;
  backlinkMap: Record<string, LinkMention[]>;
  unlinkedMap: Record<string, LinkMention[]>;
  plainTextMap: Record<string, string>;
  strippedTextMap: Record<string, string>;
  snippetMap: Record<string, string>;
}

const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export function stripWikiLinks(content: string): string {
  return content.replace(WIKI_LINK_RE, "");
}

export function buildTitleToId(tree: DocumentMeta[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of tree) {
    map.set(normalizeTitle(d.title), d.id);
  }
  return map;
}

function mentionsTitle(stripped: string, title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  return stripped.includes(t) || stripped.toLowerCase().includes(t.toLowerCase());
}

export function docHasWikiLinkTo(
  outbound: string[] | undefined,
  oldTitle: string,
): boolean {
  if (!outbound?.length) return false;
  const oldNorm = normalizeTitle(oldTitle);
  return outbound.some((t) => normalizeTitle(t) === oldNorm);
}

export function isIndexComplete(tree: DocumentMeta[], plainTextMap: Record<string, string>): boolean {
  if (!tree.length) return true;
  return tree.every((d) => d.id in plainTextMap);
}

/** 链接图索引是否已覆盖全库（Tauri 轻量模式用 outboundMap 判断） */
export function isLinkGraphComplete(
  tree: DocumentMeta[],
  outboundMap: Record<string, string[]>,
): boolean {
  if (!tree.length) return true;
  return tree.every((d) => d.id in outboundMap);
}

export function recomputeLinkStats(
  tree: DocumentMeta[],
  outboundMap: Record<string, string[]>,
  backlinkMap: Record<string, LinkMention[]>,
): { orphanIds: string[]; stats: LinkStats; topHubs: HubRank[] } {
  const orphans: string[] = [];
  const hubs: HubRank[] = [];
  let hub: LinkStats["hubDoc"] = null;
  let maxInbound = 0;
  let totalLinks = 0;

  for (const doc of tree) {
    const out = outboundMap[doc.id]?.length ?? 0;
    const inCount = backlinkMap[doc.id]?.length ?? 0;
    totalLinks += out;
    if (out === 0 && inCount === 0) orphans.push(doc.id);
    if (inCount > 0 || out > 0) {
      hubs.push({ id: doc.id, title: doc.title, inbound: inCount, outbound: out });
    }
    if (inCount > maxInbound) {
      maxInbound = inCount;
      hub = { id: doc.id, title: doc.title, inbound: inCount };
    }
  }

  hubs.sort((a, b) => b.inbound - a.inbound || b.outbound - a.outbound);

  return {
    orphanIds: orphans,
    stats: {
      totalLinks,
      orphanCount: orphans.length,
      hubDoc: maxInbound > 0 ? hub : null,
    },
    topHubs: hubs.slice(0, 5),
  };
}

function syncUnlinkedForDoc(
  tree: DocumentMeta[],
  docId: string,
  docTitle: string,
  stripped: string,
  maps: LinkIndexMaps,
) {
  const sourceMention: LinkMention = { id: docId, title: docTitle };

  for (const target of tree) {
    if (target.id === docId) continue;
    const shouldInclude = mentionsTitle(stripped, target.title);
    const list = maps.unlinkedMap[target.id] ?? [];
    const has = list.some((m) => m.id === docId);
    if (shouldInclude && !has) {
      maps.unlinkedMap[target.id] = [...list, sourceMention];
    } else if (!shouldInclude && has) {
      const next = list.filter((m) => m.id !== docId);
      if (next.length) maps.unlinkedMap[target.id] = next;
      else delete maps.unlinkedMap[target.id];
    }
  }

  const mentions: LinkMention[] = [];
  const titleNorm = docTitle.trim();
  if (titleNorm) {
    for (const other of tree) {
      if (other.id === docId) continue;
      const otherStripped = maps.strippedTextMap[other.id];
      if (!otherStripped) continue;
      if (mentionsTitle(otherStripped, docTitle)) {
        mentions.push({ id: other.id, title: other.title });
      }
    }
  }
  if (mentions.length) maps.unlinkedMap[docId] = mentions;
  else delete maps.unlinkedMap[docId];
}

/** 增量更新单篇文档的链接索引（无磁盘 IO） */
export function patchDocumentIndex(
  tree: DocumentMeta[],
  docId: string,
  content: string,
  maps: LinkIndexMaps,
): void {
  const doc = tree.find((d) => d.id === docId);
  if (!doc) return;

  const titleToId = buildTitleToId(tree);
  const oldOutbound = maps.outboundMap[docId] ?? [];
  const newOutbound = extractWikiLinks(content);
  const plain = markdownToPlainText(content);
  const stripped = stripWikiLinks(content);

  maps.plainTextMap[docId] = plain;
  maps.strippedTextMap[docId] = stripped;
  maps.snippetMap[docId] = contentSnippet(content);
  maps.outboundMap[docId] = newOutbound;

  for (const targetTitle of oldOutbound) {
    const targetId = titleToId.get(normalizeTitle(targetTitle));
    if (!targetId || targetId === docId) continue;
    const list = maps.backlinkMap[targetId];
    if (!list) continue;
    const next = list.filter((m) => m.id !== docId);
    if (next.length) maps.backlinkMap[targetId] = next;
    else delete maps.backlinkMap[targetId];
  }

  const mention: LinkMention = { id: docId, title: doc.title };
  for (const targetTitle of newOutbound) {
    const targetId = titleToId.get(normalizeTitle(targetTitle));
    if (!targetId || targetId === docId) continue;
    const list = maps.backlinkMap[targetId] ?? [];
    if (!list.some((m) => m.id === docId)) {
      maps.backlinkMap[targetId] = [...list, mention];
    }
  }

  syncUnlinkedForDoc(tree, docId, doc.title, stripped, maps);
}

/** 从索引中移除文档（删除前调用，tree 仍含该文档） */
export function removeDocumentIndex(
  tree: DocumentMeta[],
  docId: string,
  maps: LinkIndexMaps,
): void {
  const titleToId = buildTitleToId(tree);
  const outbound = maps.outboundMap[docId] ?? [];

  for (const targetTitle of outbound) {
    const targetId = titleToId.get(normalizeTitle(targetTitle));
    if (!targetId) continue;
    const list = maps.backlinkMap[targetId];
    if (!list) continue;
    const next = list.filter((m) => m.id !== docId);
    if (next.length) maps.backlinkMap[targetId] = next;
    else delete maps.backlinkMap[targetId];
  }

  delete maps.backlinkMap[docId];

  for (const key of Object.keys(maps.unlinkedMap)) {
    const next = maps.unlinkedMap[key].filter((m) => m.id !== docId);
    if (next.length) maps.unlinkedMap[key] = next;
    else delete maps.unlinkedMap[key];
  }

  delete maps.outboundMap[docId];
  delete maps.plainTextMap[docId];
  delete maps.strippedTextMap[docId];
  delete maps.snippetMap[docId];
}

export function buildIndexFromContents(
  tree: DocumentMeta[],
  contents: Array<{ id: string; title: string; content: string }>,
): LinkIndexMaps & { orphanIds: string[]; stats: LinkStats; topHubs: HubRank[] } {
  const maps: LinkIndexMaps = {
    outboundMap: {},
    backlinkMap: {},
    unlinkedMap: {},
    plainTextMap: {},
    strippedTextMap: {},
    snippetMap: {},
  };

  const titleToId = buildTitleToId(tree);
  let totalLinks = 0;

  for (const doc of contents) {
    maps.plainTextMap[doc.id] = markdownToPlainText(doc.content);
    maps.strippedTextMap[doc.id] = stripWikiLinks(doc.content);
    maps.snippetMap[doc.id] = contentSnippet(doc.content);
    const targets = extractWikiLinks(doc.content);
    maps.outboundMap[doc.id] = targets;
    totalLinks += targets.length;

    for (const targetTitle of targets) {
      const targetId = titleToId.get(normalizeTitle(targetTitle));
      if (!targetId || targetId === doc.id) continue;
      const list = maps.backlinkMap[targetId] ?? [];
      if (!list.some((m) => m.id === doc.id)) {
        maps.backlinkMap[targetId] = [...list, { id: doc.id, title: doc.title }];
      }
    }
  }

  for (const target of contents) {
    const mentions: LinkMention[] = [];
    const titleNorm = target.title.trim();
    if (!titleNorm) continue;

    for (const doc of contents) {
      if (doc.id === target.id) continue;
      const stripped = maps.strippedTextMap[doc.id] ?? "";
      if (mentionsTitle(stripped, target.title)) {
        mentions.push({ id: doc.id, title: doc.title });
      }
    }
    if (mentions.length) maps.unlinkedMap[target.id] = mentions;
  }

  const derived = recomputeLinkStats(tree, maps.outboundMap, maps.backlinkMap);
  return { ...maps, ...derived };
}
