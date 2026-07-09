import type { DocumentMeta } from "../types/document";
import type { FolderMeta } from "../types/folder";
import { getFolderPathLabel } from "./folderHelpers";

function sanitizeSegment(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "未命名";
}

export interface MarkdownFolderExportEntry {
  relativePath: string;
  content: string;
}

function folderIdFromMeta(meta: DocumentMeta): string {
  if (meta.folder) return meta.folder;
  const match = meta.path.match(/^(.+)\/[^/]+\.md(\.enc)?$/);
  return match ? match[1] : "inbox";
}

export function buildMarkdownFolderExportEntries(
  docs: Array<{ meta: DocumentMeta; content: string }>,
  folders: FolderMeta[],
): MarkdownFolderExportEntry[] {
  const used = new Set<string>();
  const entries: MarkdownFolderExportEntry[] = [];

  for (const { meta, content } of docs) {
    const folderLabel = getFolderPathLabel(folderIdFromMeta(meta), folders);
    const folderParts = folderLabel
      .split(/\s*\/\s*/)
      .map((part) => sanitizeSegment(part))
      .filter(Boolean);
    const baseName = sanitizeSegment(meta.title.trim() || "未命名");

    let fileName = `${baseName}.md`;
    let relativePath = [...folderParts, fileName].join("/");
    let suffix = 2;
    while (used.has(relativePath.toLowerCase())) {
      fileName = `${baseName}-${suffix}.md`;
      relativePath = [...folderParts, fileName].join("/");
      suffix += 1;
    }
    used.add(relativePath.toLowerCase());

    const body = content.trim();
    entries.push({
      relativePath,
      content: body.startsWith("# ") ? body : `# ${meta.title.trim() || "未命名"}\n\n${body}`,
    });
  }

  return entries;
}
