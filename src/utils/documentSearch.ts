import type { DocumentMeta } from "../types/document";
import { matchesDocQuery, matchesTextQuery, searchSnippet } from "./textMatch";

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
  matchIn: "title" | "body" | "both";
  score: number;
}

function scoreHit(titleMatch: boolean, bodyMatch: boolean): number {
  if (titleMatch && bodyMatch) return 150;
  if (titleMatch) return 100;
  if (bodyMatch) return 50;
  return 0;
}

/** 内存全文检索：标题 + 正文纯文本，中文拼音友好 */
export function searchDocuments(
  tree: DocumentMeta[],
  plainTextMap: Record<string, string>,
  query: string,
  limit = 20,
): SearchHit[] {
  const q = query.trim();
  if (!q) return [];

  const hits: SearchHit[] = [];

  for (const doc of tree) {
    const titleMatch = matchesDocQuery(doc.title, q);
    const body = plainTextMap[doc.id] ?? "";
    const bodyMatch = body ? matchesTextQuery(body, q) : false;
    const score = scoreHit(titleMatch, bodyMatch);
    if (score === 0) continue;

    const matchIn: SearchHit["matchIn"] =
      titleMatch && bodyMatch ? "both" : titleMatch ? "title" : "body";

    const snippet =
      bodyMatch && body
        ? searchSnippet(body, q)
        : searchSnippet(body || doc.title, q);

    hits.push({
      id: doc.id,
      title: doc.title,
      snippet,
      matchIn,
      score,
    });
  }

  return hits
    .sort((a, b) => b.score - a.score || b.title.localeCompare(a.title, "zh-CN"))
    .slice(0, limit);
}
