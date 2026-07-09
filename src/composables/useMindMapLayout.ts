import type { HeadingTreeNode } from "../utils/headings";

export interface MindMapLayoutNode {
  id: string;
  text: string;
  slug: string;
  x: number;
  y: number;
  depth: number;
  level: number;
  branchIndex: number;
  /** 0=根节点，-1=左侧分支，1=右侧分支 */
  side: -1 | 0 | 1;
  isRoot: boolean;
}

export interface MindMapLayoutEdge {
  from: string;
  to: string;
}

export interface MindMapLayout {
  nodes: MindMapLayoutNode[];
  edges: MindMapLayoutEdge[];
  width: number;
  height: number;
}

const MIN_ROW_HEIGHT = 44;

function horizontalGap(depth: number): number {
  if (depth === 0) return 156;
  if (depth === 1) return 124;
  return 102;
}

function subtreeHeight(node: HeadingTreeNode): number {
  if (node.children.length === 0) return MIN_ROW_HEIGHT;
  const sum = node.children.reduce((acc, child) => acc + subtreeHeight(child), 0);
  return Math.max(MIN_ROW_HEIGHT, sum);
}

function truncateLabel(text: string, max = 14): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export { truncateLabel };

/** 经典思维导图：根节点居中，主分支左右展开，子节点纵向树形排列 */
export function layoutMindMap(root: HeadingTreeNode): MindMapLayout {
  const nodes: MindMapLayoutNode[] = [];
  const edges: MindMapLayoutEdge[] = [];
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  function trackBounds(x: number, y: number) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  function pushNode(
    node: HeadingTreeNode,
    x: number,
    y: number,
    depth: number,
    branchIndex: number,
    side: -1 | 0 | 1,
    isRoot: boolean,
  ) {
    nodes.push({
      id: node.id,
      text: node.text,
      slug: node.slug,
      x,
      y,
      depth,
      level: node.level,
      branchIndex,
      side,
      isRoot,
    });
    trackBounds(x, y);
  }

  function layoutBranch(
    node: HeadingTreeNode,
    x: number,
    y: number,
    direction: -1 | 1,
    depth: number,
    branchIndex: number,
  ) {
    pushNode(node, x, y, depth, branchIndex, direction, false);

    if (node.children.length === 0) return;

    const heights = node.children.map(subtreeHeight);
    const total = heights.reduce((acc, h) => acc + h, 0);
    let yCursor = y - total / 2;

    node.children.forEach((child, i) => {
      const blockH = heights[i];
      const childY = yCursor + blockH / 2;
      const childX = x + direction * horizontalGap(depth);
      edges.push({ from: node.id, to: child.id });
      layoutBranch(child, childX, childY, direction, depth + 1, branchIndex);
      yCursor += blockH;
    });
  }

  function layoutRootSide(children: HeadingTreeNode[], direction: -1 | 1, branchStart: number) {
    if (children.length === 0) return;

    const heights = children.map(subtreeHeight);
    const total = heights.reduce((acc, h) => acc + h, 0);
    let yCursor = -total / 2;

    children.forEach((child, i) => {
      const blockH = heights[i];
      const childY = yCursor + blockH / 2;
      const childX = direction * horizontalGap(0);
      edges.push({ from: root.id, to: child.id });
      layoutBranch(child, childX, childY, direction, 1, branchStart + i);
      yCursor += blockH;
    });
  }

  pushNode(root, 0, 0, 0, 0, 0, true);

  const splitAt = Math.ceil(root.children.length / 2);
  const leftBranches = root.children.slice(0, splitAt);
  const rightBranches = root.children.slice(splitAt);

  layoutRootSide(leftBranches, -1, 0);
  layoutRootSide(rightBranches, 1, splitAt);

  const pad = 96;
  const width = Math.max(480, maxX - minX + pad * 2);
  const height = Math.max(360, maxY - minY + pad * 2);
  const offsetX = -minX + pad;
  const offsetY = -minY + pad;

  return {
    nodes: nodes.map((n) => ({ ...n, x: n.x + offsetX, y: n.y + offsetY })),
    edges,
    width,
    height,
  };
}

/** 水平树形连线（父节点侧缘 → 子节点侧缘，三次贝塞尔） */
export function mindMapTreeEdgePath(
  from: MindMapLayoutNode,
  to: MindMapLayoutNode,
  fromHalfW: number,
  toHalfW: number,
): string {
  const dir = to.side !== 0 ? to.side : to.x >= from.x ? 1 : -1;
  const x1 = from.x + dir * fromHalfW;
  const x2 = to.x - dir * toHalfW;
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${from.y} C ${cx} ${from.y}, ${cx} ${to.y}, ${x2} ${to.y}`;
}
