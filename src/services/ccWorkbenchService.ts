import { Channel, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import { tauriInvoke } from "../composables/useTauriCommand";
import type { StreamEvent } from "./aiService";
import { isTauriRuntime } from "./vaultService";

export type CwdMode = "vault" | "project";
export type CcProviderMode = "official" | "custom";

export const LOCAL_SETTINGS_PROVIDER_ID = "__local_settings_json__";
export const OFFICIAL_PROVIDER_ID = "__official__";

export interface CcWorkbenchStatus {
  nodeAvailable: boolean;
  nodeVersion: string | null;
  bridgeAvailable: boolean;
  bridgePath: string | null;
  sdkInstalled: boolean;
  sdkPath: string;
  /** App-locked target SDK version */
  sdkVersion: string;
  /** Actually installed package version, if any */
  installedSdkVersion: string | null;
  mcpEnabled: boolean;
  mcpAdapterPath: string | null;
}

export interface CcBridgeProcessEntry {
  pid: number;
  kind: "session" | "enhance" | "modelTest" | string;
  role: "tracked" | "orphan" | string;
  startedAtMs: number | null;
  commandHint?: string | null;
}

export interface CcBridgeProcessList {
  processes: CcBridgeProcessEntry[];
  trackedCount: number;
  orphanCount: number;
}

export interface CcProviderPublic {
  id: string;
  name: string;
  remark: string;
  presetId: string | null;
  providerMode: CcProviderMode;
  baseUrl: string;
  model: string;
  fastModel: string;
  sonnetModel: string;
  opusModel: string;
  apiKeyMasked: string;
  apiKey?: string | null;
  isActive: boolean;
  isBuiltin: boolean;
  source?: string | null;
  envExtras?: Record<string, string>;
  settingsConfig?: string | null;
}

export interface CcSkillEntry {
  id: string;
  name: string;
  scope: string;
  path: string;
  enabled: boolean;
  description?: string | null;
}

export interface CcWorkbenchConfigPublic {
  enabled: boolean;
  cwdMode: CwdMode;
  projectPath: string | null;
  providerMode: CcProviderMode;
  baseUrl: string;
  model: string;
  fastModel: string;
  activeProviderId: string | null;
  providers: CcProviderPublic[];
  apiKeyMasked: string;
  apiKey?: string | null;
  promptEnhancer?: CcPromptEnhancerConfig;
  agentMarketUrl?: string | null;
  skillMarketUrl?: string | null;
}

export interface CcPromptEnhancerConfig {
  enabled: boolean;
  autoTrigger: boolean;
  systemPrompt?: string;
}

export interface CcWorkbenchConfigUpdate {
  enabled?: boolean;
  cwdMode?: CwdMode;
  projectPath?: string | null;
  providerMode?: CcProviderMode;
  baseUrl?: string;
  model?: string;
  fastModel?: string;
  anthropicApiKey?: string;
  promptEnhancer?: CcPromptEnhancerConfig;
  agentMarketUrl?: string | null;
  skillMarketUrl?: string | null;
}

export interface CcProviderInput {
  id?: string;
  name: string;
  remark?: string;
  presetId?: string | null;
  providerMode: CcProviderMode;
  baseUrl?: string;
  model?: string;
  fastModel?: string;
  sonnetModel?: string;
  opusModel?: string;
  apiKey?: string;
  source?: string;
  envExtras?: Record<string, string>;
  settingsConfig?: string | null;
}

export interface CcSwitchImportItem {
  id: string;
  name: string;
  remark: string;
  baseUrl: string;
  model: string;
  fastModel: string;
  sonnetModel: string;
  opusModel: string;
  apiKeyMasked: string;
  status: "new" | "update" | string;
  source: string;
}

export interface CcSwitchImportPreview {
  dbPath: string;
  providers: CcSwitchImportItem[];
}

export interface CcSwitchSaveRequest {
  providerIds: string[];
  dbPath?: string | null;
}

export interface ClaudeLocalSettingsPreview {
  path: string;
  exists: boolean;
  apiKeyMasked: string;
  env: {
    anthropicBaseUrl?: string | null;
    anthropicAuthToken?: string | null;
    anthropicApiKey?: string | null;
    anthropicModel?: string | null;
    anthropicDefaultSonnetModel?: string | null;
    anthropicDefaultOpusModel?: string | null;
    anthropicDefaultHaikuModel?: string | null;
  };
}

export interface CcSkillToggleRequest {
  name: string;
  scope: string;
  enabled: boolean;
}

export interface CcSkillImportRequest {
  scope: string;
  sourcePaths: string[];
}

export interface CcSkillImportResult {
  imported: string[];
  errors: string[];
}

export interface CcSkillDeleteRequest {
  name: string;
  scope: string;
  enabled: boolean;
}

export interface CcSkillMarketEntry {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  installHint: string;
}

function createStreamChannel(onEvent: (event: StreamEvent) => void): Channel<StreamEvent> {
  return new Channel<StreamEvent>((event) => {
    onEvent(event);
  });
}

export async function getCcWorkbenchStatus(): Promise<CcWorkbenchStatus> {
  if (!isTauriRuntime()) {
    return {
      nodeAvailable: false,
      nodeVersion: null,
      bridgeAvailable: false,
      bridgePath: null,
      sdkInstalled: false,
      sdkPath: "",
      sdkVersion: "",
      installedSdkVersion: null,
      mcpEnabled: false,
      mcpAdapterPath: null,
    };
  }
  return tauriInvoke<CcWorkbenchStatus>("get_cc_workbench_status");
}

export async function getCcWorkbenchConfig(
  revealKey = false,
  revealProviderId?: string | null,
): Promise<CcWorkbenchConfigPublic> {
  if (!isTauriRuntime()) {
    return {
      enabled: false,
      cwdMode: "vault",
      projectPath: null,
      providerMode: "official",
      baseUrl: "",
      model: "",
      fastModel: "",
      activeProviderId: OFFICIAL_PROVIDER_ID,
      providers: [],
      apiKeyMasked: "",
    };
  }
  return tauriInvoke<CcWorkbenchConfigPublic>("get_cc_workbench_config", {
    revealKey,
    revealProviderId: revealProviderId ?? null,
  });
}

export async function setCcWorkbenchConfig(
  update: CcWorkbenchConfigUpdate,
): Promise<CcWorkbenchConfigPublic> {
  return tauriInvoke<CcWorkbenchConfigPublic>("set_cc_workbench_config", { update });
}

export async function upsertCcProvider(input: CcProviderInput): Promise<CcWorkbenchConfigPublic> {
  return tauriInvoke<CcWorkbenchConfigPublic>("upsert_cc_provider", { input });
}

export async function deleteCcProvider(id: string): Promise<CcWorkbenchConfigPublic> {
  return tauriInvoke<CcWorkbenchConfigPublic>("delete_cc_provider", { id });
}

export async function switchCcProvider(id: string): Promise<CcWorkbenchConfigPublic> {
  return tauriInvoke<CcWorkbenchConfigPublic>("switch_cc_provider", { id });
}

export async function listCcSkills(): Promise<CcSkillEntry[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<CcSkillEntry[]>("list_cc_skills");
}

export async function listCcSkillMarket(): Promise<CcSkillMarketEntry[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<CcSkillMarketEntry[]>("list_cc_skill_market");
}

export async function previewCcSwitchImport(
  dbPath?: string | null,
): Promise<CcSwitchImportPreview> {
  return tauriInvoke<CcSwitchImportPreview>("preview_cc_switch_import", {
    dbPath: dbPath ?? null,
  });
}

export async function saveCcSwitchImport(
  request: CcSwitchSaveRequest,
): Promise<CcWorkbenchConfigPublic> {
  return tauriInvoke<CcWorkbenchConfigPublic>("save_cc_switch_import", { request });
}

export async function sortCcProviders(
  orderedIds: string[],
): Promise<CcWorkbenchConfigPublic> {
  return tauriInvoke<CcWorkbenchConfigPublic>("sort_cc_providers", { orderedIds });
}

export async function previewClaudeLocalSettings(): Promise<ClaudeLocalSettingsPreview> {
  if (!isTauriRuntime()) {
    return {
      path: "~/.claude/settings.json",
      exists: false,
      apiKeyMasked: "",
      env: {},
    };
  }
  return tauriInvoke<ClaudeLocalSettingsPreview>("preview_claude_local_settings");
}

export async function toggleCcSkill(request: CcSkillToggleRequest): Promise<void> {
  return tauriInvoke<void>("toggle_cc_skill", { request });
}

export async function importCcSkills(
  request: CcSkillImportRequest,
): Promise<CcSkillImportResult> {
  return tauriInvoke<CcSkillImportResult>("import_cc_skills", { request });
}

export async function deleteCcSkill(request: CcSkillDeleteRequest): Promise<void> {
  return tauriInvoke<void>("delete_cc_skill", { request });
}

export async function openCcSkill(path: string): Promise<void> {
  return tauriInvoke<void>("open_cc_skill", { path });
}

export async function pickCcSwitchDbFile(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    title: "选择 cc-switch.db 文件",
    filters: [{ name: "SQLite 数据库", extensions: ["db"] }],
  });
  if (selected === null) return null;
  return typeof selected === "string" ? selected : selected[0] ?? null;
}

