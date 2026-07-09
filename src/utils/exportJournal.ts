import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";
import type { JournalEntry } from "../types/journal";
import { formatEntryTime, groupEntriesByDay } from "./journalDates";
import { downloadTextFile } from "./exportFile";

export function buildJournalMarkdown(entries: JournalEntry[]): string {
  const groups = groupEntriesByDay(entries);
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const lines: string[] = ["# 每日小记导出", "", `导出时间：${exportedAt}`, ""];

  if (groups.length === 0) {
    lines.push("_（暂无小记）_");
    return lines.join("\n");
  }

  for (const group of groups) {
    lines.push(`## ${group.label}`, "");
    for (const entry of group.entries) {
      lines.push(`### ${formatEntryTime(entry.createdAt)}`, "", entry.content.trim(), "");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function journalExportFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `每日小记-${y}${m}${day}.md`;
}

export async function exportJournalMarkdown(entries: JournalEntry[]): Promise<boolean> {
  if (entries.length === 0) return false;
  const content = buildJournalMarkdown(entries);
  const filename = journalExportFilename();
  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const dest = await save({
      title: "导出小记",
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
