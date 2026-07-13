import { loadClaudeSdk } from "../utils/sdk-loader.js";
import { prepareBridgeSdkContext, bootstrapSdkSettingSources } from "./claude-query-shared.js";
import { formatBridgeError } from "./claude-query.js";

const MODEL_TEST_TIMEOUT_MS = 20_000;

/**
 * Lightweight connectivity test for a configured model slot.
 * @param {Record<string, unknown>} params
 */
export async function runModelTest(params) {
  let timer;
  try {
    await Promise.race([
      runModelTestInner(params),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("模型测试超时，请检查网络或 API 配置")),
          MODEL_TEST_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runModelTestInner(params) {
  const sdk = await loadClaudeSdk();
  const { query } = sdk;
  if (typeof query !== "function") {
    throw new Error("SDK 缺少 query 函数");
  }

  const { cwd, sdkModel, sdkEnv, settings } = prepareBridgeSdkContext({
    ...params,
    disableThinking: true,
  });

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
    systemPrompt: "Reply with exactly: OK",
    canUseTool: async () => ({ behavior: "deny", message: "模型测试不执行工具" }),
  };

  try {
    const stream = query({ prompt: "ping", options });
    for await (const msg of stream) {
      if (msg && typeof msg === "object" && msg.type === "result") {
        const result = /** @type {Record<string, unknown>} */ (msg);
        if (result.is_error === true) {
          const errors = Array.isArray(result.errors)
            ? result.errors.map((e) => String(e)).join("; ")
            : String(result.result ?? result.subtype ?? "模型不可用");
          throw new Error(formatBridgeError(new Error(errors)));
        }
        return { ok: true };
      }
    }
    return { ok: true };
  } catch (error) {
    throw new Error(formatBridgeError(error));
  }
}