export async function pickSkillDirectories(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  const selected = await open({
    directory: true,
    multiple: true,
    title: "选择要导入的 Skill 目录",
  });
  if (selected === null) return [];
  return typeof selected === "string" ? [selected] : selected;
}

export interface CcMcpServerSpec {
  type?: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  cwd?: string;
}

export interface CcMcpServer {
  id: string;
  name?: string | null;
  server: CcMcpServerSpec;
  enabled: boolean;
  description?: string | null;
  tags?: string[];
  homepage?: string | null;
  docs?: string | null;
}

export interface CcMcpServerInput {
  id: string;
  name?: string | null;
  server: CcMcpServerSpec;
  enabled?: boolean;
  description?: string | null;
  tags?: string[];
  homepage?: string | null;
  docs?: string | null;
}

export interface CcMcpServerStatusInfo {
  name: string;
  status: "connected" | "failed" | "needs-auth" | "pending";
  error?: string | null;
  serverInfo?: { name: string; version: string } | null;
}

export async function listCcMcpServers(): Promise<CcMcpServer[]> {
  return tauriInvoke<CcMcpServer[]>("list_cc_mcp_servers");
}

export async function upsertCcMcpServer(input: CcMcpServerInput): Promise<CcMcpServer> {
  return tauriInvoke<CcMcpServer>("upsert_cc_mcp_server", { input });
}

