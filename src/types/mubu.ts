export interface MubuDoc {
  id: string;
  title: string;
  styleJson: string | null;
  createdAt: number;
  updatedAt: number;
}

/** 主题装饰（对齐幕布：字色/荧光笔/图标等；不含备注） */
export interface MubuDecor {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** CSS color */
  color?: string | null;
  /** CSS highlight background */
  highlight?: string | null;
  /** emoji / short icon */
  icon?: string | null;
}

export interface MubuNode {
  id: string;
  docId: string;
  parentId: string | null;
  sortOrder: number;
  text: string;
  /** @deprecated 产品不再使用备注；持久化恒为空 */
  note: string;
  collapsed: boolean;
  isTodo: boolean;
  isDone: boolean;
  /** 0=正文 1=H1 2=H2 3=H3 */
  headingLevel: number;
  decor: MubuDecor;
  createdAt: number;
  updatedAt: number;
}

export interface MubuNodeInput {
  id: string;
  parentId: string | null;
  sortOrder: number;
  text: string;
  collapsed?: boolean;
  isTodo?: boolean;
  isDone?: boolean;
  headingLevel?: number;
  decor?: MubuDecor;
  createdAt?: number;
  updatedAt?: number;
}

export interface MubuTreeNode extends MubuNode {
  children: MubuTreeNode[];
}

export type MubuPaneMode = "notes" | "map";

export const MUBU_HIGHLIGHTS = [
  { id: "yellow", css: "rgba(250, 204, 21, 0.45)" },
  { id: "red", css: "rgba(248, 113, 113, 0.4)" },
  { id: "gray", css: "rgba(148, 163, 184, 0.4)" },
  { id: "green", css: "rgba(74, 222, 128, 0.4)" },
  { id: "blue", css: "rgba(96, 165, 250, 0.4)" },
  { id: "purple", css: "rgba(192, 132, 252, 0.4)" },
] as const;

export const MUBU_TEXT_COLORS = [
  { id: "default", css: "" },
  { id: "red", css: "#f87171" },
  { id: "orange", css: "#fb923c" },
  { id: "yellow", css: "#facc15" },
  { id: "green", css: "#4ade80" },
  { id: "blue", css: "#60a5fa" },
  { id: "purple", css: "#c084fc" },
  { id: "pink", css: "#f472b6" },
] as const;

export const MUBU_ICONS = [
  "⭐", "🔥", "💡", "✅", "❗", "📌", "🎯", "🚀", "❤️", "🧠", "📦", "🛠",
] as const;

export function emptyDecor(): MubuDecor {
  return {};
}

export function normalizeDecor(raw: unknown): MubuDecor {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    bold: Boolean(o.bold),
    italic: Boolean(o.italic),
    underline: Boolean(o.underline),
    strike: Boolean(o.strike),
    color: typeof o.color === "string" ? o.color : null,
    highlight: typeof o.highlight === "string" ? o.highlight : null,
    icon: typeof o.icon === "string" ? o.icon : null,
  };
}
