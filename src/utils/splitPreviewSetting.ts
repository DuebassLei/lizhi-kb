const KEY = "lizhi-kb-split-preview";

/** 工作区分栏预览默认关闭（编辑区全宽） */
export function loadStoredSplitPreview(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function saveSplitPreview(visible: boolean): void {
  localStorage.setItem(KEY, visible ? "1" : "0");
}
