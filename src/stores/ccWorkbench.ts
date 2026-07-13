import { defineStore } from "pinia";
import { computed, onScopeDispose, ref, watch } from "vue";

import type { StreamEvent } from "../services/aiService";
import {
  abortCcWorkbenchStream,
  cwdModeDisplay,
  getCcWorkbenchConfig,
  getCcWorkbenchStatus,
  pickProjectDirectory,
  respondCcToolPermission,
  setCcWorkbenchConfig,
  streamCcWorkbench,
  listCcAgents,
  pickCcChatAttachments,
  type CcAgentEntry,
  type CcProviderPublic,
  type CcWorkbenchConfigPublic,
  type CcWorkbenchStatus,
  type CwdMode,
} from "../services/ccWorkbenchService";
import { deriveCcStatusPanel, type CcStatusTab } from "../composables/cc/useCcStatusPanel";
import { getCcModelCatalogOps } from "../composables/cc/useCcModelCatalog";
import { activateCcProvider } from "../composables/cc/useCcProviderSwitch";
import {
  buildCcPromptWithHistory,
  findAgentById,
  loadDefaultAgentId,
  mergeContextPaths,
  parseAtMentions,
  pushRecentAgentId,
  pushRecentContextPaths,
  resolveAgentForSend,
} from "../utils/ccContextUtils";
import {
  resolveEffortFromProvider,
  strip1mSuffix,
  modelSupports1m,
  type CcChatModelOption,
  type CcModelSlot,
  type CcPermissionMode,
  type CcReasoningEffort,
} from "../utils/ccChatModels";
import {
  apply1mSuffix,
  buildCcModelCatalog,
  defaultCatalogModelId,
} from "../utils/ccModelCatalog";
import {
  applyThinkingToBlocks,
  applyTokenToBlocks,
  applyToolCallToBlocks,
  applyToolResultToBlocks,
  resetStreamingBlockSyncState,
  resolveMessageBlocks,
  syncLegacyFromBlocks,
  type CcMessageBlock,
} from "../utils/ccMessageBlocks";
import {
  mergeAttachments,
  type CcChatAttachment,
} from "../utils/ccAttachments";
import { useUiStore } from "./ui";

export interface CcMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  contextFiles?: string[];
  attachments?: CcChatAttachment[];
  agentName?: string;
  toolCalls?: { id?: string; name: string; input: string; output?: string }[];
  blocks?: CcMessageBlock[];
  streaming?: boolean;
  error?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextMaxTokens?: number;
  modelLabel?: string;
}

export interface PendingToolPermission {
  requestId: string;
  toolName: string;
  input: string;
}

interface CcChatPrefs {
  selectedModelId: string;
  permissionMode: CcPermissionMode;
  reasoningEffort: CcReasoningEffort;
  disableThinking?: boolean;
}

const HISTORY_KEY = "cc-workbench-session-history";
const MAX_HISTORY = 20;

interface CcSessionHistoryEntry {
  id: string;
  title: string;
  updatedAt: number;
  messages: CcMessage[];
  sessionId: string | null;
  openedFiles: string[];
  selectedAgent: CcAgentEntry | null;
}

let msgCounter = 0;
function nextMsgId() {
  msgCounter += 1;
  return `cc-msg-${msgCounter}`;
}

function finiteTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function usageEventNumber(event: StreamEvent, camel: string, snake: string): number {
  if (event.type !== "usage") return 0;
  const record = event as unknown as Record<string, unknown>;
  const raw = record[camel] ?? record[snake];
  if (typeof raw === "number") return finiteTokenCount(raw);
  if (typeof raw === "string" && raw.trim()) return finiteTokenCount(Number(raw));
  return 0;
}

function usageEventPercent(event: StreamEvent): number | null {
  if (event.type !== "usage") return null;
  const record = event as unknown as Record<string, unknown>;
  const raw = record.contextPercentage ?? record.context_percentage;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

function loadChatPrefs(): Partial<CcChatPrefs> {
  return getCcModelCatalogOps().prefs.value;
}

function saveChatPrefs(prefs: Partial<CcChatPrefs> & {
  longContextEnabled?: boolean;
  perProvider?: ReturnType<typeof getCcModelCatalogOps>["prefs"]["value"]["perProvider"];
  customModels?: ReturnType<typeof getCcModelCatalogOps>["prefs"]["value"]["customModels"];
}) {
  getCcModelCatalogOps().updateSessionPrefs({
    ...getCcModelCatalogOps().prefs.value,
    ...prefs,
  });
}

function loadHistory(): CcSessionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CcSessionHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: CcSessionHistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore quota errors */
  }
}

