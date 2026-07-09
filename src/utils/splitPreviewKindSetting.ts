export type SplitPreviewKind = "gfm" | "wechat";

const KEY = "lizhi-kb-split-preview-kind";

/** 分栏预览类型默认 GFM（阅读预览） */
export function loadStoredSplitPreviewKind(): SplitPreviewKind {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "wechat" ? "wechat" : "gfm";
  } catch {
    return "gfm";
  }
}

export function saveSplitPreviewKind(kind: SplitPreviewKind): void {
  localStorage.setItem(KEY, kind);
}
