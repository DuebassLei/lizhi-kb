import { randomUUID } from "node:crypto";

import { loadClaudeSdk } from "../utils/sdk-loader.js";
import {
  startPermissionResponseListener,
  waitForToolPermissionResponse,
} from "../utils/permission-responses.js";
import { buildSdkEnv } from "../utils/env-utils.js";
import {
  resolveProviderApiModel,
  resolveSdkModelName,
  setModelEnvironmentVariables,
} from "../utils/model-utils.js";
import {
  buildAnthropicEnv,
  buildAdditionalDirectories,
  buildPromptWithContext,
  mergeSdkSettings,
  normalizeCwd,
  bootstrapSdkSettingSources,
  sanitizeOpenedFiles,
} from "./claude-query-shared.js";
import { isDriveOnlyPath } from "../utils/path-utils.js";

const VAULT_DISALLOWED = [
  "Read",
  "Write",
  "Edit",
  "Bash",
  "Glob",
  "Grep",
  "WebSearch",
  "WebFetch",
  "Agent",
  "Task",
  "NotebookEdit",
];

const VAULT_DENY_MESSAGE =
  "知识库（vault）模式禁止内置文件工具（Read/Glob/Grep/Bash 等）。加密笔记只能通过 lizhi-mcp 访问：" +
  "请使用 mcp__lizhi-kb__lizhi_search 检索，mcp__lizhi-kb__lizhi_read_document 阅读。" +
  "请勿扫描 ~/.lizhi-kb 目录。";

const VAULT_SYSTEM_APPEND =
  "\n\n## 狸知知识库 vault 模式\n" +
  "- 当前为加密知识库模式：内置文件工具（Read/Write/Edit/Glob/Grep/Bash/WebSearch）不可用。\n" +
  "- 访问笔记**必须**通过 lizhi-mcp：`lizhi_search`、`lizhi_read_document`、`lizhi_list_documents` 等。\n" +
  "- **禁止** Glob/Grep/Read `~/.lizhi-kb` 或 workspace 路径；加密内容无法通过文件系统读取。\n" +
  "- 回答任何关于笔记/文档/标签/文件夹的问题前，**必须先**成功调用 `lizhi_search` 或 `lizhi_list_documents`，再用 `lizhi_read_document` 读取命中项后作答。\n" +
  "- **禁止**在正文中输出 `<lizhi_search>`、`<tool_call>`、`<function_calls>`、`<invoke>` 等伪 XML/标签假装调用工具；必须通过 SDK 的 tool_use 实际调用 MCP。\n" +
  "- 若客户端已在消息中注入「知识库预检索/预读取」结果，请直接据此回答，**不要**再次输出任何工具调用 XML。\n" +
  "- **严禁编造**文档标题、正文、标签、日期、路径、附件名、产品 ID；tool 无结果时必须明确回复「未找到相关笔记」并建议换关键词。\n" +
  "- 若 MCP 工具不可用，不得猜测 vault 内容，应提示用户在「设置 → AI 集成 / MCP」启用 lizhi-mcp。";

/**
 * @param {string} toolName
 */
function isVaultMcpTool(toolName) {
  return /^mcp__/i.test(String(toolName ?? "").trim());
}

/**
 * Minimal settings override — provider env is routed via options.env, not settings blob.
 * @param {string} selectedModel
 * @param {boolean} disableThinking
 */
function buildSdkSettingsOverride(selectedModel, disableThinking) {
  /** @type {Record<string, string>} */
  const env = {
    CLAUDE_CODE_EFFORT_LEVEL: "",
    MAX_THINKING_TOKENS: "",
  };
  const normalized = String(selectedModel ?? "").trim();
  if (normalized) {
    env.CLAUDE_CODE_DISABLE_1M_CONTEXT = /\[1m\]$/i.test(normalized) ? "" : "1";
  }
  if (disableThinking) {
    env.CLAUDE_CODE_DISABLE_THINKING = "1";
  }
  return { env };
}

