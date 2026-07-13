import { Channel, invoke } from "@tauri-apps/api/core";

import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "./vaultService";

export type AiChatMode = "chat" | "rag" | "agent";
export type RagScope = "all" | "currentDocument" | "currentFolder";

/** `local` = Ollama；`retrieval` = 仅全文检索；`auto` = 本地优先；否则为云端提供商 id */
export const LLM_RETRIEVAL_TARGET = "retrieval" as const;
export const LLM_AUTO_TARGET = "auto" as const;
export type LlmTarget =
  | typeof LLM_RETRIEVAL_TARGET
  | typeof LLM_AUTO_TARGET
  | "local"
  | string;

export interface CloudProviderPublic {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  enabled?: boolean;
  apiKeyMasked: string;
  apiKey?: string | null;
}

export interface CloudProviderInput {
  id?: string;
  name: string;
  baseUrl: string;
  model: string;
  enabled?: boolean;
  apiKey?: string;
}

export interface AiConfigPublic {
  enabled: boolean;
  provider: string;
  localBaseUrl: string;
  localModel: string;
  localEnabled: boolean;
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
  localEnabled?: boolean;
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
  | { type: "thinking"; content: string }
  | { type: "citation"; id: string; title: string }
  | { type: "toolCall"; name: string; input: string; toolUseId?: string }
  | { type: "toolResult"; name: string; output: string; toolUseId?: string }
  | { type: "toolPermission"; requestId: string; toolName: string; input: string }
  | { type: "session"; sessionId: string }
  | {
      type: "usage";
      inputTokens: number;
      outputTokens: number;
      contextTotalTokens?: number;
      contextMaxTokens?: number;
      contextPercentage?: number;
    }
  | { type: "done" }
  | { type: "error"; message: string };

const DEFAULT_CONFIG: AiConfigPublic = {
  enabled: false,
  provider: "ollama",
  localBaseUrl: "http://127.0.0.1:11434",
  localModel: "qwen2.5:7b",
  localEnabled: true,
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
  if (
    target === "local" ||
    target === LLM_RETRIEVAL_TARGET ||
    target === LLM_AUTO_TARGET
  ) {
    return null;
  }
  return target;
}

export function isAutoTarget(target: LlmTarget): boolean {
  return target === LLM_AUTO_TARGET;
}

export function isRetrievalTarget(target: LlmTarget): boolean {
  return target === LLM_RETRIEVAL_TARGET;
}

/** 自动模式：优先本地 Ollama */
export function resolveAutoTarget(_config: AiConfigPublic): LlmTarget {
  return "local";
}

/** 将 UI 选择的目标解析为实际调用目标 */
export function resolveLlmTarget(
  target: LlmTarget,
  config: AiConfigPublic,
): LlmTarget {
  if (isAutoTarget(target)) return resolveAutoTarget(config);
  return target;
}

/** 自动模式失败时的云端兜底顺序 */
export function getCloudFallbackTargets(config: AiConfigPublic): LlmTarget[] {
  if (!config.cloudEnabled || config.cloudProviders.length === 0) return [];
  const ids = config.cloudProviders
    .filter((p) => p.enabled !== false)
    .map((p) => p.id);
  const active = config.activeCloudProviderId;
  if (active && ids.includes(active)) {
    return [active, ...ids.filter((id) => id !== active)];
  }
  return ids;
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
  if (isAutoTarget(target)) {
    return testAiConnection("local");
  }
  if (!isTauriRuntime()) {
    return { ok: false, message: "浏览器预览模式不支持连接测试", model: null };
  }
  const providerId = cloudProviderIdFromTarget(target);
  const invokeTest = tauriInvoke<ConnectionResult>("test_ai_connection", {
    request: { providerId },
  });
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<ConnectionResult>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("连接测试超时（20 秒），请检查网络或 API Key")),
      22_000,
    );
  });
  try {
    return await Promise.race([invokeTest, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  options?: { scope?: RagScope; documentId?: string | null; folder?: string | null },
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
      scope: options?.scope ?? "all",
      documentId: options?.documentId ?? null,
      folder: options?.folder ?? null,
      cloudProviderId: cloudProviderIdFromTarget(llmTarget),
      useCloud: llmTarget !== "local",
    },
    onEvent: createStreamChannel(onEvent),
  });
}

