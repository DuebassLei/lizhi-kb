import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { HttpBridgeBackend } from "./client.js";
import { StandaloneBackend } from "./standalone.js";
import { registerLizhiTools } from "./tools.js";
import type { LizhiBackend } from "./types.js";
import { LizhiBridgeError } from "./types.js";

function createBackend(): LizhiBackend {
  const mode = (process.env.LIZHI_MCP_BACKEND ?? "http_bridge").toLowerCase();
  if (mode === "http_bridge" || mode === "bridge") {
    return new HttpBridgeBackend();
  }
  if (mode === "standalone" || mode === "sidecar") {
    return new StandaloneBackend();
  }
  throw new LizhiBridgeError(
    "UNSUPPORTED_BACKEND",
    `不支持的 backend: ${mode}（可选: http_bridge | standalone）`,
  );
}

export function createServer(backend: LizhiBackend = createBackend()): McpServer {
  const server = new McpServer({
    name: "lizhi-kb",
    version: "0.3.0",
  });
  registerLizhiTools(server, backend);
  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("lizhi-mcp failed:", error);
  process.exit(1);
});
