/** 思维导图分支配色 */
export interface MindMapBranchTheme {
  stroke: string;
  fill: string;
  fillSolid: string;
  edge: string;
  text: string;
}

export type MindMapStyleId = "classic" | "light" | "ocean" | "warm" | "forest" | "mono";

export interface MindMapStyleMeta {
  id: MindMapStyleId;
  label: string;
}

export interface MindMapStyle extends MindMapStyleMeta {
  bgColor: string;
  dotColor: string;
  root: MindMapBranchTheme;
  branches: Omit<MindMapBranchTheme, "text">[];
  nodeText: string;
}

const CLASSIC_BRANCHES: Omit<MindMapBranchTheme, "text">[] = [
  { stroke: "#6b9fd8", fill: "rgba(107, 159, 216, 0.2)", fillSolid: "#6b9fd8", edge: "#6b9fd8" },
  { stroke: "#d4a574", fill: "rgba(212, 165, 116, 0.22)", fillSolid: "#d4a574", edge: "#d4a574" },
  { stroke: "#4ade9a", fill: "rgba(74, 222, 154, 0.18)", fillSolid: "#4ade9a", edge: "#4ade9a" },
  { stroke: "#a899c8", fill: "rgba(168, 153, 200, 0.2)", fillSolid: "#a899c8", edge: "#a899c8" },
  { stroke: "#e8b86d", fill: "rgba(232, 184, 109, 0.2)", fillSolid: "#e8b86d", edge: "#e8b86d" },
  { stroke: "#f07070", fill: "rgba(240, 112, 112, 0.18)", fillSolid: "#f07070", edge: "#f07070" },
];

const MIND_MAP_STYLES: Record<MindMapStyleId, MindMapStyle> = {
  classic: {
    id: "classic",
    label: "经典",
    bgColor: "#1a1d23",
    dotColor: "rgba(120, 127, 140, 0.28)",
    root: {
      stroke: "#d4a574",
      fill: "#d4a574",
      fillSolid: "#d4a574",
      edge: "#d4a574",
      text: "#1a1d23",
    },
    branches: CLASSIC_BRANCHES,
    nodeText: "#e8eaed",
  },
  light: {
    id: "light",
    label: "明亮",
    bgColor: "#f4f5f7",
    dotColor: "rgba(100, 108, 120, 0.15)",
    root: {
      stroke: "#3d7ab8",
      fill: "#3d7ab8",
      fillSolid: "#3d7ab8",
      edge: "#3d7ab8",
      text: "#ffffff",
    },
    branches: [
      { stroke: "#3d7ab8", fill: "rgba(61, 122, 184, 0.12)", fillSolid: "#dbeafe", edge: "#3d7ab8" },
      { stroke: "#b8860b", fill: "rgba(184, 134, 11, 0.12)", fillSolid: "#fef3c7", edge: "#b8860b" },
      { stroke: "#059669", fill: "rgba(5, 150, 105, 0.12)", fillSolid: "#d1fae5", edge: "#059669" },
      { stroke: "#7c3aed", fill: "rgba(124, 58, 237, 0.12)", fillSolid: "#ede9fe", edge: "#7c3aed" },
      { stroke: "#ea580c", fill: "rgba(234, 88, 12, 0.12)", fillSolid: "#ffedd5", edge: "#ea580c" },
      { stroke: "#dc2626", fill: "rgba(220, 38, 38, 0.1)", fillSolid: "#fee2e2", edge: "#dc2626" },
    ],
    nodeText: "#1a1d24",
  },
  ocean: {
    id: "ocean",
    label: "海洋",
    bgColor: "#0f172a",
    dotColor: "rgba(56, 189, 248, 0.12)",
    root: {
      stroke: "#38bdf8",
      fill: "#0ea5e9",
      fillSolid: "#0ea5e9",
      edge: "#38bdf8",
      text: "#0f172a",
    },
    branches: [
      { stroke: "#38bdf8", fill: "rgba(56, 189, 248, 0.18)", fillSolid: "#0284c7", edge: "#38bdf8" },
      { stroke: "#22d3ee", fill: "rgba(34, 211, 238, 0.16)", fillSolid: "#0891b2", edge: "#22d3ee" },
      { stroke: "#6366f1", fill: "rgba(99, 102, 241, 0.18)", fillSolid: "#4f46e5", edge: "#6366f1" },
      { stroke: "#2dd4bf", fill: "rgba(45, 212, 191, 0.16)", fillSolid: "#0d9488", edge: "#2dd4bf" },
      { stroke: "#60a5fa", fill: "rgba(96, 165, 250, 0.16)", fillSolid: "#2563eb", edge: "#60a5fa" },
      { stroke: "#818cf8", fill: "rgba(129, 140, 248, 0.16)", fillSolid: "#4338ca", edge: "#818cf8" },
    ],
    nodeText: "#e0f2fe",
  },
  warm: {
    id: "warm",
    label: "暖色",
    bgColor: "#1c1917",
    dotColor: "rgba(212, 165, 116, 0.15)",
    root: {
      stroke: "#fbbf24",
      fill: "#d97706",
      fillSolid: "#d97706",
      edge: "#fbbf24",
      text: "#1c1917",
    },
    branches: [
      { stroke: "#fbbf24", fill: "rgba(251, 191, 36, 0.18)", fillSolid: "#b45309", edge: "#fbbf24" },
      { stroke: "#fb923c", fill: "rgba(251, 146, 60, 0.18)", fillSolid: "#c2410c", edge: "#fb923c" },
      { stroke: "#f87171", fill: "rgba(248, 113, 113, 0.16)", fillSolid: "#b91c1c", edge: "#f87171" },
      { stroke: "#f472b6", fill: "rgba(244, 114, 182, 0.16)", fillSolid: "#be185d", edge: "#f472b6" },
      { stroke: "#fcd34d", fill: "rgba(252, 211, 77, 0.16)", fillSolid: "#a16207", edge: "#fcd34d" },
      { stroke: "#fdba74", fill: "rgba(253, 186, 116, 0.16)", fillSolid: "#9a3412", edge: "#fdba74" },
    ],
    nodeText: "#fef3c7",
  },
  forest: {
    id: "forest",
    label: "森林",
    bgColor: "#141a16",
    dotColor: "rgba(74, 222, 154, 0.12)",
    root: {
      stroke: "#4ade9a",
      fill: "#16a34a",
      fillSolid: "#16a34a",
      edge: "#4ade9a",
      text: "#052e16",
    },
    branches: [
      { stroke: "#4ade9a", fill: "rgba(74, 222, 154, 0.16)", fillSolid: "#15803d", edge: "#4ade9a" },
      { stroke: "#86efac", fill: "rgba(134, 239, 172, 0.14)", fillSolid: "#166534", edge: "#86efac" },
      { stroke: "#a3e635", fill: "rgba(163, 230, 53, 0.14)", fillSolid: "#4d7c0f", edge: "#a3e635" },
      { stroke: "#2dd4bf", fill: "rgba(45, 212, 191, 0.14)", fillSolid: "#0f766e", edge: "#2dd4bf" },
      { stroke: "#6ee7b7", fill: "rgba(110, 231, 183, 0.14)", fillSolid: "#047857", edge: "#6ee7b7" },
      { stroke: "#bef264", fill: "rgba(190, 242, 100, 0.14)", fillSolid: "#65a30d", edge: "#bef264" },
    ],
    nodeText: "#dcfce7",
  },
  mono: {
    id: "mono",
    label: "简约",
    bgColor: "#18181b",
    dotColor: "rgba(161, 161, 170, 0.2)",
    root: {
      stroke: "#fafafa",
      fill: "#e4e4e7",
      fillSolid: "#e4e4e7",
      edge: "#fafafa",
      text: "#18181b",
    },
    branches: [
      { stroke: "#a1a1aa", fill: "rgba(161, 161, 170, 0.15)", fillSolid: "#52525b", edge: "#a1a1aa" },
      { stroke: "#d4d4d8", fill: "rgba(212, 212, 216, 0.12)", fillSolid: "#71717a", edge: "#d4d4d8" },
      { stroke: "#71717a", fill: "rgba(113, 113, 122, 0.15)", fillSolid: "#3f3f46", edge: "#71717a" },
      { stroke: "#e4e4e7", fill: "rgba(228, 228, 231, 0.1)", fillSolid: "#52525b", edge: "#e4e4e7" },
      { stroke: "#52525b", fill: "rgba(82, 82, 91, 0.2)", fillSolid: "#27272a", edge: "#52525b" },
      { stroke: "#fafafa", fill: "rgba(250, 250, 250, 0.08)", fillSolid: "#3f3f46", edge: "#fafafa" },
    ],
    nodeText: "#f4f4f5",
  },
};

