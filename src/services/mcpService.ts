import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "./vaultService";

export type McpBackendMode = "bridge" | "standalone";

export interface McpConfigPublic {
  enabled: boolean;
  writeEnabled: boolean;
  port: number;
  standalonePort: number;
  sessionTimeoutMinutes: number;
  tokenMasked: string;
  token?: string | null;
}

export interface McpConfigUpdate {
  enabled?: boolean;
  writeEnabled?: boolean;
  port?: number;
  standalonePort?: number;
  sessionTimeoutMinutes?: number;
}

const DEFAULT_MCP_CONFIG: McpConfigPublic = {
  enabled: false,
  writeEnabled: false,
  port: 13721,
  standalonePort: 13722,
  sessionTimeoutMinutes: 30,
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

export function buildCursorMcpConfigSnippet(
  token: string,
  port: number,
  mode: McpBackendMode = "bridge",
  standalonePort = 13722,
  scriptPath?: string | null,
): string {
  const env: Record<string, string> = {
    LIZHI_MCP_BACKEND: mode === "standalone" ? "standalone" : "http_bridge",
    LIZHI_MCP_TOKEN: token,
  };
  if (mode === "standalone") {
    env.LIZHI_MCP_STANDALONE_URL = `http://127.0.0.1:${standalonePort}`;
  } else {
    env.LIZHI_MCP_URL = `http://127.0.0.1:${port}`;
  }
  const adapterPath =
    scriptPath?.trim() ||
    "<PROJECT_ROOT>/packages/lizhi-mcp/dist/index.js";
  return JSON.stringify(
    {
      mcpServers: {
        "lizhi-kb": {
          command: "node",
          args: [adapterPath.replace(/\\/g, "/")],
          env,
        },
      },
    },
    null,
    2,
  );
}
