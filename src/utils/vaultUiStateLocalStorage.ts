export const VAULT_UI_PINNED_KEY = "lizhi-kb-pinned";
export const VAULT_UI_RECENT_KEY = "lizhi-kb-recent-docs";
export const VAULT_UI_GRAPH_POS_KEY = "lizhi-kb-graph-node-pos";

export function readPinnedDocIdsFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(VAULT_UI_PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function readRecentDocIdsFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(VAULT_UI_RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function readGraphNodePositionsFromStorage(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(VAULT_UI_GRAPH_POS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { x: number; y: number }>) : {};
  } catch {
    return {};
  }
}

export function writeGraphNodePositionsToStorage(
  positions: Record<string, { x: number; y: number }>,
): void {
  localStorage.setItem(VAULT_UI_GRAPH_POS_KEY, JSON.stringify(positions));
}

export function writePinnedDocIdsToStorage(ids: string[]): void {
  localStorage.setItem(VAULT_UI_PINNED_KEY, JSON.stringify(ids));
}

export function writeRecentDocIdsToStorage(ids: string[]): void {
  localStorage.setItem(VAULT_UI_RECENT_KEY, JSON.stringify(ids));
}
