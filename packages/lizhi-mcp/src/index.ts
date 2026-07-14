import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { HttpBridgeBackend } from "./client.js";
import { registerLizhiTools } from "./tools.js";
import type { LizhiBackend } from "./types.js";

function createBackend(): LizhiBackend {
  return new HttpBridgeBackend();
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
