import { useDocumentsStore } from "../stores/documents";
import { matchesDocQuery } from "../utils/textMatch";
import { normalizeTitle } from "../utils/wikiLinks";

export interface WikiSuggestion {
  id: string;
  title: string;
  isNew?: boolean;
}

export const NEW_DOC_SUGGEST_ID = "__new__";

export function filterWikiSuggestions(query: string, limit = 10): WikiSuggestion[] {
  const docs = useDocumentsStore();
  const raw = query.startsWith("[") ? query.slice(1) : query;
  const q = raw.trim();
  const excludeId = docs.activeId ?? undefined;
  const effectiveLimit = q ? limit : Math.max(limit, 12);

  const candidates = docs.tree.filter(
    (d) => (!excludeId || d.id !== excludeId) && matchesDocQuery(d.title, q),
  );

  let sorted = candidates;
  if (!q) {
    const recentRank = new Map(docs.recentDocs.map((d, i) => [d.id, i]));
    sorted = [...candidates].sort((a, b) => {
      const ra = recentRank.get(a.id) ?? 999;
      const rb = recentRank.get(b.id) ?? 999;
      if (ra !== rb) return ra - rb;
      return a.title.localeCompare(b.title, "zh-CN");
    });
  }

  const matched: WikiSuggestion[] = sorted
    .slice(0, effectiveLimit)
    .map((d) => ({ id: d.id, title: d.title }));

  if (q && !matched.some((m) => normalizeTitle(m.title) === normalizeTitle(q))) {
    matched.push({ id: NEW_DOC_SUGGEST_ID, title: q, isNew: true });
  }

  return matched.slice(0, effectiveLimit);
}

export function findDocIdByTitle(title: string): string | undefined {
  const docs = useDocumentsStore();
  const norm = normalizeTitle(title);
  return docs.tree.find((d) => normalizeTitle(d.title) === norm)?.id;
}