export async function deleteCcMcpServer(id: string): Promise<void> {
  return tauriInvoke<void>("delete_cc_mcp_server", { id });
}

export async function toggleCcMcpServer(id: string, enabled: boolean): Promise<void> {
  return tauriInvoke<void>("toggle_cc_mcp_server", { request: { id, enabled } });
}

export async function getCcMcpServerStatus(): Promise<CcMcpServerStatusInfo[]> {
  return tauriInvoke<CcMcpServerStatusInfo[]>("get_cc_mcp_server_status");
}

export async function copyCcMcpServerConfig(id: string): Promise<string> {
  return tauriInvoke<string>("copy_cc_mcp_server_config", { id });
}

export async function installCcSdk(): Promise<string> {
  return tauriInvoke<string>("install_cc_sdk");
}

export interface CcWorkbenchSendOptions {
  selectedModel?: string | null;
  selectedModelSlot?: string | null;
  reasoningEffort?: string | null;
  permissionMode?: string | null;
  openedFiles?: string[];
  attachments?: string[];
  agentPrompt?: string | null;
  disableThinking?: boolean;
}

export interface CcAgentEntry {
  id: string;
  name: string;
  description: string;
  prompt: string;
  scope: string;
}

export interface CcAgentInput {
  id?: string | null;
  name: string;
  description: string;
  prompt: string;
  scope: string;
}

export interface CcAgentDeleteRequest {
  id: string;
  scope: string;
}

export type CcAgentConflictMode = "skip" | "overwrite" | "rename";

export interface CcAgentImportRequest {
  scope: string;
  sourcePaths: string[];
  conflictMode?: CcAgentConflictMode;
}

