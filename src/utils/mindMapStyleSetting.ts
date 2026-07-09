import type { MindMapStyleId } from "./mindMapTheme";

const KEY = "lizhi-kb-mindmap-style";

const VALID: MindMapStyleId[] = ["classic", "light", "ocean", "warm", "forest", "mono"];

export function loadStoredMindMapStyle(): MindMapStyleId {
  const v = localStorage.getItem(KEY);
  if (VALID.includes(v as MindMapStyleId)) return v as MindMapStyleId;
  return "classic";
}

export function saveMindMapStyle(style: MindMapStyleId) {
  localStorage.setItem(KEY, style);
}
