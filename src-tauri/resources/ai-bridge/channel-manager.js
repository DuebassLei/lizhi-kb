import { readStdinFirstJsonLine, readStdinJson } from "./utils/stdin-utils.js";
import { isClaudeSdkAvailable, getSdkStatus } from "./utils/sdk-loader.js";
import { runClaudeQuery, formatBridgeError } from "./services/claude-query.js";
import { runPromptEnhancer } from "./services/prompt-enhancer.js";
import { runModelTest } from "./services/model-test.js";

async function handleSystem(command) {
  switch (command) {
    case "getSdkStatus":
      console.log(JSON.stringify({ success: true, data: getSdkStatus() }));
      break;
    case "checkClaudeSdk":
      console.log(JSON.stringify({ success: true, available: isClaudeSdkAvailable() }));
      break;
    default:
      console.log(JSON.stringify({ success: false, error: `未知系统命令: ${command}` }));
      process.exit(1);
  }
}

/**
 * @param {string} command
 * @param {Record<string, unknown>} stdinData
 */
async function handleClaude(command, stdinData) {
  if (command === "send") {
    if (!isClaudeSdkAvailable()) {
      console.log(JSON.stringify({ success: false, error: "SDK_NOT_INSTALLED", code: "SDK_NOT_INSTALLED" }));
      process.exit(1);
    }
    await runClaudeQuery(stdinData);
    return;
  }
  if (command === "enhance") {
    if (!isClaudeSdkAvailable()) {
      console.log("[ENHANCED]Enhancement failed: SDK 未安装");
      process.exit(1);
    }
    try {
      const enhanced = await runPromptEnhancer(stdinData);
      const encoded = enhanced.replace(/\n/g, "{{NEWLINE}}");
      console.log(`[ENHANCED]${encoded}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[ENHANCED]Enhancement failed: ${message}`);
      process.exit(1);
    }
    return;
  }
  if (command === "test-model") {
    if (!isClaudeSdkAvailable()) {
      console.log(JSON.stringify({ success: false, error: "SDK 未安装" }));
      process.exit(1);
    }
    try {
      await runModelTest(stdinData);
      console.log(JSON.stringify({ success: true }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(JSON.stringify({ success: false, error: message }));
      process.exit(1);
    }
    return;
  }
  console.log(JSON.stringify({ success: false, error: `未知 claude 命令: ${command}` }));
  process.exit(1);
}

const provider = process.argv[2];
const command = process.argv[3];

process.on("uncaughtException", (error) => {
  console.log(JSON.stringify({ type: "error", message: formatBridgeError(error) }));
  process.exit(1);
});

try {
  if (provider === "system") {
    await handleSystem(command);
    process.exit(0);
  }
  if (provider === "claude") {
    const stdinData =
      command === "send" ? await readStdinFirstJsonLine() : await readStdinJson();
    await handleClaude(command, stdinData);
    process.exit(0);
  }
  console.log(JSON.stringify({ success: false, error: `无效 provider: ${provider}` }));
  process.exit(1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(JSON.stringify({ type: "error", message }));
  process.exit(1);
}