function sessionTitle(msgs: CcMessage[]): string {
  const first = msgs.find((m) => m.role === "user" && m.content.trim());
  if (!first) return "未命名会话";
  const text = first.content.trim();
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

function formatModelLabel(id: string, supports1m: boolean): string {
  const suffix = supports1m ? " (1M)" : "";
  return `${id}${suffix}`;
}

export const useCcWorkbenchStore = defineStore("ccWorkbench", () => {
  const catalog = getCcModelCatalogOps();
  const savedPrefs = loadChatPrefs();

  const config = ref<CcWorkbenchConfigPublic | null>(null);
  const status = ref<CcWorkbenchStatus | null>(null);
  const messages = ref<CcMessage[]>([]);
  const input = ref("");
  const streaming = ref(false);
  const sessionId = ref<string | null>(null);
  const inputTokens = ref(0);
  const outputTokens = ref(0);
  const contextTotalFromStream = ref(0);
  const contextMaxFromStream = ref(0);
  const contextPercentFromStream = ref<number | null>(null);
  const history = ref<CcSessionHistoryEntry[]>(loadHistory());
  const activeHistoryId = ref<string | null>(null);
  const loadError = ref<string | null>(null);
  const statusPanelExpanded = ref(false);
  const statusPanelTab = ref<CcStatusTab | null>(null);
  const openedFiles = ref<string[]>([]);
  const attachments = ref<CcChatAttachment[]>([]);
  const selectedAgent = ref<CcAgentEntry | null>(null);
  const agentsCache = ref<CcAgentEntry[]>([]);
  const disableThinking = ref(savedPrefs.disableThinking ?? false);
  const pendingToolPermission = ref<PendingToolPermission | null>(null);
  const customSessionTitle = ref<string | null>(null);
  const switchingProvider = ref(false);
  const catalogVersion = ref(0);

  const selectedModelId = ref(savedPrefs.selectedModelId ?? "");
  const permissionMode = ref<CcPermissionMode>(savedPrefs.permissionMode ?? "default");
  const reasoningEffort = ref<CcReasoningEffort>(savedPrefs.reasoningEffort ?? "high");
  const longContextEnabled = ref(catalog.prefs.value.longContextEnabled ?? true);

  const offCatalogChange = catalog.onCatalogChange(() => {
    catalogVersion.value += 1;
    longContextEnabled.value = catalog.prefs.value.longContextEnabled ?? true;
    syncModelStateFromProvider();
  });
  onScopeDispose(offCatalogChange);

  const providers = computed(() => config.value?.providers ?? []);

  const activeProvider = computed(
    () => providers.value.find((p) => p.isActive) ?? null,
  );

  const modelOptions = computed((): CcChatModelOption[] => {
    void catalogVersion.value;
    const provider = activeProvider.value;
    if (!provider) return [];
    return buildCcModelCatalog(
      provider,
      catalog.getCustomModels(provider.id),
      catalog.getRecentModelIds(provider.id),
      longContextEnabled.value,
    );
  });

  const ready = computed(() => {
    const s = status.value;
    const c = config.value;
    if (!s || !c?.enabled) return false;
    return s.nodeAvailable && s.bridgeAvailable && s.sdkInstalled;
  });

  const statusHint = computed(() => {
    const s = status.value;
    const c = config.value;
    if (!s) return "正在检测运行时…";
    if (!s.nodeAvailable) return "需要安装 Node.js 18+";
    if (!s.bridgeAvailable) return "未找到 ai-bridge 桥接脚本";
    if (!s.sdkInstalled) return "请在设置中安装 Claude Agent SDK";
    const active = c?.providers?.find((p) => p.isActive);
    if (active?.providerMode === "custom" && !active.baseUrl?.trim()) {
      return "当前供应商需填写 Base URL";
    }
    if (active && !active.apiKeyMasked && !c?.apiKeyMasked) {
      return `请为「${active.name}」配置 API Key`;
    }
    if (c?.cwdMode === "vault" && !s.mcpEnabled) {
      return "vault 模式需开启 MCP（设置 → AI 集成 / MCP）";
    }
    if (c?.cwdMode === "project") {
      const path = c.projectPath?.trim() ?? "";
      if (!path) return "本地项目模式需先在设置中选择项目目录";
      if (/^[A-Za-z]:[\\/]?$/.test(path)) {
        return "项目路径无效（不能仅为盘符），请重新选择项目文件夹";
      }
    }
    return null;
  });

  const cwdModeLabelText = computed(() => {
    const mode = config.value?.cwdMode ?? "vault";
    return cwdModeDisplay(mode, config.value?.projectPath);
  });

  const contextWindow = computed(() => {
    const id = selectedModelId.value;
    return id && modelSupports1m(id) ? 1_000_000 : 200_000;
  });

  const effectiveContextMax = computed(() => {
    const fromStream = finiteTokenCount(contextMaxFromStream.value);
    return fromStream > 0 ? fromStream : contextWindow.value;
  });

  const contextLabel = computed(() => {
    const parts: string[] = [];
    if (attachments.value.length) {
      parts.push(`${attachments.value.length} 个附件`);
    }
    if (openedFiles.value.length) {
      parts.push(`${openedFiles.value.length} 个上下文`);
    }
    if (selectedAgent.value) {
      parts.push(`#${selectedAgent.value.name}`);
    }
    return parts.join(" · ");
  });

  const contextUsedTokens = computed(() => {
    const fromStream = finiteTokenCount(contextTotalFromStream.value);
    if (fromStream > 0) return fromStream;
    return finiteTokenCount(inputTokens.value) + finiteTokenCount(outputTokens.value);
  });

  const contextPercentage = computed(() => {
    const pctFromStream = contextPercentFromStream.value;
    if (typeof pctFromStream === "number" && Number.isFinite(pctFromStream) && pctFromStream > 0) {
      return Math.min(99, Math.round(pctFromStream));
    }
    const total = contextUsedTokens.value;
    const max =
      finiteTokenCount(contextMaxFromStream.value) > 0
        ? finiteTokenCount(contextMaxFromStream.value)
        : contextWindow.value;
    if (!Number.isFinite(total) || !Number.isFinite(max) || total <= 0 || max <= 0) return 0;
    return Math.min(99, Math.round((total / max) * 100));
  });

  const sessionTitleText = computed(() => {
    const custom = customSessionTitle.value?.trim();
    if (custom) return custom;
    if (!messages.value.length) return "新会话";
    return sessionTitle(messages.value);
  });

  const selectedModelSlot = computed((): CcModelSlot => {
    const opt = modelOptions.value.find((o) => o.id === selectedModelId.value);
    return opt?.slot ?? "sonnet";
  });

  const statusPanelData = computed(() => deriveCcStatusPanel(messages.value));

  function syncModelStateFromProvider() {
    const provider = activeProvider.value;
    if (!provider) return;
    const options = modelOptions.value;
    const valid = options.some((o) => o.id === selectedModelId.value);
    if (!valid) {
      const saved = catalog.getProviderSelectedModelId(provider.id);
      if (saved && options.some((o) => o.id === saved)) {
        selectedModelId.value = saved;
      } else {
        selectedModelId.value = defaultCatalogModelId(provider, longContextEnabled.value);
      }
    }
    if (!savedPrefs.reasoningEffort && provider) {
      reasoningEffort.value = resolveEffortFromProvider(provider);
    }
  }

  function setSelectedModelId(rawId: string) {
    const baseId = strip1mSuffix(rawId.trim());
    if (!baseId) return;
    const id = apply1mSuffix(baseId, longContextEnabled.value);
    selectedModelId.value = id;
    const provider = activeProvider.value;
    if (provider) {
      catalog.pushRecentModel(provider.id, id);
      catalog.setProviderSelectedModelId(provider.id, id);
    }
  }

  function setLongContextEnabled(enabled: boolean) {
    longContextEnabled.value = enabled;
    catalog.updateSessionPrefs({ ...catalog.prefs.value, longContextEnabled: enabled });
    const baseId = strip1mSuffix(selectedModelId.value);
    if (baseId) {
      selectedModelId.value = apply1mSuffix(baseId, enabled);
      const provider = activeProvider.value;
      if (provider) {
        catalog.setProviderSelectedModelId(provider.id, selectedModelId.value);
      }
    }
  }

  function addCustomModel(baseId: string, label?: string): boolean {
    const provider = activeProvider.value;
    if (!provider) return false;
    const ok = catalog.addCustomModel(provider.id, baseId, label);
    if (ok) {
      catalogVersion.value += 1;
      setSelectedModelId(baseId);
    }
    return ok;
  }

  function removeCustomModel(baseId: string) {
    const provider = activeProvider.value;
    if (!provider) return;
    catalog.removeCustomModel(provider.id, baseId);
    catalogVersion.value += 1;
    if (strip1mSuffix(selectedModelId.value) === strip1mSuffix(baseId)) {
      selectedModelId.value = defaultCatalogModelId(provider, longContextEnabled.value);
      catalog.setProviderSelectedModelId(provider.id, selectedModelId.value);
    }
  }

  async function switchProvider(providerId: string) {
    if (switchingProvider.value || providerId === activeProvider.value?.id) return;
    const ui = useUiStore();
    const current = activeProvider.value;
    if (current) {
      catalog.saveProviderModelBeforeSwitch(current.id, selectedModelId.value);
    }

    switchingProvider.value = true;
    try {
      const nextConfig = await activateCcProvider(providerId);
      if (!nextConfig) return;
      config.value = nextConfig;
      status.value = await getCcWorkbenchStatus();

      const nextProvider = nextConfig.providers.find((p: CcProviderPublic) => p.id === providerId) ?? null;
      if (nextProvider) {
        const saved = catalog.getProviderSelectedModelId(providerId);
        const options = buildCcModelCatalog(
          nextProvider,
          catalog.getCustomModels(providerId),
          catalog.getRecentModelIds(providerId),
          longContextEnabled.value,
        );
        if (saved && options.some((o) => o.id === saved)) {
          selectedModelId.value = saved;
        } else {
          selectedModelId.value = defaultCatalogModelId(nextProvider, longContextEnabled.value);
        }
        catalog.setProviderSelectedModelId(providerId, selectedModelId.value);
      }
      ui.showToast("success", "已切换供应商，下一条消息使用新配置");
    } finally {
      switchingProvider.value = false;
    }
  }

  watch(
    [selectedModelId, permissionMode, reasoningEffort, disableThinking, longContextEnabled],
    () => {
      saveChatPrefs({
        selectedModelId: selectedModelId.value,
        permissionMode: permissionMode.value,
        reasoningEffort: reasoningEffort.value,
        disableThinking: disableThinking.value,
        longContextEnabled: longContextEnabled.value,
        perProvider: catalog.prefs.value.perProvider,
        customModels: catalog.prefs.value.customModels,
      });
    },
    { deep: true },
  );

  function setSelectedAgent(agent: CcAgentEntry | null) {
    selectedAgent.value = agent ? { ...agent } : null;
    if (agent) pushRecentAgentId(agent.id);
  }

  async function refreshAgentsCache() {
    try {
      agentsCache.value = await listCcAgents();
    } catch {
      agentsCache.value = [];
    }
    return agentsCache.value;
  }

  async function applyDefaultAgentForNewSession() {
    const defaultId = loadDefaultAgentId();
    if (!defaultId) {
      selectedAgent.value = null;
      return;
    }
    const agents = agentsCache.value.length ? agentsCache.value : await refreshAgentsCache();
    const agent = findAgentById(agents, defaultId);
    selectedAgent.value = agent ? { ...agent } : null;
  }

  async function refresh() {
    loadError.value = null;
    try {
      [config.value, status.value] = await Promise.all([
        getCcWorkbenchConfig(),
        getCcWorkbenchStatus(),
      ]);
      syncModelStateFromProvider();
      void refreshAgentsCache();
      if (!messages.value.length && !activeHistoryId.value && !selectedAgent.value) {
        void applyDefaultAgentForNewSession();
      }
      if (
        config.value?.cwdMode === "project" &&
        !config.value.projectPath?.trim()
      ) {
        const ui = useUiStore();
        ui.showToast("error", "项目路径无效或已清除，请重新选择项目文件夹");
      }
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : String(error);
    }
  }

  function persistCurrentSession() {
    if (!messages.value.length) return;
    const id = activeHistoryId.value ?? `cc-hist-${Date.now()}`;
    activeHistoryId.value = id;
    const entry: CcSessionHistoryEntry = {
      id,
      title: customSessionTitle.value?.trim() || sessionTitle(messages.value),
      updatedAt: Date.now(),
      messages: JSON.parse(JSON.stringify(messages.value)) as CcMessage[],
      sessionId: sessionId.value,
      openedFiles: [...openedFiles.value],
      selectedAgent: selectedAgent.value
        ? { ...selectedAgent.value }
        : null,
    };
    const rest = history.value.filter((h) => h.id !== id);
    history.value = [entry, ...rest].slice(0, MAX_HISTORY);
    saveHistory(history.value);
  }

  function loadHistorySession(id: string) {
    const entry = history.value.find((h) => h.id === id);
    if (!entry) return;
    messages.value = JSON.parse(JSON.stringify(entry.messages)) as CcMessage[];
    sessionId.value = entry.sessionId;
    activeHistoryId.value = entry.id;
    openedFiles.value = [...(entry.openedFiles ?? [])];
    selectedAgent.value = entry.selectedAgent ? { ...entry.selectedAgent } : null;
    customSessionTitle.value = entry.title;
    inputTokens.value = 0;
    outputTokens.value = 0;
    contextTotalFromStream.value = 0;
    contextMaxFromStream.value = 0;
    contextPercentFromStream.value = null;
  }

  function deleteHistorySession(id: string) {
    history.value = history.value.filter((h) => h.id !== id);
    saveHistory(history.value);
    if (activeHistoryId.value === id) {
      activeHistoryId.value = null;
    }
  }

  function renameHistorySession(id: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const idx = history.value.findIndex((h) => h.id === id);
    if (idx === -1) return;
    history.value[idx] = { ...history.value[idx], title: trimmed, updatedAt: Date.now() };
    saveHistory(history.value);
  }

  function clearAllHistory() {
    history.value = [];
    saveHistory([]);
    activeHistoryId.value = null;
  }

  function currentSessionExportEntry(): CcSessionHistoryEntry | null {
    if (!messages.value.length) return null;
    return {
      id: activeHistoryId.value ?? `cc-export-${Date.now()}`,
      title: sessionTitle(messages.value),
      updatedAt: Date.now(),
      messages: JSON.parse(JSON.stringify(messages.value)) as CcMessage[],
      sessionId: sessionId.value,
      openedFiles: [...openedFiles.value],
      selectedAgent: selectedAgent.value ? { ...selectedAgent.value } : null,
    };
  }

  async function exportHistory(format: "md" | "json") {
    const { exportCcSessions } = await import("../utils/exportCcSessions");
    return exportCcSessions(history.value, format);
  }

  async function exportCurrentSession(format: "md" | "json") {
    const entry = currentSessionExportEntry();
    if (!entry) return false;
    const { exportCcSession } = await import("../utils/exportCcSessions");
    return exportCcSession(entry, format);
  }

  function removeOpenedFile(path: string) {
    openedFiles.value = openedFiles.value.filter((p) => p !== path);
  }

  async function pickAttachments() {
    if (streaming.value) return;
    const paths = await pickCcChatAttachments();
    if (!paths.length) return;
    attachments.value = mergeAttachments(attachments.value, paths);
  }

  function removeAttachment(path: string) {
    attachments.value = attachments.value.filter((item) => item.path !== path);
  }

  function clearAttachments() {
    attachments.value = [];
  }

  function attachFilesFromBrowser(paths: string[]) {
    if (!paths.length) return;
    attachments.value = mergeAttachments(attachments.value, paths);
  }

  function attachContextPaths(paths: string[]) {
    openedFiles.value = mergeContextPaths(openedFiles.value, paths);
  }

  function clearContext() {
    openedFiles.value = [];
  }

  function patchMessage(id: string, patch: Partial<CcMessage>) {
    const idx = messages.value.findIndex((m) => m.id === id);
    if (idx === -1) return;
    messages.value[idx] = { ...messages.value[idx], ...patch };
  }

  function patchBlocks(
    messageId: string,
    updater: (blocks: CcMessageBlock[]) => CcMessageBlock[],
  ) {
    const current = messages.value.find((m) => m.id === messageId);
    if (!current) return;
    const blocks = updater(resolveMessageBlocks(current));
    patchMessage(messageId, { blocks, ...syncLegacyFromBlocks(blocks) });
  }

  function finalizeAssistantMeta(messageId: string, startedAt: number) {
    const current = messages.value.find((m) => m.id === messageId);
    if (!current) return;
    const contextMax =
      finiteTokenCount(contextMaxFromStream.value) > 0
        ? finiteTokenCount(contextMaxFromStream.value)
        : current.contextMaxTokens ?? contextWindow.value;
    patchMessage(messageId, {
      streaming: false,
      durationMs: current.durationMs ?? Date.now() - startedAt,
      inputTokens: Math.max(finiteTokenCount(current.inputTokens), finiteTokenCount(inputTokens.value)),
      outputTokens: Math.max(finiteTokenCount(current.outputTokens), finiteTokenCount(outputTokens.value)),
      contextMaxTokens: contextMax,
    });
  }

  function handleStreamEvent(messageId: string, event: StreamEvent, startedAt: number) {
    const current = messages.value.find((m) => m.id === messageId);
    if (!current) return;

    switch (event.type) {
      case "token":
        patchBlocks(messageId, (blocks) => applyTokenToBlocks(blocks, event.content));
        break;
      case "thinking":
        patchBlocks(messageId, (blocks) => applyThinkingToBlocks(blocks, event.content));
        break;
      case "toolCall":
        patchBlocks(messageId, (blocks) =>
          applyToolCallToBlocks(blocks, {
            id: event.toolUseId,
            name: event.name,
            input: event.input,
          }),
        );
        break;
      case "toolResult":
        patchBlocks(messageId, (blocks) =>
          applyToolResultToBlocks(blocks, {
            toolUseId: event.toolUseId,
            name: event.name,
            output: event.output,
          }),
        );
        break;
      case "error":
        patchMessage(messageId, { error: event.message, streaming: false });
        break;
      case "session":
        if (event.sessionId) sessionId.value = event.sessionId;
        break;
      case "usage": {
        const nextInput = usageEventNumber(event, "inputTokens", "input_tokens");
        const nextOutput = usageEventNumber(event, "outputTokens", "output_tokens");
        const nextContextTotal = usageEventNumber(event, "contextTotalTokens", "context_total_tokens");
        const nextContextMax = usageEventNumber(event, "contextMaxTokens", "context_max_tokens");
        const nextContextPct = usageEventPercent(event);
        if (nextInput > 0) {
          inputTokens.value = Math.max(finiteTokenCount(inputTokens.value), nextInput);
        }
        if (nextOutput > 0) {
          outputTokens.value = Math.max(finiteTokenCount(outputTokens.value), nextOutput);
        }
        if (nextContextTotal > 0) {
          contextTotalFromStream.value = Math.max(
            finiteTokenCount(contextTotalFromStream.value),
            nextContextTotal,
          );
        }
        if (nextContextMax > 0) {
          contextMaxFromStream.value = Math.max(
            finiteTokenCount(contextMaxFromStream.value),
            nextContextMax,
          );
        }
        if (nextContextPct !== null) {
          contextPercentFromStream.value = nextContextPct;
        }
        patchMessage(messageId, {
          inputTokens: Math.max(finiteTokenCount(current.inputTokens), nextInput),
          outputTokens: Math.max(finiteTokenCount(current.outputTokens), nextOutput),
          ...(nextContextMax > 0 ? { contextMaxTokens: nextContextMax } : {}),
        });
        break;
      }
      case "toolPermission": {
        const requestId =
          event.requestId ??
          ("request_id" in event ? String((event as { request_id?: string }).request_id ?? "") : "");
        if (!requestId.trim()) {
          const ui = useUiStore();
          ui.showToast("error", "工具权限请求缺少 requestId，请重试");
          break;
        }
        pendingToolPermission.value = {
          requestId: requestId.trim(),
          toolName: event.toolName ?? ("tool_name" in event ? String((event as { tool_name?: string }).tool_name ?? "tool") : "tool"),
          input: event.input,
        };
        {
          const ui = useUiStore();
          ui.showToast(
            "success",
            `Agent 请求使用「${pendingToolPermission.value.toolName}」，请在弹窗中确认权限`,
          );
        }
        break;
      }
      case "done":
        resetStreamingBlockSyncState();
        finalizeAssistantMeta(messageId, startedAt);
        break;
      default:
        break;
    }
  }

  async function send() {
    const rawText = input.value.trim();
    if (!rawText || streaming.value) return;

    const firstToken = rawText.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (firstToken === "/clear" || firstToken === "/new" || firstToken === "/reset") {
      input.value = "";
      clearMessages();
      return;
    }

    const c = config.value;
    if (c?.cwdMode === "project") {
      const path = c.projectPath?.trim() ?? "";
      if (!path) {
        const ui = useUiStore();
        ui.showToast("error", "请先在设置中选择项目目录");
        return;
      }
      if (/^[A-Za-z]:[\\/]?$/.test(path)) {
        const ui = useUiStore();
        ui.showToast("error", "项目路径无效，请重新选择完整项目文件夹");
        return;
      }
    }

    const agents = agentsCache.value.length ? agentsCache.value : await refreshAgentsCache();
    const { agent, cleanedText } = resolveAgentForSend(rawText, selectedAgent.value, agents);
    const text = cleanedText.trim();
    if (!text) {
      const ui = useUiStore();
      ui.showToast("error", "请输入消息内容");
      return;
    }
    if (agent) {
      setSelectedAgent(agent);
    }

    const mentionPaths = parseAtMentions(text);
    const contextPaths = mergeContextPaths(openedFiles.value, mentionPaths);
    const attachmentPaths = attachments.value.map((item) => item.path);
    const agentName = agent?.name ?? selectedAgent.value?.name ?? null;

    messages.value.push({
      id: nextMsgId(),
      role: "user",
      content: text,
      contextFiles: contextPaths.length ? contextPaths : undefined,
      attachments: attachments.value.length ? [...attachments.value] : undefined,
      agentName: agentName ?? undefined,
    });
    input.value = "";
    attachments.value = [];

    if (contextPaths.length) {
      pushRecentContextPaths(contextPaths);
    }

    const assistantId = nextMsgId();
    const modelOpt = modelOptions.value.find((o) => o.id === selectedModelId.value);
    const modelLabel = modelOpt
      ? formatModelLabel(modelOpt.label, modelOpt.supports1m)
      : selectedModelId.value.trim()
        ? formatModelLabel(selectedModelId.value.trim(), modelSupports1m(selectedModelId.value))
        : undefined;
    messages.value.push({
      id: assistantId,
      role: "assistant",
      content: "",
      blocks: [],
      toolCalls: [],
      streaming: true,
      modelLabel,
      contextMaxTokens: contextWindow.value,
    });

    streaming.value = true;
    resetStreamingBlockSyncState();
    const startedAt = Date.now();
    const priorForHistory = messages.value.filter((m) => m.id !== assistantId);
    const promptText = buildCcPromptWithHistory(text, priorForHistory, {
      hasSessionId: Boolean(sessionId.value?.trim()),
    });
    try {
      await streamCcWorkbench(
        promptText,
        (event) => handleStreamEvent(assistantId, event, startedAt),
        sessionId.value,
        {
          selectedModel: selectedModelId.value || null,
          selectedModelSlot: selectedModelSlot.value,
          reasoningEffort: reasoningEffort.value,
          permissionMode: permissionMode.value,
          openedFiles: contextPaths,
          attachments: attachmentPaths,
          agentPrompt: (agent ?? selectedAgent.value)?.prompt ?? null,
          disableThinking: disableThinking.value,
        },
      );
    } catch (error) {
      patchMessage(assistantId, {
        error: error instanceof Error ? error.message : String(error),
        streaming: false,
      });
    } finally {
      resetStreamingBlockSyncState();
      streaming.value = false;
      const assistant = messages.value.find((m) => m.id === assistantId);
      if (assistant?.streaming) {
        finalizeAssistantMeta(assistantId, startedAt);
      }
      const latest = messages.value.find((m) => m.id === assistantId);
      if (
        latest &&
        !latest.error &&
        !latest.content.trim() &&
        !(latest.toolCalls?.length) &&
        !(latest.blocks?.length)
      ) {
        patchMessage(assistantId, {
          error: "模型未返回内容，请检查供应商配置、API Key 与网络连接",
        });
      }
      persistCurrentSession();
    }
  }

  function markIncompleteToolsCancelled(messageId: string) {
    const msg = messages.value.find((m) => m.id === messageId);
    if (!msg) return;

    const cancelledOutput = "（已取消）";
    const toolCalls = msg.toolCalls?.map((tool) =>
      tool.output === undefined ? { ...tool, output: cancelledOutput } : tool,
    );
    const blocks = msg.blocks?.map((block) => {
      if (block.type === "tool" && block.output === undefined) {
        return { ...block, output: cancelledOutput };
      }
      return block;
    });

    const patch: Partial<CcMessage> = {};
    if (toolCalls) patch.toolCalls = toolCalls;
    if (blocks) patch.blocks = blocks;
    if (Object.keys(patch).length) patchMessage(messageId, patch);
  }

  function messageHasPartialReply(msg: CcMessage): boolean {
    return Boolean(
      msg.content.trim() ||
        msg.toolCalls?.length ||
        msg.blocks?.length ||
        msg.thinking?.trim(),
    );
  }

  async function stop() {
    if (!streaming.value) return;
    const pending = pendingToolPermission.value;
    if (pending) {
      pendingToolPermission.value = null;
      try {
        await respondCcToolPermission(pending.requestId, "deny", "用户已停止生成");
      } catch {
        /* abort will follow */
      }
    }
    try {
      await abortCcWorkbenchStream();
    } catch (error) {
      const ui = useUiStore();
      ui.showToast("error", error instanceof Error ? error.message : "停止失败");
    } finally {
      streaming.value = false;
      const lastAssistant = [...messages.value].reverse().find((m) => m.role === "assistant");
      if (lastAssistant?.streaming) {
        markIncompleteToolsCancelled(lastAssistant.id);
        const hasPartial = messageHasPartialReply(lastAssistant);
        patchMessage(lastAssistant.id, {
          streaming: false,
          error: hasPartial ? lastAssistant.error : (lastAssistant.error ?? "已停止生成"),
        });
      }
      persistCurrentSession();
    }
  }

  async function respondToolPermission(behavior: "allow" | "deny", message?: string) {
    const pending = pendingToolPermission.value;
    if (!pending) return;
    pendingToolPermission.value = null;
    try {
      await respondCcToolPermission(pending.requestId, behavior, message ?? null);
    } catch (error) {
      const ui = useUiStore();
      ui.showToast("error", error instanceof Error ? error.message : "权限响应失败");
    }
  }

  function renameCurrentSessionTitle(title: string) {
    const trimmed = title.trim().slice(0, 50);
    if (!trimmed) return;
    customSessionTitle.value = trimmed;
    if (activeHistoryId.value) {
      renameHistorySession(activeHistoryId.value, trimmed);
      return;
    }
    if (messages.value.length) {
      persistCurrentSession();
    }
  }

  function clearMessages() {
    persistCurrentSession();
    messages.value = [];
    sessionId.value = null;
    activeHistoryId.value = null;
    customSessionTitle.value = null;
    inputTokens.value = 0;
    outputTokens.value = 0;
    contextTotalFromStream.value = 0;
    contextMaxFromStream.value = 0;
    contextPercentFromStream.value = null;
    statusPanelTab.value = null;
    openedFiles.value = [];
    attachments.value = [];
    pendingToolPermission.value = null;
    void applyDefaultAgentForNewSession();
    const ui = useUiStore();
    ui.showToast("success", "新会话已创建，可以开始提问");
  }

  function toggleStatusPanelTab(tab: CcStatusTab) {
    if (statusPanelTab.value === tab && statusPanelExpanded.value) {
      statusPanelExpanded.value = false;
      statusPanelTab.value = null;
      return;
    }
    statusPanelTab.value = tab;
    statusPanelExpanded.value = true;
  }

  async function setCwdMode(mode: CwdMode) {
    const ui = useUiStore();
    try {
      config.value = await setCcWorkbenchConfig({ cwdMode: mode });
      if (mode === "project" && openedFiles.value.length) {
        openedFiles.value = [];
        ui.showToast("success", "已清除文件上下文，请在项目目录中重新选择");
      }
      if (mode === "project" && !config.value.projectPath) {
        const path = await pickProjectDirectory();
        if (path) {
          config.value = await setCcWorkbenchConfig({ cwdMode: "project", projectPath: path });
        } else {
          ui.showToast("success", "已切换为本地项目，请点击目录按钮选择项目路径");
        }
      }
      status.value = await getCcWorkbenchStatus();
      return true;
    } catch (error) {
      ui.showToast("error", error instanceof Error ? error.message : "切换工作目录失败");
      await refresh();
      return false;
    }
  }

  async function pickProject() {
    const ui = useUiStore();
    try {
      const path = await pickProjectDirectory();
      if (!path) return false;
      config.value = await setCcWorkbenchConfig({ cwdMode: "project", projectPath: path });
      status.value = await getCcWorkbenchStatus();
      return true;
    } catch (error) {
      ui.showToast("error", error instanceof Error ? error.message : "选择项目目录失败");
      return false;
    }
  }

  return {
    config,
    status,
    messages,
    input,
    streaming,
    sessionId,
    loadError,
    statusPanelExpanded,
    statusPanelTab,
    openedFiles,
    attachments,
    selectedAgent,
    agentsCache,
    setSelectedAgent,
    refreshAgentsCache,
    disableThinking,
    pendingToolPermission,
    statusPanelData,
    selectedModelId,
    permissionMode,
    reasoningEffort,
    longContextEnabled,
    providers,
    switchingProvider,
    activeProvider,
    modelOptions,
    ready,
    statusHint,
    cwdModeLabelText,
    contextLabel,
    contextPercentage,
    contextUsedTokens,
    contextWindow,
    effectiveContextMax,
    sessionTitleText,
    inputTokens,
    outputTokens,
    history,
    activeHistoryId,
    refresh,
    send,
    stop,
    respondToolPermission,
    clearMessages,
    loadHistorySession,
    deleteHistorySession,
    renameHistorySession,
    renameCurrentSessionTitle,
    clearAllHistory,
    exportHistory,
    exportCurrentSession,
    attachContextPaths,
    removeOpenedFile,
    clearContext,
    pickAttachments,
    removeAttachment,
    clearAttachments,
    attachFilesFromBrowser,
    toggleStatusPanelTab,
    setCwdMode,
    pickProject,
    switchProvider,
    setSelectedModelId,
    setLongContextEnabled,
    addCustomModel,
    removeCustomModel,
  };
});
