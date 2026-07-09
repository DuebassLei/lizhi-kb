import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

import {
  buildLlmOptions,
  getAiConfig,
  isRetrievalTarget,
  loadStoredLlmTarget,
  pickDefaultLlmTarget,
  saveLlmTarget,
  streamAiAgent,
  streamAiChat,
  streamAiRag,
  type AiChatMode,
  type AiConfigPublic,
  type ChatMessage as ApiChatMessage,
  type LlmOption,
  type LlmTarget,
  type RagScope,
  type StreamEvent,
} from "../services/aiService";
import {
  createSessionId,
  deriveSessionTitle,
  getSurfaceBundle,
  loadChatSessionStore,
  saveChatSessionStore,
  setSurfaceBundle,
  type ChatSession,
  type ChatSessionStore,
  type RagSurface,
  type StoredChatMessage,
} from "../utils/chatSessionStorage";
import { useDocumentsStore } from "./documents";
import { useVaultStore } from "./vault";

export type { RagSurface };

export interface Citation {
  id: string;
  title: string;
}

export interface UiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  toolCalls?: { name: string; input: string; output?: string }[];
  streaming?: boolean;
  error?: string;
}

let msgCounter = 0;
function nextMsgId() {
  msgCounter += 1;
  return `msg-${msgCounter}`;
}

const WORKSPACE_RAG_SCOPE_KEY = "lizhi-kb-rag-scope-workspace";

function loadSavedWorkspaceRagScope(): RagScope | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(WORKSPACE_RAG_SCOPE_KEY);
  if (raw === "all" || raw === "currentDocument" || raw === "currentFolder") {
    return raw;
  }
  return null;
}

function saveWorkspaceRagScope(scope: RagScope) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(WORKSPACE_RAG_SCOPE_KEY, scope);
}

function toStoredMessage(message: UiChatMessage): StoredChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    citations: message.citations,
    toolCalls: message.toolCalls,
    error: message.error,
  };
}

function toUiMessage(message: StoredChatMessage): UiChatMessage {
  return { ...message };
}

