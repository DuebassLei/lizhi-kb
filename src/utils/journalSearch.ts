import type { JournalEntry } from "../types/journal";
import { matchesTextQuery, markdownToPlainText, searchSnippet } from "./textMatch";

export function filterJournalEntries(entries: JournalEntry[], query: string): JournalEntry[] {
  const q = query.trim();
  if (!q) return entries;
  return entries.filter((entry) => {
    const plain = markdownToPlainText(entry.content);
    return matchesTextQuery(plain, q) || matchesTextQuery(entry.content, q);
  });
}

export function journalEntryTitle(entry: JournalEntry, maxLen = 48): string {
  const firstLine = markdownToPlainText(entry.content).split(/\n/)[0]?.trim() ?? "";
  if (!firstLine) return "（空小记）";
  return firstLine.length > maxLen ? `${firstLine.slice(0, maxLen)}…` : firstLine;
}

export function journalEntrySnippet(entry: JournalEntry, query: string): string {
  const plain = markdownToPlainText(entry.content);
  return searchSnippet(plain, query, 80);
}