export type LlmOptionGroup = "smart" | "local" | "cloud";

export interface LlmOption {
  id: LlmTarget;
  label: string;
  shortLabel: string;
  description: string;
  group: LlmOptionGroup;
  badge?: string;
  keywords: string;
}

const GROUP_LABELS: Record<LlmOptionGroup, string> = {
  smart: "智能选择",
  local: "本地模型",
  cloud: "云端模型",
};

export function llmOptionGroupLabel(group: LlmOptionGroup): string {
  return GROUP_LABELS[group];
}

export function buildLlmOptions(config: AiConfigPublic): LlmOption[] {
  const options: LlmOption[] = [
    {
      id: LLM_AUTO_TARGET,
      label: "自动",
      shortLabel: "自动",
      description: "优先本地 Ollama，失败时尝试云端模型",
      group: "smart",
      badge: "推荐",
      keywords: "auto automatic 自动 本地优先",
    },
    {
      id: LLM_RETRIEVAL_TARGET,
      label: "仅检索",
      shortLabel: "仅检索",
      description: "全文检索笔记摘录，不调用大模型",
      group: "smart",
      badge: "零外联",
      keywords: "retrieval search 检索 无模型",
    },
  ];
  if (config.localEnabled !== false) {
    options.push({
      id: "local",
      label: config.localModel,
      shortLabel: config.localModel,
      description: config.localBaseUrl,
      group: "local",
      badge: "本地",
      keywords: `local ollama ${config.localModel} ${config.localBaseUrl}`,
    });
  }
  if (config.cloudEnabled) {
    for (const p of config.cloudProviders) {
      if (p.enabled === false) continue;
      options.push({
        id: p.id,
        label: p.model,
        shortLabel: p.name,
        description: p.baseUrl,
        group: "cloud",
        badge: "云端",
        keywords: `cloud ${p.name} ${p.model} ${p.baseUrl}`,
      });
    }
  }
  return options;
}

export function findLlmOption(
  options: LlmOption[],
  target: LlmTarget,
): LlmOption | undefined {
  return options.find((o) => o.id === target);
}

export function llmTriggerLabel(
  target: LlmTarget,
  options: LlmOption[],
  config: AiConfigPublic | null,
): string {
  return llmTriggerParts(target, options, config).primary;
}

export function llmTriggerTitle(
  target: LlmTarget,
  options: LlmOption[],
  config: AiConfigPublic | null,
): string {
  const parts = llmTriggerParts(target, options, config);
  if (parts.secondary) return `${parts.primary} · ${parts.secondary}`;
  const hit = findLlmOption(options, target);
  return hit?.description ?? parts.primary;
}

/** 触发器文案：primary 单行展示，secondary 仅 tooltip */
export function llmTriggerParts(
  target: LlmTarget,
  options: LlmOption[],
  config: AiConfigPublic | null,
): { primary: string; secondary?: string } {
  if (isAutoTarget(target)) {
    const resolved = config ? resolveLlmTarget(target, config) : "local";
    const resolvedOpt = findLlmOption(options, resolved);
    if (!resolvedOpt) return { primary: "自动" };
    return {
      primary: "自动",
      secondary:
        resolvedOpt.group === "cloud"
          ? `${resolvedOpt.shortLabel} · ${resolvedOpt.label}`
          : resolvedOpt.label,
    };
  }
  const hit = findLlmOption(options, target);
  if (!hit) return { primary: "本地模型" };
  if (hit.group === "cloud") {
    return { primary: hit.label, secondary: hit.shortLabel };
  }
  return { primary: hit.shortLabel || hit.label };
}

export function pickDefaultLlmTarget(config: AiConfigPublic): LlmTarget {
  const stored = loadStoredLlmTarget();
  const options = buildLlmOptions(config);
  if (options.some((o) => o.id === stored)) return stored;
  return LLM_AUTO_TARGET;
}

const LLM_TARGET_KEY = "lizhi-kb-ai-llm-target";

export function loadStoredLlmTarget(): LlmTarget {
  if (typeof localStorage === "undefined") return LLM_AUTO_TARGET;
  return localStorage.getItem(LLM_TARGET_KEY) ?? LLM_AUTO_TARGET;
}

export function saveLlmTarget(target: LlmTarget) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LLM_TARGET_KEY, target);
}
