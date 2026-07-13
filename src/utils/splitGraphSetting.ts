const STORAGE_KEY = "lizhi-kb-split-graph";

export function loadStoredSplitGraph(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveSplitGraph(visible: boolean): void {
  localStorage.setItem(STORAGE_KEY, visible ? "1" : "0");
}
