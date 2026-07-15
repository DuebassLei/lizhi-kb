export type SplitPreviewKind = "gfm" | "wechat" | "card";

const KEY = "lizhi-kb-split-preview-kind";

/** 分栏预览类型默认 GFM（阅读预览） */
export function loadStoredSplitPreviewKind(): SplitPreviewKind {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "wechat" || raw === "card") return raw;
    return "gfm";
  } catch {
    return "gfm";
  }
}

export function saveSplitPreviewKind(kind: SplitPreviewKind): void {
  localStorage.setItem(KEY, kind);
}
