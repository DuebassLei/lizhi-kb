import type { AiChatMode, RagScope } from "../services/aiService";

export type RagSurface = "workspace" | "standalone";

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { id: string; title: string }[];
  toolCalls?: { name: string; input: string; output?: string }[];
  error?: string;
}

export interface ChatSession {
  id: string;
  surface: RagSurface;
  title: string;
  mode: AiChatMode;
  ragScope?: RagScope;
  messages: StoredChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface SurfaceSessionBundle {
  activeId: string | null;
  sessions: ChatSession[];
}

export interface ChatSessionStore {
  workspace: SurfaceSessionBundle;
  standalone: SurfaceSessionBundle;
}

const STORAGE_KEY = "lizhi-kb-chat-sessions-v1";
const MAX_SESSIONS_PER_SURFACE = 50;

function emptyBundle(): SurfaceSessionBundle {
  return { activeId: null, sessions: [] };
}

function emptyStore(): ChatSessionStore {
  return { workspace: emptyBundle(), standalone: emptyBundle() };
}

function isAiChatMode(v: unknown): v is AiChatMode {
  return v === "chat" || v === "rag" || v === "agent";
}

function isRagScope(v: unknown): v is RagScope {
  return v === "all" || v === "currentDocument" || v === "currentFolder";
}

function isRagSurface(v: unknown): v is RagSurface {
  return v === "workspace" || v === "standalone";
}

function normalizeMessage(raw: unknown): StoredChatMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.role !== "user" && m.role !== "assistant") return null;
  if (typeof m.id !== "string" || typeof m.content !== "string") return null;
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    citations: Array.isArray(m.citations) ? (m.citations as StoredChatMessage["citations"]) : undefined,
    toolCalls: Array.isArray(m.toolCalls) ? (m.toolCalls as StoredChatMessage["toolCalls"]) : undefined,
    error: typeof m.error === "string" ? m.error : undefined,
  };
}

function normalizeSession(raw: unknown): ChatSession | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || !isRagSurface(s.surface) || typeof s.title !== "string") {
    return null;
  }
  if (!isAiChatMode(s.mode)) return null;
  const messages = Array.isArray(s.messages)
    ? s.messages.map(normalizeMessage).filter((m): m is StoredChatMessage => m !== null)
    : [];
  return {
    id: s.id,
    surface: s.surface,
    title: s.title,
    mode: s.mode,
    ragScope: isRagScope(s.ragScope) ? s.ragScope : undefined,
    messages,
    createdAt: typeof s.createdAt === "number" ? s.createdAt : Date.now(),
    updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : Date.now(),
  };
}

function normalizeBundle(raw: unknown, surface: RagSurface): SurfaceSessionBundle {
  if (!raw || typeof raw !== "object") return emptyBundle();
  const b = raw as Record<string, unknown>;
  const sessions = Array.isArray(b.sessions)
    ? b.sessions
        .map(normalizeSession)
        .filter((s): s is ChatSession => s !== null && s.surface === surface)
    : [];
  const activeId = typeof b.activeId === "string" ? b.activeId : null;
  const activeExists = activeId ? sessions.some((s) => s.id === activeId) : false;
  return {
    activeId: activeExists ? activeId : (sessions[0]?.id ?? null),
    sessions,
  };
}

export function loadChatSessionStore(): ChatSessionStore {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      workspace: normalizeBundle(parsed.workspace, "workspace"),
      standalone: normalizeBundle(parsed.standalone, "standalone"),
    };
  } catch {
    return emptyStore();
  }
}

export function saveChatSessionStore(store: ChatSessionStore): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    void import("../services/vaultUiStateService").then((m) => m.schedulePersistVaultUiState());
  } catch {
    /* ignore quota */
  }
}

export function getSurfaceBundle(
  store: ChatSessionStore,
  surface: RagSurface,
): SurfaceSessionBundle {
  return store[surface];
}

export function setSurfaceBundle(
  store: ChatSessionStore,
  surface: RagSurface,
  bundle: SurfaceSessionBundle,
): ChatSessionStore {
  const sessions = [...bundle.sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS_PER_SURFACE);
  const activeId = bundle.activeId && sessions.some((s) => s.id === bundle.activeId)
    ? bundle.activeId
    : (sessions[0]?.id ?? null);
  return {
    ...store,
    [surface]: { activeId, sessions },
  };
}

export function createSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function deriveSessionTitle(messages: StoredChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return "新对话";
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  return text.length > 28 ? `${text.slice(0, 28)}…` : text;
}

export function formatSessionTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

const MODE_LABELS: Record<AiChatMode, string> = {
  chat: "闲聊",
  rag: "知识库",
  agent: "笔记助手",
};

export function sessionModeLabel(mode: AiChatMode): string {
  return MODE_LABELS[mode];
}