export interface CcAgentImportResult {
  imported: string[];
  skipped: string[];
  errors: string[];
}

export interface CcAgentExportRequest {
  agents: CcAgentDeleteRequest[];
  destDir: string;
  format: "md" | "json" | "zip";
}

export interface CcAgentExportResult {
  exported: string[];
  errors: string[];
}

export interface CcAgentMarketEntry {
  id: string;
  name: string;
  description: string;
  prompt: string;
  installHint: string;
}

export interface CcPromptEntry {
  id: string;
  name: string;
  description: string;
  content: string;
  scope: string;
}

export interface CcPromptInput {
  id?: string | null;
  name: string;
  description: string;
  content: string;
  scope: "global" | "project";
}

export interface CcPromptDeleteRequest {
  id: string;
  scope: string;
}

export type CcPromptConflictMode = "skip" | "overwrite" | "rename";

export interface CcPromptImportRequest {
  scope: "global" | "project";
  sourcePaths: string[];
  conflictMode?: CcPromptConflictMode;
}

export interface CcPromptImportResult {
  imported: string[];
  skipped: string[];
  errors: string[];
}

export interface CcPromptExportRequest {
  prompts: CcPromptDeleteRequest[];
  destDir: string;
  format: "md" | "json";
}

export interface CcPromptExportResult {
  exported: string[];
  errors: string[];
}

export interface CcSlashCommandEntry {
  id: string;
  name: string;
  description: string;
  source: string;
}

export interface CcContextFileEntry {
  path: string;
  name: string;
  kind: string;
}

export interface CcListContextFilesRequest {
  cwdMode: CwdMode;
  projectPath?: string | null;
  query?: string;
}

export interface CcEnhancePromptResult {
  success: boolean;
  enhancedPrompt: string;
  error?: string | null;
}

export async function listCcAgents(): Promise<CcAgentEntry[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<CcAgentEntry[]>("list_cc_agents");
}

export async function saveCcAgent(input: CcAgentInput): Promise<CcAgentEntry> {
  if (!isTauriRuntime()) throw new Error("请在 Tauri 应用中保存 Agent");
  return tauriInvoke<CcAgentEntry>("save_cc_agent", { input });
}

export async function deleteCcAgent(request: CcAgentDeleteRequest): Promise<void> {
  if (!isTauriRuntime()) throw new Error("请在 Tauri 应用中删除 Agent");
  return tauriInvoke<void>("delete_cc_agent", { request });
}

export async function importCcAgents(
  request: CcAgentImportRequest,
): Promise<CcAgentImportResult> {
  if (!isTauriRuntime()) {
    return { imported: [], skipped: [], errors: ["请在 Tauri 应用中导入 Agent"] };
  }
  return tauriInvoke<CcAgentImportResult>("import_cc_agents", { request });
}

export async function exportCcAgents(
  request: CcAgentExportRequest,
): Promise<CcAgentExportResult> {
  if (!isTauriRuntime()) {
    return { exported: [], errors: ["请在 Tauri 应用中导出 Agent"] };
  }
  return tauriInvoke<CcAgentExportResult>("export_cc_agents", { request });
}

export async function listCcAgentMarket(): Promise<CcAgentMarketEntry[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<CcAgentMarketEntry[]>("list_cc_agent_market");
}

export async function pickAgentImportFiles(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  const selected = await open({
    multiple: true,
    title: "选择 Agent 文件（.md / .json）",
    filters: [{ name: "Agent", extensions: ["md", "json"] }],
  });
  if (selected === null) return [];
  return typeof selected === "string" ? [selected] : selected;
}

export async function pickAgentImportDirectories(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  const selected = await open({
    directory: true,
    multiple: true,
    title: "选择包含 Agent 的目录",
  });
  if (selected === null) return [];
  return typeof selected === "string" ? [selected] : selected;
}

export async function pickAgentExportDirectory(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    directory: true,
    multiple: false,
    title: "选择 Agent 导出目录",
  });
  if (selected === null) return null;
  return typeof selected === "string" ? selected : selected[0] ?? null;
}

export async function listCcPrompts(): Promise<CcPromptEntry[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<CcPromptEntry[]>("list_cc_prompts");
}