/**
 * @param {Record<string, unknown>} params
 */
export async function runClaudeQuery(params) {
  const sdk = await loadClaudeSdk();
  const { query } = sdk;
  if (typeof query !== "function") {
    emit({ type: "error", message: "SDK 缺少 query 函数" });
    return;
  }

  const rawPrompt = String(params.prompt ?? "");
  if (!rawPrompt.trim()) {
    emit({ type: "error", message: "prompt 不能为空" });
    return;
  }

  const openedFilesRaw = Array.isArray(params.openedFiles) ? params.openedFiles.map(String) : [];
  const agentPrompt = params.agentPrompt ? String(params.agentPrompt) : null;

  const cwdMode = params.cwdMode === "project" ? "project" : "vault";
  let cwd;
  try {
    cwd = normalizeCwd(params.cwd);
  } catch (error) {
    const msg = formatBridgeError(error);
    emit({ type: "error", message: msg });
    return;
  }

  const { files: openedFiles, dropped: droppedFiles } = sanitizeOpenedFiles(
    openedFilesRaw,
    cwd,
    cwdMode,
  );
  if (droppedFiles > 0) {
    console.error(
      `[lizhi-bridge] 已忽略 ${droppedFiles} 个无效文件上下文（项目模式仅允许项目目录内文件）`,
    );
  }

  const prompt = buildPromptWithContext(
    openedFiles,
    params.openedFileContents,
    agentPrompt,
    rawPrompt,
    params.attachmentContents,
  );
  const anthropicEnv = buildAnthropicEnv(params);
  const selectedModel = String(params.selectedModel ?? "").trim();
  const selectedModelSlot = params.selectedModelSlot
    ? String(params.selectedModelSlot).trim()
    : null;
  const permissionMode = String(params.permissionMode ?? "").trim() || "default";
  const disableThinking = params.disableThinking === true;

  const resolvedApiModel = resolveProviderApiModel(selectedModel, selectedModelSlot, {
    model: params.model ? String(params.model) : null,
    sonnetModel: params.sonnetModel ? String(params.sonnetModel) : null,
    opusModel: params.opusModel ? String(params.opusModel) : null,
    fastModel: params.fastModel ? String(params.fastModel) : null,
  });
  const sdkModel = resolveSdkModelName(selectedModel, selectedModelSlot);
  const baseModelId = selectedModel || sdkModel;

  if (!anthropicEnv) {
    emit({ type: "error", message: "未配置 API Key / Auth Token" });
    return;
  }

  if (resolvedApiModel) {
    setModelEnvironmentVariables(resolvedApiModel, baseModelId);
  }

  if (disableThinking) {
    delete anthropicEnv.CLAUDE_CODE_EFFORT_LEVEL;
    anthropicEnv.CLAUDE_CODE_DISABLE_THINKING = "1";
  }

  const sdkEnv = buildSdkEnv(anthropicEnv, cwd);

  const additionalDirectories = buildAdditionalDirectories(cwd).filter(
    (dir) => !isDriveOnlyPath(dir),
  );

  const { settingSources } = bootstrapSdkSettingSources(cwdMode);

  /** @type {Record<string, unknown>} */
  const options = {
    cwd,
    settingSources,
    env: sdkEnv,
    permissionMode,
    includePartialMessages: true,
    additionalDirectories,
    strictMcpConfig: true,
    settings: mergeSdkSettings(
      params.settings,
      buildSdkSettingsOverride(selectedModel, disableThinking).env,
    ),
    systemPrompt:
      cwdMode === "vault"
        ? {
            type: "preset",
            preset: "claude_code",
            append: VAULT_SYSTEM_APPEND,
          }
        : {
            type: "preset",
            preset: "claude_code",
          },
  };

  // SDK expects short selectors (sonnet/opus/haiku); gateway model id lives in env vars.
  options.model = sdkModel;

  /** @type {Map<string, string>} */
  const toolNameByUseId = new Map();

  if (cwdMode === "vault") {
    // vault 必须 hard deny 非 MCP 工具：bypassPermissions / acceptEdits 会跳过 disallowedTools
    startPermissionResponseListener();
    options.canUseTool = async (toolName) => {
      const normalizedToolName = String(toolName ?? "tool");
      if (isVaultMcpTool(normalizedToolName)) {
        return { behavior: "allow" };
      }
      return { behavior: "deny", message: VAULT_DENY_MESSAGE };
    };
  } else if (permissionMode === "bypassPermissions") {
    options.allowDangerouslySkipPermissions = true;
  } else {
    startPermissionResponseListener();
    options.canUseTool = async (toolName, input) => {
      const normalizedToolName = String(toolName ?? "tool");
      const requestId = randomUUID();
      emit({
        type: "toolPermission",
        requestId,
        toolName: normalizedToolName,
        input: typeof input === "string" ? input : JSON.stringify(input ?? {}),
      });
      const result = await waitForToolPermissionResponse(requestId);
      return {
        behavior: result.behavior,
        ...(result.message ? { message: result.message } : {}),
      };
    };
  }

  if (params.sessionId || params.session_id) {
    const sessionId = String(params.sessionId ?? params.session_id ?? "").trim();
    if (sessionId) {
      options.resume = sessionId;
    }
  }

  if (cwdMode === "vault") {
    // Vault: only lizhi-mcp tools — strip all built-in Claude Code tools.
    options.tools = [];
    options.disallowedTools = VAULT_DISALLOWED;
    if (params.mcpServers && typeof params.mcpServers === "object") {
      options.mcpServers = params.mcpServers;
    }
  } else {
    options.tools = { type: "preset", preset: "claude_code" };
    if (params.mcpServers && typeof params.mcpServers === "object" && Object.keys(params.mcpServers).length) {
      options.mcpServers = params.mcpServers;
    }
  }

  try {
    const stream = query({ prompt, options });
    let lastSessionId = "";
    /** @type {{ sawStreamDelta: boolean; emittedToolCallIds: Set<string>; toolInputAcc?: Map<string, string>; toolBlockIndexMap?: Map<number, string>; lastToolUseId?: string }} */
    const streamState = { sawStreamDelta: false, emittedToolCallIds: new Set() };
    for await (const message of stream) {
      translateMessage(message, (sessionId) => {
        if (sessionId && sessionId !== lastSessionId) {
          lastSessionId = sessionId;
          emit({ type: "session", sessionId });
        }
      }, streamState, toolNameByUseId);
    }
    if (typeof stream.getContextUsage === "function") {
      try {
        const ctx = await stream.getContextUsage();
        emitContextUsage(ctx);
      } catch {
        /* context usage is best-effort */
      }
    }
    emit({ type: "done" });
  } catch (error) {
    const msg = formatBridgeError(error);
    emit({ type: "error", message: msg });
  }
}

