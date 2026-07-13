import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";
import { downloadTextFile } from "./exportFile";
import {
  formatSessionTime,
  sessionModeLabel,
  type ChatSession,
  type RagSurface,
} from "./chatSessionStorage";

export type ChatSessionExportFormat = "md" | "json";

const SURFACE_LABELS: Record<RagSurface, string> = {
  workspace: "知识库对话",
  standalone: "独立页对话",
};

const RAG_SCOPE_LABELS: Record<string, string> = {
  all: "全库",
  currentDocument: "当前文档",
  currentFolder: "当前文件夹",
};

function exportFilename(surface: RagSurface, format: ChatSessionExportFormat): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const prefix = surface === "workspace" ? "知识库" : "独立页";
  const ext = format === "md" ? "md" : "json";
  return `AI对话-${prefix}-${y}${m}${day}.${ext}`;
}

function buildSessionMarkdown(session: ChatSession): string {
  const lines: string[] = [
    `## ${session.title}`,
    "",
    `- 模式：${sessionModeLabel(session.mode)}`,
    `- 更新：${new Date(session.updatedAt).toLocaleString("zh-CN", { hour12: false })}`,
  ];
  if (session.ragScope) {
    lines.push(`- 检索范围：${RAG_SCOPE_LABELS[session.ragScope] ?? session.ragScope}`);
  }
  lines.push("");

  for (const msg of session.messages) {
    const role = msg.role === "user" ? "用户" : "助手";
    lines.push(`### ${role}`, "", msg.content.trim() || "（空）", "");
    if (msg.citations?.length) {
      lines.push(
        "引用：",
        ...msg.citations.map((c) => `- ${c.title}`),
        "",
      );
    }
    if (msg.error) {
      lines.push(`> 错误：${msg.error}`, "");
    }
  }

  return lines.join("\n").trimEnd();
}

export function buildChatSessionsMarkdown(
  surface: RagSurface,
  sessions: ChatSession[],
): string {
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const lines: string[] = [
    "# AI 对话导出",
    "",
    `导出时间：${exportedAt}`,
    `场景：${SURFACE_LABELS[surface]}`,
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

export function buildChatSessionsJson(
  surface: RagSurface,
  sessions: ChatSession[],
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      surface,
      surfaceLabel: SURFACE_LABELS[surface],
      sessions: [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    },
    null,
    2,
  );
}

export async function exportChatSessions(
  surface: RagSurface,
  sessions: ChatSession[],
  format: ChatSessionExportFormat,
): Promise<boolean> {
  if (!sessions.length) return false;

  const filename = exportFilename(surface, format);
  const content =
    format === "md"
      ? buildChatSessionsMarkdown(surface, sessions)
      : buildChatSessionsJson(surface, sessions);
  const mime =
    format === "md" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8";

  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const dest = await save({
      title: "导出 AI 对话",
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

export function formatSessionListSummary(sessions: ChatSession[]): string {
  if (!sessions.length) return "暂无会话";
  const latest = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return `共 ${sessions.length} 条 · 最近 ${formatSessionTime(latest.updatedAt)}`;
}