export async function saveCcPrompt(input: CcPromptInput): Promise<CcPromptEntry> {
  if (!isTauriRuntime()) throw new Error("请在 Tauri 应用中保存提示词");
  return tauriInvoke<CcPromptEntry>("save_cc_prompt", { input });
}

export async function deleteCcPrompt(request: CcPromptDeleteRequest): Promise<void> {
  if (!isTauriRuntime()) throw new Error("请在 Tauri 应用中删除提示词");
  return tauriInvoke<void>("delete_cc_prompt", { request });
}

export async function importCcPrompts(
  request: CcPromptImportRequest,
): Promise<CcPromptImportResult> {
  if (!isTauriRuntime()) {
    return { imported: [], skipped: [], errors: ["请在 Tauri 应用中导入提示词"] };
  }
  return tauriInvoke<CcPromptImportResult>("import_cc_prompts", { request });
}

export async function exportCcPrompts(
  request: CcPromptExportRequest,
): Promise<CcPromptExportResult> {
  if (!isTauriRuntime()) {
    return { exported: [], errors: ["请在 Tauri 应用中导出提示词"] };
  }
  return tauriInvoke<CcPromptExportResult>("export_cc_prompts", { request });
}

export async function pickPromptImportFiles(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  const selected = await open({
    multiple: true,
    title: "选择提示词文件（.md / .json）",
    filters: [{ name: "提示词", extensions: ["md", "json", "txt"] }],
  });
  if (selected === null) return [];
  return typeof selected === "string" ? [selected] : selected;
}

export async function pickPromptImportDirectories(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  const selected = await open({
    directory: true,
    multiple: true,
    title: "选择包含提示词的目录",
  });
  if (selected === null) return [];
  return typeof selected === "string" ? [selected] : selected;
}

export async function pickPromptExportDirectory(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    directory: true,
    multiple: false,
    title: "选择提示词导出目录",
  });
  if (selected === null) return null;
  return typeof selected === "string" ? selected : selected[0] ?? null;
}

export async function listCcSlashCommands(): Promise<CcSlashCommandEntry[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<CcSlashCommandEntry[]>("list_cc_slash_commands");
}

export async function listCcContextFiles(
  request: CcListContextFilesRequest,
): Promise<CcContextFileEntry[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<CcContextFileEntry[]>("list_cc_context_files", { request });
}

export interface CcModelTestResult {
  success: boolean;
  error?: string | null;
}

export async function enhanceCcPrompt(
  prompt: string,
  selectedModel?: string | null,
  selectedModelSlot?: string | null,
): Promise<CcEnhancePromptResult> {
  if (!isTauriRuntime()) {
    return {
      success: false,
      enhancedPrompt: "",
      error: "请在 Tauri 应用中使用提示词增强",
    };
  }
  return tauriInvoke<CcEnhancePromptResult>("cc_workbench_enhance_prompt", {
    request: {
      prompt,
      selectedModel: selectedModel ?? null,
      selectedModelSlot: selectedModelSlot ?? null,
    },
  });
}

export async function testCcModel(
  model: string,
  modelSlot?: string | null,
): Promise<CcModelTestResult> {
  if (!isTauriRuntime()) {
    return { success: false, error: "请在 Tauri 应用中测试模型" };
  }
  return tauriInvoke<CcModelTestResult>("cc_workbench_test_model", {
    request: { model, modelSlot: modelSlot ?? null },
  });
}

export async function streamCcWorkbench(
  prompt: string,
  onEvent: (event: StreamEvent) => void,
  sessionId?: string | null,
  options?: CcWorkbenchSendOptions,
): Promise<void> {
  if (!isTauriRuntime()) {
    onEvent({
      type: "token",
      content: "（浏览器预览模式：请在 Tauri 应用中测试 Claude Agent 工作台）",
    });
    onEvent({ type: "done" });
    return;
  }

  await invoke("cc_workbench_send", {
    request: {
      prompt,
      sessionId: sessionId ?? null,
      selectedModel: options?.selectedModel ?? null,
      selectedModelSlot: options?.selectedModelSlot ?? null,
      reasoningEffort: options?.reasoningEffort ?? null,
      permissionMode: options?.permissionMode ?? null,
      openedFiles: options?.openedFiles ?? [],
      attachments: options?.attachments ?? [],
      agentPrompt: options?.agentPrompt ?? null,
      disableThinking: options?.disableThinking ?? null,
    },
    onEvent: createStreamChannel(onEvent),
  });
}

