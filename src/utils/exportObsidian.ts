import { parseAssetId } from "../services/assetService";
import { exportMarkdownFolder, exportObsidianVault, isTauriRuntime } from "../services/vaultService";
import { filterDocsByTag } from "./documentTags";
import type { DocumentMeta } from "../types/document";

const ASSET_REF_RE = /asset:\/\/([^\s)]+)/g;

function sanitizePathSegment(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "document";
}

function collectAssetRefs(content: string): string[] {
  const ids = new Set<string>();
  for (const match of content.matchAll(ASSET_REF_RE)) {
    const id = parseAssetId(`asset://${match[1]}`);
    if (id) ids.add(id);
  }
  return [...ids];
}

export async function exportDocsByTag(
  docs: DocumentMeta[],
  contents: Map<string, string>,
  tag: string,
): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const dest = await open({ directory: true, multiple: false, title: `导出标签「${tag}」` });
  if (!dest || Array.isArray(dest)) return false;

  const matchedIds = filterDocsByTag(
    docs.map((d) => d.id),
    tag,
  );
  const matched = docs.filter((d) => matchedIds.includes(d.id));
  const files = matched.map((doc) => ({
    relativePath: `${sanitizePathSegment(doc.title)}.md`,
    content: contents.get(doc.id) ?? "",
  }));
  await exportMarkdownFolder(dest, files);
  return true;
}

export async function exportDocsAsObsidian(
  docs: DocumentMeta[],
  contents: Map<string, string>,
): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const dest = await open({ directory: true, multiple: false, title: "导出 Obsidian 库" });
  if (!dest || Array.isArray(dest)) return false;

  const files = docs.map((doc) => ({
    relativePath: `${sanitizePathSegment(doc.title)}.md`,
    content: contents.get(doc.id) ?? "",
  }));

  const assetMap = new Map<string, string>();
  for (const doc of docs) {
    const content = contents.get(doc.id) ?? "";
    for (const id of collectAssetRefs(content)) {
      if (!assetMap.has(id)) {
        assetMap.set(id, `attachments/${id}`);
      }
    }
  }

  const assetsList = [...assetMap.entries()].map(([assetId, relativePath]) => ({
    assetId,
    relativePath,
  }));

  await exportObsidianVault(dest, files, assetsList);
  return true;
}
