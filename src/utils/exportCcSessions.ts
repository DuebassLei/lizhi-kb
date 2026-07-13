import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";
import type { CcMessage } from "../stores/ccWorkbench";
import { resolveMessageBlocks } from "./ccMessageBlocks";
import { downloadTextFile } from "./exportFile";

export type CcSessionExportFormat = "md" | "json";

export interface CcSessionExportEntry {
  id: string;
  title: string;
  updatedAt: number;
  messages: CcMessage[];
  sessionId: string | null;
  openedFiles: string[];
  selectedAgent: { name: string } | null;
}

function exportFilename(format: CcSessionExportFormat, single = false): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const ext = format === "md" ? "md" : "json";
  const prefix = single ? "Agent会话" : "Agent工作台历史";
  return `${prefix}-${y}${m}${day}.${ext}`;
}

function buildMessageMarkdown(msg: CcMessage): string {
  const role = msg.role === "user" ? "用户" : "助手";
  const lines: string[] = [`### ${role}`, ""];
  if (msg.contextFiles?.length) {
    lines.push(`上下文：${msg.contextFiles.map((f) => `@${f}`).join(" ")}`, "");
  }
  if (msg.agentName) {
    lines.push(`智能体：#${msg.agentName}`, "");
  }

  const blocks = resolveMessageBlocks(msg);
  if (!blocks.length) {
    lines.push(msg.content.trim() || "（空）", "");
  } else {
    for (const block of blocks) {
      if (block.type === "thinking") {
        lines.push("<details>", `<summary>思考</summary>`, "", block.content.trim(), "", "</details>", "");
      } else if (block.type === "text") {
        lines.push(block.content.trim(), "");
      } else {
        lines.push(`- **${block.name}**`);
        if (block.input) lines.push("  ```json", `  ${block.input}`, "  ```");
        if (block.output) {
          lines.push("  输出：", "  ```", `  ${block.output.slice(0, 2000)}`, "  ```");
        }
        lines.push("");
      }
    }
  }

  if (msg.error) {
    lines.push(`> 错误：${msg.error}`, "");
  }
  return lines.join("\n").trimEnd();
}

function buildSessionMarkdown(entry: CcSessionExportEntry): string {
  const lines: string[] = [
    `## ${entry.title}`,
    "",
    `- 更新：${new Date(entry.updatedAt).toLocaleString("zh-CN", { hour12: false })}`,
  ];
  if (entry.sessionId) lines.push(`- SDK 会话 ID：\`${entry.sessionId}\``);
  if (entry.openedFiles.length) {
    lines.push(`- 附件：${entry.openedFiles.map((f) => `@${f}`).join(" ")}`);
  }
  if (entry.selectedAgent) {
    lines.push(`- 智能体：#${entry.selectedAgent.name}`);
  }
  lines.push("");
  for (const msg of entry.messages) {
    lines.push(buildMessageMarkdown(msg), "");
  }
  return lines.join("\n").trimEnd();
}

export function buildCcSessionsMarkdown(sessions: CcSessionExportEntry[]): string {
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const lines: string[] = [
    "# Claude Agent 工作台 · 会话导出",
    "",
    `导出时间：${exportedAt}`,
    `会话数：${sessions.length}`,
    "",
  ];
  if (!sessions.length) {
    lines.push("_（暂无会话）_");
    return lines.join("\n").trimEnd() + "\n";
  }
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0) lines.push("", "---", "");
    lines.push(buildSessionMarkdown(sorted[i]));
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function buildCcSessionsJson(sessions: CcSessionExportEntry[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      source: "cc-workbench",
      sessions: [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    },
    null,
    2,
  );
}

async function saveExportFile(
  filename: string,
  content: string,
  format: CcSessionExportFormat,
): Promise<boolean> {
  const mime =
    format === "md" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8";

  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const dest = await save({
      title: "导出 Agent 会话",
      defaultPath: filename,
      filters: [
        format === "md"
          ? { name: "Markdown", extensions: ["md"] }
          : { name: "JSON", extensions: ["json"] },
      ],
    });
    if (!dest) return false;
    await tauriInvoke<void>("write_export_file", { path: dest, content });
    return true;
  }

  downloadTextFile(filename, content, mime);
  return true;
}

export async function exportCcSessions(
  sessions: CcSessionExportEntry[],
  format: CcSessionExportFormat,
): Promise<boolean> {
  if (!sessions.length) return false;
  const content =
    format === "md" ? buildCcSessionsMarkdown(sessions) : buildCcSessionsJson(sessions);
  return saveExportFile(exportFilename(format), content, format);
}

export async function exportCcSession(
  session: CcSessionExportEntry,
  format: CcSessionExportFormat,
): Promise<boolean> {
  if (!session.messages.length) return false;
  const content =
    format === "md" ? buildSessionMarkdown(session) : JSON.stringify(session, null, 2);
  const safeTitle = session.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 32);
  return saveExportFile(`${safeTitle || "会话"}.${format === "md" ? "md" : "json"}`, content, format);
}
