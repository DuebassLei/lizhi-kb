export type MindmapLinkShape = "elbow" | "curve" | "straight";
/** 连线箭头：无 / 终点 / 双向（连线始终实线） */
export type MindmapLinkArrow = "none" | "end" | "both";
/** 节点外形 */
export type MindmapNodeShape = "rounded" | "soft" | "pill" | "rect";
export type MindmapFontId =
  | "ui"
  | "system"
  | "yahei"
  | "pingfang"
  | "song"
  | "kai"
  | "mono";
/** 导图主题色 */
export type MindmapThemeId = "ui" | "warm" | "blue" | "forest" | "dusk";

export interface MindmapStylePrefs {
  linkShape: MindmapLinkShape;
  linkArrow: MindmapLinkArrow;
  nodeShape: MindmapNodeShape;
  fontId: MindmapFontId;
  themeId: MindmapThemeId;
}

/** @deprecated 兼容旧字段名 */
export type MindmapBorderStyle = MindmapNodeShape;

export const DEFAULT_MINDMAP_STYLE: MindmapStylePrefs = {
  linkShape: "curve",
  linkArrow: "none",
  nodeShape: "rounded",
  fontId: "ui",
  themeId: "dusk",
};

export const MINDMAP_LINK_SHAPE_OPTIONS: { id: MindmapLinkShape; label: string }[] = [
  { id: "elbow", label: "折线" },
  { id: "curve", label: "曲线" },
  { id: "straight", label: "直线" },
];

export const MINDMAP_LINK_ARROW_OPTIONS: { id: MindmapLinkArrow; label: string }[] = [
  { id: "none", label: "无箭头" },
  { id: "end", label: "终点箭头" },
  { id: "both", label: "双向箭头" },
];

export const MINDMAP_NODE_SHAPE_OPTIONS: { id: MindmapNodeShape; label: string }[] = [
  { id: "rounded", label: "圆角矩形" },
  { id: "soft", label: "大圆角" },
  { id: "pill", label: "胶囊" },
  { id: "rect", label: "直角矩形" },
];

/** @deprecated 使用 MINDMAP_NODE_SHAPE_OPTIONS */
export const MINDMAP_BORDER_OPTIONS = MINDMAP_NODE_SHAPE_OPTIONS;

export const MINDMAP_THEME_OPTIONS: { id: MindmapThemeId; label: string }[] = [
  { id: "ui", label: "跟随界面" },
  { id: "warm", label: "暖爪" },
  { id: "blue", label: "联结蓝" },
  { id: "forest", label: "青松" },
  { id: "dusk", label: "暮紫" },
];

export const MINDMAP_FONT_OPTIONS: { id: MindmapFontId; label: string; css: string }[] = [
  {
    id: "ui",
    label: "界面字体",
    css: "var(--font-ui)",
  },
  {
    id: "system",
    label: "系统默认",
    css: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  {
    id: "yahei",
    label: "微软雅黑",
    css: '"Microsoft YaHei", "微软雅黑", sans-serif',
  },
  {
    id: "pingfang",
    label: "苹方 / 黑体",
    css: '"PingFang SC", "Hiragino Sans GB", "Heiti SC", sans-serif',
  },
  {
    id: "song",
    label: "宋体",
    css: '"SimSun", "Songti SC", "Noto Serif SC", serif',
  },
  {
    id: "kai",
    label: "楷体",
    css: '"KaiTi", "STKaiti", "Kaiti SC", serif',
  },
  {
    id: "mono",
    label: "等宽",
    css: "var(--font-mono)",
  },
];

const STORAGE_KEY = "lizhi-kb-mindmap-style";

function isLinkShape(v: unknown): v is MindmapLinkShape {
  return v === "elbow" || v === "curve" || v === "straight";
}
function isLinkArrow(v: unknown): v is MindmapLinkArrow {
  return v === "none" || v === "end" || v === "both";
}
function isNodeShape(v: unknown): v is MindmapNodeShape {
  return v === "rounded" || v === "soft" || v === "pill" || v === "rect";
}
function isTheme(v: unknown): v is MindmapThemeId {
  return MINDMAP_THEME_OPTIONS.some((o) => o.id === v);
}

/** 旧版存档迁移为节点外形 */
function migrateNodeShape(raw: unknown): MindmapNodeShape {
  if (isNodeShape(raw)) return raw;
  return DEFAULT_MINDMAP_STYLE.nodeShape;
}

function isFont(v: unknown): v is MindmapFontId {
  return MINDMAP_FONT_OPTIONS.some((o) => o.id === v);
}

export function loadMindmapStyle(): MindmapStylePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MINDMAP_STYLE };
    const parsed = JSON.parse(raw) as Partial<MindmapStylePrefs> & {
      borderStyle?: unknown;
      linkStroke?: unknown;
    };
    const shapeRaw = parsed.nodeShape ?? parsed.borderStyle;
    return {
      linkShape: isLinkShape(parsed.linkShape) ? parsed.linkShape : DEFAULT_MINDMAP_STYLE.linkShape,
      linkArrow: isLinkArrow(parsed.linkArrow) ? parsed.linkArrow : DEFAULT_MINDMAP_STYLE.linkArrow,
      nodeShape: migrateNodeShape(shapeRaw),
      fontId: isFont(parsed.fontId) ? parsed.fontId : DEFAULT_MINDMAP_STYLE.fontId,
      themeId: isTheme(parsed.themeId) ? parsed.themeId : DEFAULT_MINDMAP_STYLE.themeId,
    };
  } catch {
    return { ...DEFAULT_MINDMAP_STYLE };
  }
}

export function saveMindmapStyle(prefs: MindmapStylePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function fontCssFor(id: MindmapFontId): string {
  return MINDMAP_FONT_OPTIONS.find((o) => o.id === id)?.css ?? MINDMAP_FONT_OPTIONS[0].css;
}
