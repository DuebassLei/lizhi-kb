import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "./vaultService";

export interface McpConfigPublic {
  enabled: boolean;
  writeEnabled: boolean;
  port: number;
  tokenMasked: string;
  token?: string | null;
}

export interface McpConfigUpdate {
  enabled?: boolean;
  writeEnabled?: boolean;
  port?: number;
}

const DEFAULT_MCP_CONFIG: McpConfigPublic = {
  enabled: false,
  writeEnabled: false,
  port: 13721,
  tokenMasked: "e2e-****-mock",
  token: "e2e-mock-token",
};

let browserMcpConfig: McpConfigPublic = { ...DEFAULT_MCP_CONFIG };

export async function getMcpConfig(revealToken = false): Promise<McpConfigPublic> {
  if (!isTauriRuntime()) {
    return {
      ...browserMcpConfig,
      token: revealToken ? browserMcpConfig.token ?? DEFAULT_MCP_CONFIG.token : undefined,
    };
  }
  return tauriInvoke<McpConfigPublic>("get_mcp_config", { revealToken });
}

export async function setMcpConfig(update: McpConfigUpdate): Promise<McpConfigPublic> {
  if (!isTauriRuntime()) {
    browserMcpConfig = { ...browserMcpConfig, ...update };
    return getMcpConfig(true);
  }
  return tauriInvoke<McpConfigPublic>("set_mcp_config", { update });
}

export async function regenerateMcpToken(): Promise<McpConfigPublic> {
  if (!isTauriRuntime()) {
    browserMcpConfig = {
      ...browserMcpConfig,
      token: `e2e-regen-${Date.now()}`,
      tokenMasked: "e2e-****-regen",
    };
    return getMcpConfig(true);
  }
  return tauriInvoke<McpConfigPublic>("regenerate_mcp_token");
}

export async function getMcpAdapterPath(): Promise<string | null> {
  try {
    return await tauriInvoke<string | null>("get_mcp_adapter_path");
  } catch {
    return null;
  }
}

/** 生成 Cursor MCP 配置（仅 Bridge：需狸知运行且已启用 MCP） */
export function buildCursorMcpConfigSnippet(
  token: string,
  port: number,
  scriptPath?: string | null,
): string {
  const adapterPath =
    scriptPath?.trim() ||
    "<INSTALL_OR_PROJECT>/lizhi-mcp/index.js";
  return JSON.stringify(
    {
      mcpServers: {
        "lizhi-kb": {
          command: "node",
          args: [adapterPath.replace(/\\/g, "/")],
          env: {
            LIZHI_MCP_TOKEN: token,
            LIZHI_MCP_URL: `http://127.0.0.1:${port}`,
          },
        },
      },
    },
    null,
    2,
  );
}
