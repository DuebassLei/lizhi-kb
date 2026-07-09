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
}

export interface LinkIndexSnapshot extends LinkIndexMaps {
  orphanIds: string[];
  stats: LinkStats;
  topHubs: HubRank[];
}

function mapRustStats(raw: RustLinkStats): { stats: LinkStats; topHubs: HubRank[] } {
  const topHubs = raw.topHubs ?? [];
  let hubDoc: LinkStats["hubDoc"] = null;
  if (raw.hubDoc) {
    const inbound = topHubs.find((h) => h.id === raw.hubDoc!.id)?.inbound ?? 0;
    hubDoc = { id: raw.hubDoc.id, title: raw.hubDoc.title, inbound };
  }
  return {
    topHubs,
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

export async function fetchLinkIndexSnapshot(): Promise<LinkIndexSnapshot | null> {
  if (!isTauriRuntime()) return null;

  const raw = await tauriInvoke<
    LinkIndexMaps & { orphanIds: string[]; stats: RustLinkStats }
  >("get_link_index_snapshot");

  const { stats, topHubs } = mapRustStats(raw.stats);

  return {
    outboundMap: raw.outboundMap,
    backlinkMap: raw.backlinkMap,
    unlinkedMap: raw.unlinkedMap,
    plainTextMap: raw.plainTextMap,
    strippedTextMap: raw.strippedTextMap,
    snippetMap: raw.snippetMap,
    orphanIds: raw.orphanIds,
    stats,
    topHubs,
  };
}

/** 浏览器预览下用本地 maps 重算统计（Tauri 快照已含 stats 时可忽略） */
export function deriveLinkStatsFromMaps(
  tree: DocumentMeta[],
  maps: Pick<LinkIndexMaps, "outboundMap" | "backlinkMap">,
) {
  return recomputeLinkStats(tree, maps.outboundMap, maps.backlinkMap);
}
