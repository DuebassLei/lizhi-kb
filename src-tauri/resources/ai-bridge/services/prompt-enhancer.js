import { loadClaudeSdk } from "../utils/sdk-loader.js";
import { prepareBridgeSdkContext, bootstrapSdkSettingSources } from "./claude-query-shared.js";
import { formatBridgeError } from "./claude-query.js";

const ENHANCE_SYSTEM_PROMPT =
  "你是提示词优化专家。用户会发送待优化的提示词。\n" +
  "你的任务：让提示更清晰、具体、可执行。\n\n" +
  "输出规则：\n" +
  "- 只输出优化后的提示词正文\n" +
  "- 不要解释、不要前缀后缀\n" +
  "- 保持与用户原文相同的语言\n";

/**
 * @param {unknown} message
 */
function collectAssistantText(message) {
  if (!message || typeof message !== "object") return "";
  const m = /** @type {Record<string, unknown>} */ (message);
  if (m.type === "stream_event" && m.event && typeof m.event === "object") {
    const event = /** @type {Record<string, unknown>} */ (m.event);
    if (event.type === "content_block_delta" && event.delta && typeof event.delta === "object") {
      const delta = /** @type {Record<string, unknown>} */ (event.delta);
      if (delta.type === "text_delta" && typeof delta.text === "string") {
        return delta.text;
      }
    }
    return "";
  }
  if (m.type !== "assistant") return "";
  const content = m.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let text = "";
  for (const block of content) {
    if (block?.type === "text" && typeof block.text === "string") {
      text += block.text;
    }
  }
  return text;
}

/**
 * @param {Record<string, unknown>} params
 */
export async function runPromptEnhancer(params) {
  const sdk = await loadClaudeSdk();
  const { query } = sdk;
  if (typeof query !== "function") {
    throw new Error("SDK 缺少 query 函数");
  }

  const prompt = String(params.prompt ?? "").trim();
  if (!prompt) {
    return "";
  }

  const { cwd, sdkModel, sdkEnv, settings } = prepareBridgeSdkContext({
    ...params,
    disableThinking: true,
  });
  const fullPrompt = `请优化以下提示词：\n\n${prompt}`;

  const { settingSources } = bootstrapSdkSettingSources(
    params.cwdMode === "project" ? "project" : "vault",
  );

  /** @type {Record<string, unknown>} */
  const options = {
    cwd,
    settingSources,
    env: sdkEnv,
    permissionMode: "default",
    maxTurns: 1,
    includePartialMessages: true,
    model: sdkModel,
    settings,
    systemPrompt: params.enhanceSystemPrompt || ENHANCE_SYSTEM_PROMPT,
    canUseTool: async () => ({ behavior: "deny", message: "提示词增强不执行工具" }),
  };

  let responseText = "";
  try {
    const stream = query({ prompt: fullPrompt, options });
    for await (const msg of stream) {
      if (msg && typeof msg === "object" && msg.type === "result") {
        const result = /** @type {Record<string, unknown>} */ (msg);
        if (result.is_error === true) {
          const errors = Array.isArray(result.errors)
            ? result.errors.map((e) => String(e)).join("; ")
            : String(result.result ?? result.subtype ?? "增强失败");
          throw new Error(formatBridgeError(new Error(errors)));
        }
      }
      responseText += collectAssistantText(msg);
    }
  } catch (error) {
    throw new Error(formatBridgeError(error));
  }

  const trimmed = responseText.trim();
  if (!trimmed) {
    throw new Error("模型未返回增强结果");
  }
  return trimmed;
}
