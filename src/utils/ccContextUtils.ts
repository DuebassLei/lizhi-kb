import type { CcAgentEntry } from "../services/ccWorkbenchService";

export const CC_RECENT_AGENTS_KEY = "cc-workbench-recent-agents";
export const CC_DEFAULT_AGENT_KEY = "cc-workbench-default-agent-id";
/** 内置默认智能体（`.claude/agents/general-assistant.md`） */
export const BUILTIN_DEFAULT_AGENT_ID = "general-assistant";
const MAX_RECENT_AGENTS = 8;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 从输入文本中提取 @路径 引用（不含 email 等误匹配） */
export function parseAtMentions(text: string): string[] {  const matches = text.match(/(?:^|\s)@([^\s#]+)/g);
  if (!matches) return [];
  const out: string[] = [];
  for (const raw of matches) {
    const path = raw.trim().replace(/^@/, "").trim();
    if (path && !out.includes(path)) {
      out.push(path);
    }
  }
  return out;
}

export function mergeContextPaths(base: string[], extra: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of [...base, ...extra]) {
    const trimmed = path.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function loadRecentAgentIds(): string[] {
  try {
    const raw = localStorage.getItem(CC_RECENT_AGENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecentAgentId(agentId: string) {
  const trimmed = agentId.trim();
  if (!trimmed) return;
  const merged = [trimmed, ...loadRecentAgentIds().filter((id) => id !== trimmed)].slice(
    0,
    MAX_RECENT_AGENTS,
  );
  try {
    localStorage.setItem(CC_RECENT_AGENTS_KEY, JSON.stringify(merged));
  } catch {
    /* ignore quota */
  }
}

export function loadDefaultAgentId(): string | null {
  try {
    const raw = localStorage.getItem(CC_DEFAULT_AGENT_KEY);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

/** 用户未设置默认时回退到内置「基础助手」 */
export function getEffectiveDefaultAgentId(): string {
  return loadDefaultAgentId() ?? BUILTIN_DEFAULT_AGENT_ID;
}

export function saveDefaultAgentId(agentId: string | null) {
  try {
    if (!agentId?.trim()) {
      localStorage.removeItem(CC_DEFAULT_AGENT_KEY);
      return;
    }
    localStorage.setItem(CC_DEFAULT_AGENT_KEY, agentId.trim());
  } catch {
    /* ignore quota */
  }
}

export function resolveAgentByToken(
  token: string,
  agents: CcAgentEntry[],
): CcAgentEntry | null {
  const q = token.trim().toLowerCase();
  if (!q) return null;
  return (
    agents.find((a) => a.name.toLowerCase() === q || a.id.toLowerCase() === q) ?? null
  );
}

/** 解析消息开头的 #智能体 引用（对齐 CC GUI：智能体与正文分离展示） */
export function parseLeadingAgentMention(
  text: string,
  agents: CcAgentEntry[],
): { agent: CcAgentEntry | null; cleanedText: string } {
  const leadingWs = text.length - text.trimStart().length;
  const trimmed = text.trimStart();
  const match = trimmed.match(/^#([^\s#]+)(?:\s+([\s\S]*))?$/);
  if (!match) return { agent: null, cleanedText: text };
  const agent = resolveAgentByToken(match[1], agents);
  if (!agent) return { agent: null, cleanedText: text };
  const body = (match[2] ?? "").trimStart();
  const cleanedText = `${text.slice(0, leadingWs)}${body}`;
  return { agent, cleanedText };
}

export function stripAgentPrefix(text: string, agent: CcAgentEntry): string {
  const trimmed = text.trimStart();
  for (const token of [agent.name, agent.id]) {
    const re = new RegExp(`^#${escapeRegExp(token)}(?:\\s+|$)`, "i");
    if (re.test(trimmed)) {
      const leadingWs = text.length - text.trimStart().length;
      return `${text.slice(0, leadingWs)}${trimmed.replace(re, "").trimStart()}`;
    }
  }
  return text;
}

export function resolveAgentForSend(
  text: string,
  selectedAgent: CcAgentEntry | null,
  agents: CcAgentEntry[],
): { agent: CcAgentEntry | null; cleanedText: string } {
  if (selectedAgent) {
    return {
      agent: selectedAgent,
      cleanedText: stripAgentPrefix(text, selectedAgent),
    };
  }
  return parseLeadingAgentMention(text, agents);
}

export function sortAgentsWithRecent(
  agents: CcAgentEntry[],
  recentIds: string[],
): CcAgentEntry[] {
  const recent: CcAgentEntry[] = [];
  for (const id of recentIds) {
    const hit = agents.find((a) => a.id === id);
    if (hit && !recent.some((a) => a.id === hit.id && a.scope === hit.scope)) {
      recent.push(hit);
    }
  }
  const recentKeys = new Set(recent.map((a) => `${a.scope}:${a.id}`));
  const rest = [...agents]
    .filter((a) => !recentKeys.has(`${a.scope}:${a.id}`))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  return [...recent, ...rest];
}

export function findAgentById(
  agents: CcAgentEntry[],
  agentId: string | null | undefined,
): CcAgentEntry | null {
  const id = agentId?.trim();
  if (!id) return null;
  return agents.find((a) => a.id === id) ?? null;
}

export function formatContextSummary(paths: string[], agentName?: string | null): string {  const parts: string[] = [];
  if (paths.length) {
    parts.push(`${paths.length} 个文件`);
  }
  if (agentName) {
    parts.push(`#${agentName}`);
  }
  return parts.join(" · ");
}

export const CC_RECENT_CONTEXT_KEY = "cc-workbench-recent-context";
const MAX_RECENT = 12;

export function loadRecentContextPaths(): string[] {
  try {
    const raw = localStorage.getItem(CC_RECENT_CONTEXT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecentContextPaths(paths: string[]) {
  if (!paths.length) return;
  const prev = loadRecentContextPaths();
  const merged = mergeContextPaths(paths, prev).slice(0, MAX_RECENT);
  try {
    localStorage.setItem(CC_RECENT_CONTEXT_KEY, JSON.stringify(merged));
  } catch {
    /* ignore quota */
  }
}

/** 是否为「继续上一轮」类短指令 */
export function isCcContinuationPrompt(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (/^(继续|接着(做|来)?|continue|go\s*on|resume)$/i.test(lower)) return true;
  if (/^继续[\s，,。.!！?？]/.test(trimmed)) return true;
  return trimmed.length <= 24 && /^继续/.test(trimmed);
}

interface CcHistoryMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; input: string; output?: string }[];
  blocks?: { type: string; content?: string; name?: string; input?: string; output?: string }[];
}

const MAX_TOOL_OUTPUT_IN_HISTORY = 800;

function summarizeToolForHistory(tool: { name: string; output?: string }): string {
  if (tool.output === undefined) {
    return `[工具 ${tool.name}: 执行中/已中断]`;
  }
  const preview =
    tool.output.length > MAX_TOOL_OUTPUT_IN_HISTORY
      ? `${tool.output.slice(0, MAX_TOOL_OUTPUT_IN_HISTORY)}…`
      : tool.output;
  return `[工具 ${tool.name} 结果]\n${preview}`;
}

function summarizeAssistantMessage(msg: CcHistoryMessage): string {
  const parts: string[] = [];
  const text =
    msg.content.trim() ||
    (msg.blocks ?? [])
      .filter((b) => b.type === "text" && b.content?.trim())
      .map((b) => b.content!.trim())
      .join("\n");
  if (text) parts.push(text);

  const tools =
    msg.toolCalls ??
    (msg.blocks ?? [])
      .filter((b) => b.type === "tool")
      .map((b) => ({ name: b.name ?? "tool", input: b.input ?? "{}", output: b.output }));

  for (const tool of tools ?? []) {
    parts.push(summarizeToolForHistory(tool));
  }

  return parts.join("\n").trim() || "（无文本回复）";
}

const MAX_HISTORY_CHARS = 12_000;

/**
 * 当 SDK sessionId 缺失或 resume 失效时，将 UI 内已有对话注入 prompt，避免「继续」丢上下文。
 */
export function buildCcPromptWithHistory(
  userText: string,
  priorMessages: CcHistoryMessage[],
  options?: { hasSessionId?: boolean },
): string {
  const history = priorMessages.filter((m) => m.role === "user" || m.role === "assistant");
  if (history.length <= 1) return userText;

  const needsHistory = !options?.hasSessionId;
  if (!needsHistory) return userText;

  const lines: string[] = ["【对话历史 — 请延续以下上下文】"];
  let used = lines[0].length;

  for (const msg of history) {
    const body =
      msg.role === "user"
        ? msg.content.trim()
        : summarizeAssistantMessage(msg);
    if (!body) continue;

    const line = `${msg.role === "user" ? "用户" : "助手"}: ${body}`;
    if (used + line.length + 1 > MAX_HISTORY_CHARS) {
      lines.push("…（更早的消息已省略）");
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }

  lines.push("", "【当前用户消息】", userText);
  return lines.join("\n");
}
