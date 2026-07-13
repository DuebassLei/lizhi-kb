import { tauriInvoke } from "../composables/useTauriCommand";
import type { DocumentMeta } from "../types/document";
import {
  recomputeLinkStats,
  type HubRank,
  type LinkIndexMaps,
  type LinkMention,
  type LinkStats,
} from "../utils/linkIndexOps";
import { searchDocuments, type SearchHit } from "../utils/documentSearch";
import { isTauriRuntime } from "./vaultService";

interface RustLinkStats {
  totalLinks: number;
  orphanCount: number;
  hubDoc: LinkMention | null;
  topHubs: HubRank[];
  orphanIds: string[];
}

export interface LinkIndexSnapshot extends LinkIndexMaps {
  orphanIds: string[];
  stats: LinkStats;
  topHubs: HubRank[];
}

export interface GraphNodePayload {
  id: string;
  title: string;
  depth: number;
  x: number;
  y: number;
  isCenter: boolean;
}

export interface GraphEdgePayload {
  from: string;
  to: string;
}

export interface GraphPayload {
  centerId: string;
  depth: number;
  nodes: GraphNodePayload[];
  edges: GraphEdgePayload[];
}

export interface LinkInsightsPayload {
  orphanIds: string[];
  stats: LinkStats;
  topHubs: HubRank[];
}

function mapRustStats(raw: RustLinkStats): LinkInsightsPayload {
  const topHubs = raw.topHubs ?? [];
  let hubDoc: LinkStats["hubDoc"] = null;
  if (raw.hubDoc) {
    const inbound = topHubs.find((h) => h.id === raw.hubDoc!.id)?.inbound ?? 0;
    hubDoc = { id: raw.hubDoc.id, title: raw.hubDoc.title, inbound };
  }
  return {
    topHubs,
    orphanIds: raw.orphanIds ?? [],
    stats: {
      totalLinks: Number(raw.totalLinks),
      orphanCount: raw.orphanCount,
      hubDoc,
    },
  };
}

export async function searchKnowledgeBase(
  tree: DocumentMeta[],
  plainTextMap: Record<string, string>,
  query: string,
  limit = 20,
): Promise<SearchHit[]> {
  if (isTauriRuntime()) {
    return tauriInvoke<SearchHit[]>("search_documents", { query, limit });
  }
  return searchDocuments(tree, plainTextMap, query, limit);
}

/** 手动重建全文搜索索引（FTS5 + 链接索引），返回已索引文档数 */
export async function rebuildSearchIndex(): Promise<number> {
  return tauriInvoke<number>("rebuild_search_index");
}

/** Tauri 轻量快照：不含 plain/stripped 全文，仅链接关系 + snippet */
export async function fetchLinkIndexSnapshot(): Promise<LinkIndexSnapshot | null> {
  if (!isTauriRuntime()) return null;

  const raw = await tauriInvoke<
    LinkIndexMaps & { orphanIds: string[]; stats: RustLinkStats }
  >("get_link_index_snapshot");

  const insights = mapRustStats(raw.stats);

  return {
    outboundMap: raw.outboundMap ?? {},
    backlinkMap: raw.backlinkMap ?? {},
    unlinkedMap: raw.unlinkedMap ?? {},
    plainTextMap: raw.plainTextMap ?? {},
    strippedTextMap: raw.strippedTextMap ?? {},
    snippetMap: raw.snippetMap ?? {},
    orphanIds: raw.orphanIds ?? insights.orphanIds,
    stats: insights.stats,
    topHubs: insights.topHubs,
  };
}

export async function fetchDocumentBacklinks(documentId: string): Promise<LinkMention[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<LinkMention[]>("get_backlinks", { documentId });
}

export async function fetchDocumentUnlinkedMentions(
  documentId: string,
): Promise<LinkMention[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<LinkMention[]>("get_unlinked_mentions", { documentId });
}

export async function fetchDocumentOutboundTitles(documentId: string): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<string[]>("get_outbound_link_titles", { documentId });
}

export async function fetchLinkInsights(): Promise<LinkInsightsPayload | null> {
  if (!isTauriRuntime()) return null;
  const raw = await tauriInvoke<RustLinkStats>("get_link_stats");
  return mapRustStats(raw);
}

export async function fetchLocalGraph(
  centerId: string,
  depth = 2,
): Promise<GraphPayload | null> {
  if (!isTauriRuntime()) return null;
  return tauriInvoke<GraphPayload>("get_local_graph", { centerId, depth });
}

/** 浏览器预览下用本地 maps 重算统计（Tauri 快照已含 stats 时可忽略） */
export function deriveLinkStatsFromMaps(
  tree: DocumentMeta[],
  maps: Pick<LinkIndexMaps, "outboundMap" | "backlinkMap">,
) {
  return recomputeLinkStats(tree, maps.outboundMap, maps.backlinkMap);
}