export const MIND_MAP_STYLE_OPTIONS: MindMapStyleMeta[] = Object.values(MIND_MAP_STYLES).map(
  ({ id, label }) => ({ id, label }),
);

export function getMindMapStyle(id: MindMapStyleId): MindMapStyle {
  return MIND_MAP_STYLES[id] ?? MIND_MAP_STYLES.classic;
}

export function getBranchTheme(
  styleId: MindMapStyleId,
  branchIndex: number,
  isRoot: boolean,
): MindMapBranchTheme {
  const style = getMindMapStyle(styleId);
  if (isRoot) return style.root;
  const base = style.branches[branchIndex % style.branches.length];
  return { ...base, text: style.nodeText };
}

export interface MindMapNodeSize {
  w: number;
  h: number;
  rx: number;
  fontSize: number;
  strokeWidth: number;
}

/** 按标题层级区分节点尺寸 */
export function nodeSizeForLevel(level: number, isRoot: boolean): MindMapNodeSize {
  if (isRoot) {
    return { w: 124, h: 42, rx: 12, fontSize: 13, strokeWidth: 2 };
  }
  switch (level) {
    case 1:
      return { w: 108, h: 34, rx: 10, fontSize: 12, strokeWidth: 1.75 };
    case 2:
      return { w: 96, h: 30, rx: 9, fontSize: 11, strokeWidth: 1.5 };
    default:
      return { w: 88, h: 26, rx: 8, fontSize: 10, strokeWidth: 1.25 };
  }
}

export function levelBadge(level: number, isRoot: boolean): string | null {
  if (isRoot) return "文档";
  if (level >= 1 && level <= 3) return `H${level}`;
  return null;
}

export function edgeStrokeWidth(parentDepth: number): number {
  return parentDepth === 0 ? 2.25 : parentDepth === 1 ? 1.75 : 1.25;
}