export async function abortCcWorkbenchStream(): Promise<void> {
  if (!isTauriRuntime()) return;
  await tauriInvoke<void>("cc_workbench_abort");
}

export async function listCcBridgeProcesses(): Promise<CcBridgeProcessList> {
  if (!isTauriRuntime()) {
    return { processes: [], trackedCount: 0, orphanCount: 0 };
  }
  return tauriInvoke<CcBridgeProcessList>("list_cc_bridge_processes");
}

export async function killCcBridgeProcess(pid: number): Promise<void> {
  if (!isTauriRuntime()) return;
  await tauriInvoke<void>("kill_cc_bridge_process", { pid });
}

export async function respondCcToolPermission(
  requestId: string,
  behavior: "allow" | "deny",
  message?: string | null,
): Promise<void> {
  if (!isTauriRuntime()) return;
  const trimmedId = requestId.trim();
  if (!trimmedId) {
    throw new Error("缺少工具权限 requestId");
  }
  await tauriInvoke<void>("cc_workbench_tool_permission_response", {
    request: {
      requestId: trimmedId,
      behavior,
      message: message ?? null,
    },
  });
}

export async function pickProjectDirectory(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    directory: true,
    multiple: false,
    title: "选择 Claude Agent 项目目录",
  });
  if (selected === null) return null;
  return typeof selected === "string" ? selected : selected[0] ?? null;
}

export async function pickCcChatAttachments(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  const selected = await open({
    multiple: true,
    title: "添加附件",
    filters: [
      {
        name: "图片",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"],
      },
      {
        name: "文档",
        extensions: ["md", "txt", "json", "pdf", "csv", "ts", "js", "py", "rs", "vue", "html", "css", "xml", "yaml", "yml"],
      },
      { name: "所有文件", extensions: ["*"] },
    ],
  });
  if (selected === null) return [];
  return typeof selected === "string" ? [selected] : selected;
}

export function cwdModeLabel(mode: CwdMode): string {
  return mode === "vault" ? "知识库（MCP）" : "本地项目";
}