/**
 * @param {unknown} error
 */
export function formatBridgeError(error) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("EISDIR") && /['\"]D:['\"]?/.test(raw)) {
    return "工作目录解析失败（路径被截断为盘符 D:），请在设置中重新选择完整项目文件夹";
  }
  if (raw.includes("EISDIR")) {
    return `文件系统错误：${raw}`;
  }
  if (
    /Input should be 'user' or 'assistant'/.test(raw) &&
    /input': 'system'|input": "system"|'system'/.test(raw)
  ) {
    return (
      "网关兼容性错误：Claude Code 向 API 发送了 system 角色消息，但当前 vLLM 代理不支持。" +
      "请在 Agent 工作台设置中重新安装 SDK（已锁定兼容版本 0.3.153），或联系网关管理员升级 vLLM 至 0.23.0+。"
    );
  }
  return raw;
}

/**
 * @param {Record<string, unknown>} payload
 */
function emit(payload) {
  console.log(JSON.stringify(payload));
}

function readUsageNumber(record, snakeKey, camelKey) {
  if (!record || typeof record !== "object") return 0;
  const u = /** @type {Record<string, unknown>} */ (record);
  const raw = u[snakeKey] ?? u[camelKey];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * @param {Record<string, unknown> | null | undefined} modelUsage
 */
function aggregateModelUsage(modelUsage) {
  if (!modelUsage || typeof modelUsage !== "object") return null;
  let input = 0;
  let output = 0;
  let cacheCreation = 0;
  let cacheRead = 0;
  for (const entry of Object.values(modelUsage)) {
    if (!entry || typeof entry !== "object") continue;
    const e = /** @type {Record<string, unknown>} */ (entry);
    input += readUsageNumber(e, "input_tokens", "inputTokens");
    output += readUsageNumber(e, "output_tokens", "outputTokens");
    cacheCreation += readUsageNumber(e, "cache_creation_input_tokens", "cacheCreationInputTokens");
    cacheRead += readUsageNumber(e, "cache_read_input_tokens", "cacheReadInputTokens");
  }
  const totalInput = input + cacheCreation + cacheRead;
  if (totalInput <= 0 && output <= 0) return null;
  return { inputTokens: totalInput, outputTokens: output };
}

/**
 * @param {unknown} usage
 * @param {unknown} [modelUsage]
 */
function emitUsageFromRecord(usage, modelUsage) {
  let inputTokens = 0;
  let outputTokens = 0;
  if (usage && typeof usage === "object") {
    const u = /** @type {Record<string, unknown>} */ (usage);
    const input = readUsageNumber(u, "input_tokens", "inputTokens");
    const output = readUsageNumber(u, "output_tokens", "outputTokens");
    const cacheCreation = readUsageNumber(u, "cache_creation_input_tokens", "cacheCreationInputTokens");
    const cacheRead = readUsageNumber(u, "cache_read_input_tokens", "cacheReadInputTokens");
    inputTokens = input + cacheCreation + cacheRead;
    outputTokens = output;
  }
  if (inputTokens <= 0 && outputTokens <= 0) {
    const aggregated = aggregateModelUsage(
      modelUsage && typeof modelUsage === "object"
        ? /** @type {Record<string, unknown>} */ (modelUsage)
        : null,
    );
    if (!aggregated) return;
    inputTokens = aggregated.inputTokens;
    outputTokens = aggregated.outputTokens;
  }
  emit({
    type: "usage",
    inputTokens,
    outputTokens,
  });
}

/**
 * @param {unknown} ctx
 */
function emitContextUsage(ctx) {
  if (!ctx || typeof ctx !== "object") return;
  const c = /** @type {Record<string, unknown>} */ (ctx);
  const total = Number(c.totalTokens ?? c.total_tokens ?? 0);
  const max = Number(c.maxTokens ?? c.max_tokens ?? 0);
  const pct = Number(c.percentage ?? 0);
  const totalTokens = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const maxTokens = Number.isFinite(max) && max > 0 ? Math.floor(max) : 0;
  const contextPercentage = Number.isFinite(pct) && pct > 0 ? pct : undefined;
  if (totalTokens <= 0 && maxTokens <= 0 && contextPercentage === undefined) return;
  /** @type {Record<string, unknown>} */
  const payload = {
    type: "usage",
    inputTokens: 0,
    outputTokens: 0,
    contextTotalTokens: totalTokens,
    contextMaxTokens: maxTokens,
  };
  if (contextPercentage !== undefined) payload.contextPercentage = contextPercentage;
  emit(payload);
}

/**
 * @param {unknown} content
 */
function formatToolResultContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const p = /** @type {Record<string, unknown>} */ (part);
        if (p.type === "text" && typeof p.text === "string") return p.text;
        return JSON.stringify(part);
      })
      .filter(Boolean);
    return parts.length ? parts.join("\n") : JSON.stringify(content);
  }
  if (content && typeof content === "object") {
    return JSON.stringify(content);
  }
  return String(content ?? "");
}

