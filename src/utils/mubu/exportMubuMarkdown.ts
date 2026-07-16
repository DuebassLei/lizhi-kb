import { tauriInvoke } from "../../composables/useTauriCommand";
import { isTauriRuntime } from "../../services/vaultService";
import type { MubuTreeNode } from "../../types/mubu";
import { downloadTextFile } from "../exportFile";
import { mubuTreeToMarkdown } from "../mubuTree";

function sanitizeFilename(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, "_") || "织念大纲";
  return base.endsWith(".md") ? base : `${base}.md`;
}

/** 导出织念整树为 Markdown 大纲（不受折叠影响） */
export async function exportMubuMarkdown(
  root: MubuTreeNode,
  title: string,
): Promise<boolean> {
  const content = mubuTreeToMarkdown(root);
  const filename = sanitizeFilename(`${title}-织念大纲`);

  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const dest = await save({
      title: "导出织念大纲",
      defaultPath: filename,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!dest) return false;
    await tauriInvoke<void>("write_export_file", { path: dest, content });
    return true;
  }

  downloadTextFile(filename, content, "text/markdown;charset=utf-8");
  return true;
}