/** 输入框/页脚展示：项目模式下附带路径摘要 */
export function cwdModeDisplay(mode: CwdMode, projectPath?: string | null): string {
  if (mode === "vault") return cwdModeLabel("vault");
  const path = projectPath?.trim();
  if (!path) return "本地项目 · 未选择目录";
  const normalized = path.replace(/\//g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  if (parts.length <= 2) return `本地项目 · ${normalized}`;
  return `本地项目 · …\\${parts.slice(-2).join("\\")}`;
}

export type CcClaudeMdScope = "global" | "project";

export interface CcClaudeMdPreview {
  path: string;
  content: string;
  exists: boolean;
}

export interface CcHooksPreview {
  path: string;
  exists: boolean;
  hooksJson: string;
}

export async function getCcClaudeMd(scope: CcClaudeMdScope): Promise<CcClaudeMdPreview> {
  if (!isTauriRuntime()) {
    return { path: scope === "global" ? "~/.claude/CLAUDE.md" : "./CLAUDE.md", content: "", exists: false };
  }
  return tauriInvoke<CcClaudeMdPreview>("get_cc_claude_md", { scope });
}

export async function saveCcClaudeMd(
  scope: CcClaudeMdScope,
  content: string,
): Promise<CcClaudeMdPreview> {
  if (!isTauriRuntime()) throw new Error("请在 Tauri 应用中保存 CLAUDE.md");
  return tauriInvoke<CcClaudeMdPreview>("save_cc_claude_md", { scope, content });
}

export async function getCcHooks(scope: CcClaudeMdScope): Promise<CcHooksPreview> {
  if (!isTauriRuntime()) {
    return {
      path: scope === "global" ? "~/.claude/settings.json" : "./.claude/settings.json",
      exists: false,
      hooksJson: "{}",
    };
  }
  return tauriInvoke<CcHooksPreview>("get_cc_hooks", { scope });
}

export async function saveCcHooks(
  scope: CcClaudeMdScope,
  hooksJson: string,
): Promise<CcHooksPreview> {
  if (!isTauriRuntime()) throw new Error("请在 Tauri 应用中保存 Hooks");
  return tauriInvoke<CcHooksPreview>("save_cc_hooks", { scope, hooksJson });
}

export interface CcImportPreviewItem {
  id: string;
  name: string;
  status: "new" | "conflict" | "error" | string;
  sourcePath: string;
  message?: string | null;
}

export interface CcImportPreview {
  items: CcImportPreviewItem[];
  errors: string[];
}

export async function previewCcAgentsImport(
  request: CcAgentImportRequest,
): Promise<CcImportPreview> {
  return tauriInvoke<CcImportPreview>("preview_cc_agents_import", { request });
}

export async function previewCcSkillsImport(
  request: CcSkillImportRequest,
): Promise<CcImportPreview> {
  return tauriInvoke<CcImportPreview>("preview_cc_skills_import", { request });
}

export async function previewCcPromptsImport(
  request: CcPromptImportRequest,
): Promise<CcImportPreview> {
  return tauriInvoke<CcImportPreview>("preview_cc_prompts_import", { request });
}

export interface CcClaudePermissions {
  allow: string[];
  deny: string[];
  ask: string[];
}

export interface CcClaudePermissionsPreview {
  path: string;
  exists: boolean;
  permissions: CcClaudePermissions;
}

export async function getCcClaudePermissions(): Promise<CcClaudePermissionsPreview> {
  if (!isTauriRuntime()) {
    return {
      path: "~/.claude/settings.json",
      exists: false,
      permissions: { allow: [], deny: [], ask: [] },
    };
  }
  return tauriInvoke<CcClaudePermissionsPreview>("get_cc_claude_permissions");
}

export async function saveCcClaudePermissions(
  permissions: CcClaudePermissions,
): Promise<CcClaudePermissionsPreview> {
  return tauriInvoke<CcClaudePermissionsPreview>("save_cc_claude_permissions", { permissions });
}

export interface CcUsageEntry {
  timestamp: number;
  model: string;
  providerId?: string | null;
  inputTokens: number;
  outputTokens: number;
  durationMs?: number | null;
  estimatedCost?: number | null;
}

export async function appendCcUsageEntry(entry: CcUsageEntry): Promise<void> {
  if (!isTauriRuntime()) return;
  return tauriInvoke<void>("append_cc_usage_entry", { entry });
}

export async function getCcUsageStats(): Promise<CcUsageEntry[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<CcUsageEntry[]>("get_cc_usage_stats");
}

export async function fetchCcMarketCatalog(url: string): Promise<unknown[]> {
  if (!isTauriRuntime()) return [];
  const result = await tauriInvoke<unknown[]>("fetch_cc_market_catalog", { url });
  return Array.isArray(result) ? result : [];
}

export interface CcGitFileStatus {
  path: string;
  status: string;
}

export interface CcGitStatusResult {
  files: CcGitFileStatus[];
  isRepo: boolean;
}

export async function ccWorkbenchGitStatus(projectPath: string): Promise<CcGitStatusResult> {
  return tauriInvoke<CcGitStatusResult>("cc_workbench_git_status", { projectPath });
}

export interface CcGitFileDiffContents {
  path: string;
  oldContent: string;
  newContent: string;
}

export async function ccWorkbenchGitFileDiff(
  projectPath: string,
  path: string,
): Promise<CcGitFileDiffContents> {
  return tauriInvoke<CcGitFileDiffContents>("cc_workbench_git_file_diff", {
    projectPath,
    path,
  });
}

export async function ccWorkbenchGitDiff(
  projectPath: string,
  paths: string[],
): Promise<string> {
  return tauriInvoke<string>("cc_workbench_git_diff", { projectPath, paths });
}

export async function ccWorkbenchGitUndoEdits(
  projectPath: string,
  paths: string[],
): Promise<number> {
  return tauriInvoke<number>("cc_workbench_git_undo_edits", { projectPath, paths });
}
