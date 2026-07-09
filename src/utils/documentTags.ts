import { schedulePersistVaultUiState } from "../services/vaultUiStateService";

const KEY = "lizhi-kb-doc-tags";

export type DocTagsMap = Record<string, string[]>;

function loadMap(): DocTagsMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DocTagsMap;
  } catch {
    return {};
  }
}

function saveMap(map: DocTagsMap) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getDocumentTags(docId: string): string[] {
  return loadMap()[docId] ?? [];
}

export function setDocumentTags(docId: string, tags: string[]) {
  const map = loadMap();
  const normalized = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 12);
  if (normalized.length) map[docId] = normalized;
  else delete map[docId];
  saveMap(map);
  schedulePersistVaultUiState();
}

export function listAllTags(): string[] {
  const set = new Set<string>();
  for (const tags of Object.values(loadMap())) {
    for (const t of tags) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function filterDocsByTag(docIds: string[], tag: string): string[] {
  const map = loadMap();
  return docIds.filter((id) => (map[id] ?? []).includes(tag));
}