function createEmptySession(surface: RagSurface, mode: AiChatMode, ragScope?: RagScope): ChatSession {
  const now = Date.now();
  return {
    id: createSessionId(),
    surface,
    title: "新对话",
    mode,
    ragScope,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const useChatStore = defineStore("chat", () => {
  const aiEnabled = ref(false);
  const cloudEnabled = ref(false);
  const aiConfig = ref<AiConfigPublic | null>(null);
  const mode = ref<AiChatMode>("chat");
  const ragSurface = ref<RagSurface>("workspace");
  const ragScope = ref<RagScope>("all");
  const llmTarget = ref<LlmTarget>(loadStoredLlmTarget());
  const sessionStore = ref<ChatSessionStore>(loadChatSessionStore());
  const activeSessionId = ref<string | null>(null);
  const messages = ref<UiChatMessage[]>([]);
  const input = ref("");
  const isStreaming = ref(false);
  const abortFlag = ref(false);

  const documents = useDocumentsStore();
  const vault = useVaultStore();

  const llmOptions = computed<LlmOption[]>(() =>
    aiConfig.value ? buildLlmOptions(aiConfig.value) : [],
  );

  const selectedLlmLabel = computed(() => {
    const hit = llmOptions.value.find((o) => o.id === llmTarget.value);
    return hit?.label ?? "本地模型";
  });

  const canSend = computed(
    () => aiEnabled.value && !isStreaming.value && input.value.trim().length > 0,
  );

  function syncSessionToStore() {
    if (!activeSessionId.value) return;
    const bundle = getSurfaceBundle(sessionStore.value, ragSurface.value);
    const index = bundle.sessions.findIndex((s) => s.id === activeSessionId.value);
    if (index === -1) return;

    const storedMessages = messages.value
      .filter((m) => !m.streaming)
      .map(toStoredMessage);
    const title = deriveSessionTitle(storedMessages);

    bundle.sessions[index] = {
      ...bundle.sessions[index],
      title,
      mode: mode.value,
      ragScope: ragSurface.value === "workspace" ? ragScope.value : undefined,
      messages: storedMessages,
      updatedAt: Date.now(),
    };
    sessionStore.value = setSurfaceBundle(sessionStore.value, ragSurface.value, bundle);
    saveChatSessionStore(sessionStore.value);
  }

  function applySession(session: ChatSession) {
    activeSessionId.value = session.id;
    mode.value = session.mode;
    messages.value = session.messages.map(toUiMessage);
    input.value = "";
    isStreaming.value = false;
    abortFlag.value = false;
    if (session.surface === "workspace" && session.ragScope) {
      ragScope.value = session.ragScope;
    }
  }

  function ensureActiveSession(surface: RagSurface) {
    const bundle = getSurfaceBundle(sessionStore.value, surface);
    let session =
      (bundle.activeId && bundle.sessions.find((s) => s.id === bundle.activeId)) ||
      bundle.sessions[0];

    if (!session) {
      session = createEmptySession(
        surface,
        mode.value,
        surface === "workspace" ? resolveWorkspaceRagScope() : undefined,
      );
      bundle.sessions.unshift(session);
      bundle.activeId = session.id;
      sessionStore.value = setSurfaceBundle(sessionStore.value, surface, bundle);
      saveChatSessionStore(sessionStore.value);
    } else {
      bundle.activeId = session.id;
      sessionStore.value = setSurfaceBundle(sessionStore.value, surface, bundle);
    }

    applySession(session);
  }

  function sessionList(surface: RagSurface) {
    return [...getSurfaceBundle(sessionStore.value, surface).sessions].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  function syncLlmTarget(config: AiConfigPublic) {
    const next = pickDefaultLlmTarget(config);
    llmTarget.value = next;
    saveLlmTarget(next);
  }

  function setLlmTarget(target: LlmTarget) {
    llmTarget.value = target;
    saveLlmTarget(target);
  }

  function resolveWorkspaceRagScope(): RagScope {
    const saved = loadSavedWorkspaceRagScope();
    if (saved === "currentDocument") {
      return documents.activeId ? "currentDocument" : "all";
    }
    if (saved === "currentFolder") {
      const activeDoc = documents.tree.find((d) => d.id === documents.activeId);
      return activeDoc?.folder ? "currentFolder" : "all";
    }
    if (saved) return saved;
    return documents.activeId ? "currentDocument" : "all";
  }

  function setRagSurface(surface: RagSurface) {
    if (surface !== ragSurface.value) {
      syncSessionToStore();
    }
    ragSurface.value = surface;
    if (surface === "standalone") {
      ragScope.value = "all";
    } else {
      ragScope.value = resolveWorkspaceRagScope();
    }
    ensureActiveSession(surface);
  }

  function setRagScope(scope: RagScope) {
    if (ragSurface.value === "standalone") return;
    ragScope.value = scope;
    syncSessionToStore();
  }

  function setMode(next: AiChatMode) {
    if (next === mode.value || isStreaming.value) return;
    syncSessionToStore();

    const surface = ragSurface.value;
    const bundle = getSurfaceBundle(sessionStore.value, surface);
    const sameModeSessions = bundle.sessions
      .filter((s) => s.mode === next)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (sameModeSessions.length > 0) {
      bundle.activeId = sameModeSessions[0].id;
      sessionStore.value = setSurfaceBundle(sessionStore.value, surface, bundle);
      saveChatSessionStore(sessionStore.value);
      applySession(sameModeSessions[0]);
      return;
    }

    const session = createEmptySession(
      surface,
      next,
      surface === "workspace" && next === "rag" ? resolveWorkspaceRagScope() : undefined,
    );
    bundle.sessions.unshift(session);
    bundle.activeId = session.id;
    sessionStore.value = setSurfaceBundle(sessionStore.value, surface, bundle);
    saveChatSessionStore(sessionStore.value);
    applySession(session);
  }

  function newSession() {
    if (isStreaming.value) return;
    syncSessionToStore();
    const surface = ragSurface.value;
    const session = createEmptySession(
      surface,
      mode.value,
      surface === "workspace" ? ragScope.value : undefined,
    );
    const bundle = getSurfaceBundle(sessionStore.value, surface);
    bundle.sessions.unshift(session);
    bundle.activeId = session.id;
    sessionStore.value = setSurfaceBundle(sessionStore.value, surface, bundle);
    saveChatSessionStore(sessionStore.value);
    applySession(session);
  }

  function selectSession(sessionId: string) {
    if (isStreaming.value) return;
    syncSessionToStore();
    const bundle = getSurfaceBundle(sessionStore.value, ragSurface.value);
    const session = bundle.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    bundle.activeId = session.id;
    sessionStore.value = setSurfaceBundle(sessionStore.value, ragSurface.value, bundle);
    saveChatSessionStore(sessionStore.value);
    applySession(session);
  }

  function deleteSession(sessionId: string) {
    if (isStreaming.value) return;
    const surface = ragSurface.value;
    const bundle = getSurfaceBundle(sessionStore.value, surface);
    bundle.sessions = bundle.sessions.filter((s) => s.id !== sessionId);

    if (bundle.activeId === sessionId) {
      bundle.activeId = bundle.sessions[0]?.id ?? null;
      if (bundle.sessions[0]) {
        applySession(bundle.sessions[0]);
      } else {
        const session = createEmptySession(
          surface,
          mode.value,
          surface === "workspace" ? ragScope.value : undefined,
        );
        bundle.sessions.unshift(session);
        bundle.activeId = session.id;
        applySession(session);
      }
    }

    sessionStore.value = setSurfaceBundle(sessionStore.value, surface, bundle);
    saveChatSessionStore(sessionStore.value);
  }

  function clearAllSessions(surface: RagSurface = ragSurface.value) {
    if (isStreaming.value) return;
    const session = createEmptySession(
      surface,
      mode.value,
      surface === "workspace" ? ragScope.value : undefined,
    );
    const bundle: { activeId: string | null; sessions: ChatSession[] } = {
      activeId: session.id,
      sessions: [session],
    };
    sessionStore.value = setSurfaceBundle(sessionStore.value, surface, bundle);
    saveChatSessionStore(sessionStore.value);
    if (surface === ragSurface.value) {
      applySession(session);
    }
  }

  async function exportSessions(format: "md" | "json", surface: RagSurface = ragSurface.value) {
    syncSessionToStore();
    const sessions = getSurfaceBundle(sessionStore.value, surface).sessions.filter(
      (s) => s.messages.length > 0,
    );
    const { exportChatSessions } = await import("../utils/exportChatSessions");
    return exportChatSessions(surface, sessions, format);
  }

  async function loadAiEnabled() {
    try {
      const config = await getAiConfig();
      aiConfig.value = config;
      aiEnabled.value = config.enabled;
      cloudEnabled.value = config.cloudEnabled;
      syncLlmTarget(config);
    } catch {
      aiConfig.value = null;
      aiEnabled.value = false;
      cloudEnabled.value = false;
    }
  }

  function clear() {
    newSession();
  }

  function stop() {
    abortFlag.value = true;
    isStreaming.value = false;
    const last = messages.value[messages.value.length - 1];
    if (last?.role === "assistant" && last.streaming) {
      patchMessage(last.id, { streaming: false });
    }
    syncSessionToStore();
  }

  function patchMessage(id: string, patch: Partial<UiChatMessage>) {
    const index = messages.value.findIndex((m) => m.id === id);
    if (index === -1) return;
    messages.value[index] = { ...messages.value[index], ...patch };
  }

  function appendAssistantShell(): string {
    const id = nextMsgId();
    messages.value.push({
      id,
      role: "assistant",
      content: "",
      citations: [],
      toolCalls: [],
      streaming: true,
    });
    return id;
  }

  function handleStreamEvent(messageId: string, event: StreamEvent) {
    if (abortFlag.value) return;

    const current = messages.value.find((m) => m.id === messageId);
    if (!current) return;

    switch (event.type) {
      case "token":
        patchMessage(messageId, { content: current.content + event.content });
        break;
      case "citation": {
        const citations = [...(current.citations ?? [])];
        if (!citations.some((c) => c.id === event.id)) {
          citations.push({ id: event.id, title: event.title });
        }
        patchMessage(messageId, { citations });
        break;
      }
      case "toolCall": {
        const toolCalls = [...(current.toolCalls ?? [])];
        toolCalls.push({ name: event.name, input: event.input });
        patchMessage(messageId, { toolCalls });
        break;
      }
      case "toolResult": {
        const toolCalls = [...(current.toolCalls ?? [])];
        const last = [...toolCalls].reverse().find((t) => t.name === event.name && !t.output);
        if (last) last.output = event.output;
        patchMessage(messageId, { toolCalls });
        break;
      }
      case "error":
        patchMessage(messageId, { error: event.message, streaming: false });
        break;
      case "done":
        patchMessage(messageId, { streaming: false });
        break;
      default:
        break;
    }
  }

  async function send() {
    const text = input.value.trim();
    if (!text || isStreaming.value || !aiEnabled.value) return;

    if (!activeSessionId.value) {
      ensureActiveSession(ragSurface.value);
    }

    messages.value.push({ id: nextMsgId(), role: "user", content: text });
    input.value = "";
    isStreaming.value = true;
    abortFlag.value = false;
    syncSessionToStore();

    const assistantId = appendAssistantShell();
    const history: ApiChatMessage[] = messages.value
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    const target = llmTarget.value;

    try {
      const onEvent = (event: StreamEvent) => handleStreamEvent(assistantId, event);

      if (isRetrievalTarget(target) && mode.value !== "rag") {
        patchMessage(assistantId, {
          error: "「仅检索」模式仅适用于「知识库」问答，请切换模式或选择大模型",
          streaming: false,
        });
        return;
      }

      if (mode.value === "rag") {
        const activeDoc = documents.tree.find((d) => d.id === documents.activeId);
        const inWorkspace = ragSurface.value === "workspace";
        let scope = inWorkspace ? ragScope.value : "all";
        let documentId = inWorkspace ? documents.activeId : null;
        let folder = inWorkspace ? (activeDoc?.folder ?? null) : null;

        if (inWorkspace && scope === "currentDocument" && !documentId) {
          scope = "all";
          documentId = null;
        }
        if (inWorkspace && scope === "currentFolder" && !folder) {
          scope = "all";
          folder = null;
        }

        await streamAiRag(
          {
            question: text,
            scope,
            documentId,
            folder,
            llmTarget: target,
          },
          onEvent,
        );
      } else if (mode.value === "agent") {
        await streamAiAgent(text, target, onEvent, [
          ...history,
          { role: "user", content: text },
        ]);
      } else {
        await streamAiChat(
          [...history, { role: "user", content: text }],
          target,
          onEvent,
        );
      }
    } catch (e) {
      if (!abortFlag.value) {
        patchMessage(assistantId, {
          error: e instanceof Error ? e.message : "请求失败",
        });
      }
    } finally {
      isStreaming.value = false;
      const assistant = messages.value.find((m) => m.id === assistantId);
      if (assistant?.streaming) {
        patchMessage(assistantId, { streaming: false });
      }
      if (
        assistant &&
        !assistant.content &&
        !assistant.error &&
        !(assistant.toolCalls?.length)
      ) {
        patchMessage(assistantId, {
          error: abortFlag.value
            ? "已停止生成"
            : "模型未返回内容，请检查模型配置或连接状态",
        });
      }
      syncSessionToStore();
    }
  }

  watch(
    () => vault.isLocked,
    (locked) => {
      if (locked) {
        messages.value = [];
        input.value = "";
        isStreaming.value = false;
        abortFlag.value = false;
        activeSessionId.value = null;
      } else {
        sessionStore.value = loadChatSessionStore();
        ensureActiveSession(ragSurface.value);
      }
    },
  );

  watch(ragScope, (scope) => {
    if (ragSurface.value === "workspace") {
      saveWorkspaceRagScope(scope);
      syncSessionToStore();
    }
  });

  watch(mode, () => {
    if (!isStreaming.value) {
      syncSessionToStore();
    }
  });

  function reloadSessionsFromStorage() {
    sessionStore.value = loadChatSessionStore();
    ensureActiveSession(ragSurface.value);
  }

  return {
    aiEnabled,
    cloudEnabled,
    aiConfig,
    mode,
    ragSurface,
    ragScope,
    llmTarget,
    llmOptions,
    selectedLlmLabel,
    activeSessionId,
    messages,
    input,
    isStreaming,
    canSend,
    loadAiEnabled,
    setLlmTarget,
    setRagSurface,
    setRagScope,
    setMode,
    sessionList,
    newSession,
    selectSession,
    deleteSession,
    clearAllSessions,
    exportSessions,
    clear,
    stop,
    send,
    reloadSessionsFromStorage,
  };
});
