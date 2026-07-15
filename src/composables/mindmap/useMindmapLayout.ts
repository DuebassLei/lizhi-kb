import type { HeadingTreeNode } from "../../utils/headings";
import type { MindmapLinkShape } from "../../utils/mindmap/mindmapStyle";

/** 幕布分层：根实心 / 一级浅框 / 二级及以下底线无框 */
export type MindmapNodeChrome = "root" | "box" | "line";

export interface MindmapLayoutNode {
  id: string;
  text: string;
  note?: string;
  level: number;
  /** 相对根的树深度：0=根，1=一级主题，≥2=底线主题 */
  depth: number;
  chrome: MindmapNodeChrome;
  isRoot: boolean;
  kind?: HeadingTreeNode["kind"];
  lineIndex?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 标题区高度（底线节点连线/徽章对齐用） */
  titleH: number;
  collapsed: boolean;
  childCount: number;
  children: MindmapLayoutNode[];
}

export interface MindmapLink {
  id: string;
  path: string;
}

export interface MindmapLayoutResult {
  nodes: MindmapLayoutNode[];
  links: MindmapLink[];
  width: number;
  height: number;
}

const H_GAP = 52;
const V_GAP = 16;
const TITLE_LINE_H = 18;

export function mindmapChrome(depth: number): MindmapNodeChrome {
  if (depth <= 0) return "root";
  if (depth === 1) return "box";
  return "line";
}

function estimateTextWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    w += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 13 : 7.2;
  }
  return Math.max(1, w);
}

/** 导图画布仅展示主题标题，不计入备注尺寸（备注见大纲笔记） */
function measureNode(
  text: string,
  chrome: MindmapNodeChrome,
): { width: number; height: number; titleH: number } {
  const padX = chrome === "line" ? 4 : chrome === "root" ? 18 : 14;
  const padY = chrome === "line" ? 2 : chrome === "root" ? 10 : 9;
  const minW = chrome === "line" ? 48 : chrome === "root" ? 120 : 88;
  const maxW = chrome === "line" ? 260 : chrome === "root" ? 220 : 200;

  const titleW = estimateTextWidth(text);
  const width = Math.min(maxW, Math.max(minW, titleW + padX * 2));
  const inner = Math.max(1, width - padX * 2);
  const titleLines = Math.min(2, Math.ceil(titleW / inner));
  const titleH = titleLines * TITLE_LINE_H + (chrome === "line" ? 8 : padY);
  const height = titleH + (chrome === "line" ? 0 : padY);
  const minH = chrome === "line" ? 28 : chrome === "root" ? 40 : 34;
  return { width, height: Math.max(minH, height), titleH: Math.max(18, titleH) };
}

/** 连线接点：底线节点接在标题底线，其它接竖直中心 */
function attachY(node: MindmapLayoutNode): number {
  if (node.chrome === "line") {
    return node.y + node.titleH - 1;
  }
  return node.y + node.height / 2;
}

function exitY(node: MindmapLayoutNode): number {
  return attachY(node);
}

/** 幕布风格正交折线（中点垂直变向） */
function elbowPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const midX = fromX + Math.max(18, (toX - fromX) * 0.5);
  if (Math.abs(fromY - toY) < 1) {
    return `M ${fromX} ${fromY} L ${toX} ${toY}`;
  }
  return `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`;
}

function curvePath(fromX: number, fromY: number, toX: number, toY: number): string {
  const midX = fromX + (toX - fromX) * 0.48;
  return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
}

function linkPath(
  shape: MindmapLinkShape,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  if (shape === "straight") return `M ${fromX} ${fromY} L ${toX} ${toY}`;
  if (shape === "curve") return curvePath(fromX, fromY, toX, toY);
  return elbowPath(fromX, fromY, toX, toY);
}

function subtreeHeight(node: HeadingTreeNode, depth: number, collapsed: Set<string>): number {
  const chrome = mindmapChrome(depth);
  const { height } = measureNode(node.text, chrome);
  const isCollapsed = collapsed.has(node.id);
  if (!node.children.length || isCollapsed) return height;
  let sum = 0;
  for (let i = 0; i < node.children.length; i += 1) {
    sum += subtreeHeight(node.children[i], depth + 1, collapsed);
    if (i < node.children.length - 1) sum += V_GAP;
  }
  return Math.max(height, sum);
}

function layoutRecursive(
  node: HeadingTreeNode,
  depth: number,
  x: number,
  yCenter: number,
  collapsed: Set<string>,
  outNodes: MindmapLayoutNode[],
  outLinks: MindmapLink[],
  linkShape: MindmapLinkShape,
): MindmapLayoutNode {
  const chrome = mindmapChrome(depth);
  const { width, height, titleH } = measureNode(node.text, chrome);
  const isCollapsed = collapsed.has(node.id);
  const layout: MindmapLayoutNode = {
    id: node.id,
    text: node.text,
    note: node.note,
    level: node.level,
    depth,
    chrome,
    isRoot: !!node.isRoot || depth === 0,
    kind: node.kind,
    lineIndex: node.lineIndex,
    x,
    y: yCenter - height / 2,
    width,
    height,
    titleH,
    collapsed: isCollapsed,
    childCount: node.children.length,
    children: [],
  };

  outNodes.push(layout);

  if (!node.children.length || isCollapsed) return layout;

  const childHeights = node.children.map((c) => subtreeHeight(c, depth + 1, collapsed));
  const totalH =
    childHeights.reduce((a, b) => a + b, 0) + V_GAP * Math.max(0, node.children.length - 1);
  let cursorY = yCenter - totalH / 2;
  const childX = x + width + H_GAP;

  for (let i = 0; i < node.children.length; i += 1) {
    const ch = childHeights[i];
    const childCenter = cursorY + ch / 2;
    const childLayout = layoutRecursive(
      node.children[i],
      depth + 1,
      childX,
      childCenter,
      collapsed,
      outNodes,
      outLinks,
      linkShape,
    );
    layout.children.push(childLayout);

    outLinks.push({
      id: `${layout.id}->${childLayout.id}`,
      path: linkPath(
        linkShape,
        layout.x + layout.width,
        exitY(layout),
        childLayout.x,
        attachY(childLayout),
      ),
    });

    cursorY += ch + V_GAP;
  }

  return layout;
}

export interface MindmapLayoutOptions {
  linkShape?: MindmapLinkShape;
}

/** 水平树布局：根在左，分支向右（幕布经典朝向） */
export function layoutMindmapTree(
  root: HeadingTreeNode,
  collapsedIds: Iterable<string> = [],
  options: MindmapLayoutOptions = {},
): MindmapLayoutResult {
  const linkShape = options.linkShape ?? "curve";
  const collapsed = new Set(collapsedIds);
  const nodes: MindmapLayoutNode[] = [];
  const links: MindmapLink[] = [];
  const totalH = subtreeHeight(root, 0, collapsed);
  layoutRecursive(root, 0, 0, totalH / 2, collapsed, nodes, links, linkShape);

  let maxR = 0;
  let maxB = 0;
  for (const n of nodes) {
    maxR = Math.max(maxR, n.x + n.width);
    maxB = Math.max(maxB, n.y + n.height);
  }

  return {
    nodes,
    links,
    width: Math.max(400, maxR + 48),
    height: Math.max(280, maxB + 48),
  };
}
