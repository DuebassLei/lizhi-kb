import { Channel, invoke } from "@tauri-apps/api/core";

import { tauriInvoke } from "../composables/useTauriCommand";

export type AiChatMode = "chat" | "rag" | "agent";
export type RagScope = "all" | "currentDocument" | "currentFolder";

/** `local` = Ollama；`retrieval` = 仅全文检索；否则为云端提供商 id */
export const LLM_RETRIEVAL_TARGET = "retrieval" as const;
export type LlmTarget = typeof LLM_RETRIEVAL_TARGET | "local" | string;

export interface CloudProviderPublic {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKeyMasked: string;
  apiKey?: string | null;
}

export interface CloudProviderInput {
  id?: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface AiConfigPublic {
  enabled: boolean;
  provider: string;
  localBaseUrl: string;
  localModel: string;
  cloudEnabled: boolean;
  cloudProviders: CloudProviderPublic[];
  activeCloudProviderId: string | null;
  ragTopK: number;
  writeEnabled: boolean;
  networkHosts: string[];
}

export interface AiConfigUpdate {
  enabled?: boolean;
  provider?: string;
  localBaseUrl?: string;
  localModel?: string;
  cloudEnabled?: boolean;
  cloudProviders?: CloudProviderInput[];
  activeCloudProviderId?: string | null;
  ragTopK?: number;
  writeEnabled?: boolean;
  networkHosts?: string[];
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ConnectionResult {
  ok: boolean;
  message: string;
  model?: string | null;
}

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "citation"; id: string; title: string }
  | { type: "toolCall"; name: string; input: string }
  | { type: "toolResult"; name: string; output: string }
  | { type: "done" }
  | { type: "error"; message: string };

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const DEFAULT_CONFIG: AiConfigPublic = {
  enabled: false,
  provider: "ollama",
  localBaseUrl: "http://127.0.0.1:11434",
  localModel: "qwen2.5:7b",
  cloudEnabled: false,
  cloudProviders: [],
  activeCloudProviderId: null,
  ragTopK: 8,
  writeEnabled: false,
  networkHosts: ["127.0.0.1", "localhost"],
};

function createStreamChannel(onEvent: (event: StreamEvent) => void): Channel<StreamEvent> {
  return new Channel<StreamEvent>((event) => {
    onEvent(event);
  });
}

function cloudProviderIdFromTarget(target: LlmTarget): string | null {
  if (target === "local" || target === LLM_RETRIEVAL_TARGET) return null;
  return target;
}

export function isRetrievalTarget(target: LlmTarget): boolean {
  return target === LLM_RETRIEVAL_TARGET;
}

export async function getAiConfig(revealKey = false): Promise<AiConfigPublic> {
  if (!isTauriRuntime()) return { ...DEFAULT_CONFIG };
  return tauriInvoke<AiConfigPublic>("get_ai_config", { revealKey });
}

export async function setAiConfig(update: AiConfigUpdate): Promise<AiConfigPublic> {
  if (!isTauriRuntime()) {
    const { cloudProviders, ...rest } = update;
    const next: AiConfigPublic = { ...DEFAULT_CONFIG, ...rest };
    if (cloudProviders) {
      next.cloudProviders = cloudProviders.map((p) => ({
        id: p.id ?? crypto.randomUUID(),
        name: p.name,
        baseUrl: p.baseUrl,
        model: p.model,
        apiKeyMasked: p.apiKey ? "••••" : "",
      }));
    }
    return next;
  }
  return tauriInvoke<AiConfigPublic>("set_ai_config", { update });
}

export async function testAiConnection(target: LlmTarget): Promise<ConnectionResult> {
  if (isRetrievalTarget(target)) {
    return { ok: true, message: "仅检索模式无需连接大模型", model: null };
  }
  if (!isTauriRuntime()) {
    return { ok: false, message: "浏览器预览模式不支持连接测试", model: null };
  }
  const providerId = cloudProviderIdFromTarget(target);
  const invokeTest = tauriInvoke<ConnectionResult>("test_ai_connection", {
    request: { providerId },
  });
  const timeout = new Promise<ConnectionResult>((_, reject) => {
    setTimeout(() => reject(new Error("连接测试超时（20 秒），请检查网络或 API Key")), 22_000);
  });
  return Promise.race([invokeTest, timeout]);
}

export interface RagQueryOptions {
  question: string;
  scope?: RagScope;
  documentId?: string | null;
  folder?: string | null;
  selection?: string | null;
  llmTarget?: LlmTarget;
}

export async function streamAiChat(
  messages: ChatMessage[],
  llmTarget: LlmTarget,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  if (!isTauriRuntime()) {
    onEvent({ type: "token", content: "（浏览器预览模式：请在 Tauri 应用中测试 AI 对话）" });
    onEvent({ type: "done" });
    return;
  }

  await invoke("ai_chat_stream", {
    request: {
      messages,
      cloudProviderId: cloudProviderIdFromTarget(llmTarget),
      useCloud: llmTarget !== "local",
    },
    onEvent: createStreamChannel(onEvent),
  });
}

export async function streamAiRag(
  options: RagQueryOptions,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  if (!isTauriRuntime()) {
    onEvent({ type: "token", content: "（浏览器预览模式：请在 Tauri 应用中测试知识库问答）" });
    onEvent({ type: "done" });
    return;
  }

  const target = options.llmTarget ?? "local";
  const retrievalOnly = isRetrievalTarget(target);
  await invoke("ai_rag_query", {
    request: {
      question: options.question,
      scope: options.scope ?? "all",
      documentId: options.documentId ?? null,
      folder: options.folder ?? null,
      selection: options.selection ?? null,
      cloudProviderId: cloudProviderIdFromTarget(target),
      useCloud: !retrievalOnly && target !== "local",
      retrievalOnly,
    },
    onEvent: createStreamChannel(onEvent),
  });
}

export async function streamAiAgent(
  instruction: string,
  llmTarget: LlmTarget,
  onEvent: (event: StreamEvent) => void,
  messages: ChatMessage[] = [],
): Promise<void> {
  if (!isTauriRuntime()) {
    onEvent({ type: "token", content: "（浏览器预览模式：请在 Tauri 应用中测试笔记助手）" });
    onEvent({ type: "done" });
    return;
  }

  await invoke("ai_agent_run", {
    request: {
      instruction,
      messages,
      cloudProviderId: cloudProviderIdFromTarget(llmTarget),
      useCloud: llmTarget !== "local",
    },
    onEvent: createStreamChannel(onEvent),
  });
}

export interface LlmOption {
  id: LlmTarget;
  label: string;
  description: string;
}

export function buildLlmOptions(config: AiConfigPublic): LlmOption[] {
  const options: LlmOption[] = [
    {
      id: LLM_RETRIEVAL_TARGET,
      label: "仅检索 · 无模型",
      description: "全文检索笔记摘录，不调用大模型",
    },
    {
      id: "local",
      label: `本地 · ${config.localModel}`,
      description: config.localBaseUrl,
    },
  ];
  if (config.cloudEnabled) {
    for (const p of config.cloudProviders) {
      options.push({
        id: p.id,
        label: `${p.name} · ${p.model}`,
        description: p.baseUrl,
      });
    }
  }
  return options;
}

export function pickDefaultLlmTarget(config: AiConfigPublic): LlmTarget {
  const stored = loadStoredLlmTarget();
  const options = buildLlmOptions(config);
  if (options.some((o) => o.id === stored)) return stored;
  if (
    config.activeCloudProviderId &&
    options.some((o) => o.id === config.activeCloudProviderId)
  ) {
    return config.activeCloudProviderId;
  }
  return "local";
}

const LLM_TARGET_KEY = "lizhi-kb-ai-llm-target";

export function loadStoredLlmTarget(): LlmTarget {
  if (typeof localStorage === "undefined") return "local";
  return localStorage.getItem(LLM_TARGET_KEY) ?? "local";
}

export function saveLlmTarget(target: LlmTarget) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LLM_TARGET_KEY, target);
}