/**
 * @param {unknown} message
 * @param {(sessionId: string) => void} [onSession]
 * @param {{ sawStreamDelta: boolean; emittedToolCallIds?: Set<string> }} [streamState]
 * @param {Map<string, string>} [toolNameByUseId]
 */
function translateMessage(message, onSession, streamState, toolNameByUseId) {
  if (!message || typeof message !== "object") return;
  const m = /** @type {Record<string, unknown>} */ (message);
  const type = m.type;

  const sessionId = typeof m.session_id === "string" ? m.session_id : "";
  if (sessionId && onSession) {
    onSession(sessionId);
  }

  if (type === "system" && m.usage && typeof m.usage === "object") {
    const subtype = typeof m.subtype === "string" ? m.subtype : "";
    if (subtype === "task_progress" || subtype === "task_notification") {
      const u = /** @type {Record<string, unknown>} */ (m.usage);
      const total = Number(u.total_tokens ?? u.totalTokens ?? 0);
      if (Number.isFinite(total) && total > 0) {
        emit({
          type: "usage",
          inputTokens: 0,
          outputTokens: 0,
          contextTotalTokens: Math.floor(total),
        });
      }
    }
    return;
  }

  if (type === "stream_event" && m.event && typeof m.event === "object") {
    const event = /** @type {Record<string, unknown>} */ (m.event);
    if (event.type === "content_block_start" && event.content_block && typeof event.content_block === "object") {
      const block = /** @type {Record<string, unknown>} */ (event.content_block);
      if (block.type === "tool_use") {
        const toolUseId = String(block.id ?? "").trim();
        const toolName = String(block.name ?? "tool");
        if (toolUseId) {
          toolNameByUseId?.set(toolUseId, toolName);
        }
        // 重置该 toolUseId 的输入累加器
        if (streamState) {
          if (!streamState.toolInputAcc) streamState.toolInputAcc = new Map();
          streamState.toolInputAcc.set(toolUseId, "");
          streamState.lastToolUseId = toolUseId;
          // 记录 content block index → toolUseId 映射，供 input_json_delta 查找
          if (typeof event.index === "number") {
            if (!streamState.toolBlockIndexMap) streamState.toolBlockIndexMap = new Map();
            streamState.toolBlockIndexMap.set(event.index, toolUseId);
          }
        }
        if (
          toolUseId &&
          streamState?.emittedToolCallIds &&
          !streamState.emittedToolCallIds.has(toolUseId)
        ) {
          streamState.emittedToolCallIds.add(toolUseId);
          emit({
            type: "toolCall",
            name: toolName,
            input: "{}",
            toolUseId,
          });
        }
      }
    }
    if (event.type === "content_block_delta" && event.delta && typeof event.delta === "object") {
      const delta = /** @type {Record<string, unknown>} */ (event.delta);
      if (delta.type === "text_delta" && typeof delta.text === "string" && delta.text) {
        if (streamState) streamState.sawStreamDelta = true;
        emit({ type: "token", content: delta.text });
      }
      if (delta.type === "thinking_delta" && typeof delta.thinking === "string" && delta.thinking) {
        if (streamState) streamState.sawStreamDelta = true;
        emit({ type: "thinking", content: delta.thinking });
      }
      if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
        // 累加工具参数 JSON，逐步更新 toolCall input
        if (streamState) {
          if (!streamState.toolInputAcc) streamState.toolInputAcc = new Map();
          const index = typeof event.index === "number" ? event.index : -1;
          const resolvedId =
            streamState.toolBlockIndexMap?.get(index) ??
            streamState.lastToolUseId ??
            null;
          if (resolvedId) {
            const prev = streamState.toolInputAcc.get(resolvedId) ?? "";
            const next = prev + delta.partial_json;
            streamState.toolInputAcc.set(resolvedId, next);
            const toolName = toolNameByUseId?.get(resolvedId) ?? "tool";
            emit({
              type: "toolCall",
              name: String(toolName),
              input: next,
              toolUseId: resolvedId,
            });
            if (!streamState.emittedToolCallIds.has(resolvedId)) {
              streamState.emittedToolCallIds.add(resolvedId);
            }
          }
        }
      }
    }
    if (event.type === "message_start" && event.message && typeof event.message === "object") {
      const startMsg = /** @type {Record<string, unknown>} */ (event.message);
      if (startMsg.usage) {
        emitUsageFromRecord(startMsg.usage);
      }
    }
    if (event.type === "message_delta" && event.usage && typeof event.usage === "object") {
      emitUsageFromRecord(event.usage);
    }
    return;
  }

  if (type === "assistant") {
    let emittedText = false;
    const sawStreamDelta = streamState?.sawStreamDelta ?? false;
    if (m.message && typeof m.message === "object") {
      const msg = /** @type {Record<string, unknown>} */ (m.message);
      if (msg.usage) {
        emitUsageFromRecord(msg.usage);
      }
      const content = msg.content;
      if (typeof content === "string" && content && !sawStreamDelta) {
        emit({ type: "token", content });
        emittedText = true;
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (!block || typeof block !== "object") continue;
          const b = /** @type {Record<string, unknown>} */ (block);
          if (b.type === "tool_use") {
            const toolUseId = String(b.id ?? "").trim();
            const toolName = String(b.name ?? "tool");
            if (toolUseId) {
              toolNameByUseId?.set(toolUseId, toolName);
            }
            // 始终发出 toolCall：完整消息中的 tool_use 带有完整 input，
            // applyToolCallToBlocks 会更新已存在工具块的 input
            if (toolUseId && streamState?.emittedToolCallIds) {
              streamState.emittedToolCallIds.add(toolUseId);
            }
            emit({
              type: "toolCall",
              name: toolName,
              input: JSON.stringify(b.input ?? {}),
              toolUseId,
            });
          } else if (!sawStreamDelta) {
            if (b.type === "text" && typeof b.text === "string" && b.text) {
              emit({ type: "token", content: b.text });
              emittedText = true;
            }
            if (b.type === "thinking" && typeof b.thinking === "string" && b.thinking) {
              emit({ type: "thinking", content: b.thinking });
            }
          }
        }
      }
    }
    if (!emittedText && m.error) {
      emit({ type: "error", message: String(m.error) });
    }
    return;
  }

  if (type === "user" && m.message && typeof m.message === "object") {
    const msg = /** @type {Record<string, unknown>} */ (m.message);
    const content = msg.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const b = /** @type {Record<string, unknown>} */ (block);
        if (b.type === "tool_result") {
          const toolUseId = String(b.tool_use_id ?? "").trim();
          const output = formatToolResultContent(b.content);
          let resolvedName =
            (toolUseId && toolNameByUseId?.get(toolUseId)) ||
            String(b.name ?? "").trim();
          if (!resolvedName || resolvedName === "tool") {
            for (const [id, mappedName] of toolNameByUseId ?? []) {
              if (id === toolUseId && mappedName && mappedName !== "tool") {
                resolvedName = mappedName;
                break;
              }
            }
          }
          if (!resolvedName) resolvedName = "tool";
          emit({
            type: "toolResult",
            name: resolvedName,
            output,
            toolUseId,
          });
        }
      }
    }
    return;
  }

  if (type === "result") {
    const subtype = typeof m.subtype === "string" ? m.subtype : "";
    if (m.is_error === true && subtype !== "success") {
      const errors = Array.isArray(m.errors)
        ? m.errors.map((e) => String(e)).join("; ")
        : "";
      emit({
        type: "error",
        message: errors || subtype || "Agent 执行失败",
      });
      return;
    }
    if (typeof m.result === "string" && m.result && !streamState?.sawStreamDelta) {
      emit({ type: "token", content: m.result });
    }
    if (m.usage || m.modelUsage) {
      emitUsageFromRecord(m.usage, m.modelUsage);
    }
  }
}
