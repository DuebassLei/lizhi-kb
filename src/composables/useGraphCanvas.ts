import type { DocumentMeta } from "../types/document";
import type { LinkMention } from "../stores/links";

export interface GraphNode {
  id: string;
  title: string;
  depth: number;
  x: number;
  y: number;
  isCenter: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
}

function titleToIdMap(tree: DocumentMeta[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of tree) {
    map.set(d.title.trim().toLowerCase(), d.id);
  }
  return map;
}

function resolveTargetId(title: string, map: Map<string, string>): string | null {
  return map.get(title.trim().toLowerCase()) ?? null;
}

/** 以当前文档为中心，构建 2 层局部图谱 */
export function buildLocalGraph(
  centerId: string | null,
  tree: DocumentMeta[],
  outbound: Record<string, string[]>,
  inbound: Record<string, LinkMention[]>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!centerId || !tree.length) {
    return { nodes: [], edges: [] };
  }

  const titleMap = titleToIdMap(tree);
  const metaById = new Map(tree.map((d) => [d.id, d]));
  const nodeDepth = new Map<string, number>();
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();

  function addEdge(from: string, to: string) {
    const key = `${from}->${to}`;
    if (edgeKeys.has(key) || from === to) return;
    edgeKeys.add(key);
    edges.push({ from, to });
  }

  nodeDepth.set(centerId, 0);
  const queue = [centerId];

  while (queue.length) {
    const id = queue.shift()!;
    const depth = nodeDepth.get(id)!;
    if (depth >= 2) continue;

    for (const title of outbound[id] ?? []) {
      const targetId = resolveTargetId(title, titleMap);
      if (!targetId) continue;
      addEdge(id, targetId);
      if (!nodeDepth.has(targetId)) {
        nodeDepth.set(targetId, depth + 1);
        queue.push(targetId);
      }
    }

    for (const mention of inbound[id] ?? []) {
      addEdge(mention.id, id);
      if (!nodeDepth.has(mention.id)) {
        nodeDepth.set(mention.id, depth + 1);
        queue.push(mention.id);
      }
    }
  }

  const nodes: GraphNode[] = [];
  const depthGroups = new Map<number, string[]>();
  for (const [id, depth] of nodeDepth) {
    if (!depthGroups.has(depth)) depthGroups.set(depth, []);
    depthGroups.get(depth)!.push(id);
  }

  for (const [depth, ids] of depthGroups) {
    const radius = depth === 0 ? 0 : depth === 1 ? 100 : 180;
    ids.forEach((id, i) => {
      const angle = ids.length === 1 ? 0 : (2 * Math.PI * i) / ids.length - Math.PI / 2;
      const meta = metaById.get(id);
      nodes.push({
        id,
        title: meta?.title ?? id.slice(0, 8),
        depth,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        isCenter: id === centerId,
      });
    });
  }

  return { nodes, edges };
}
