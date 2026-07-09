import { HttpBackendBase } from "./httpBackend.js";
import { LizhiBridgeError } from "./types.js";

/** Phase 2 Sidecar backend — 连接 lizhi-mcpd 独立 HTTP 服务。 */
export class StandaloneBackend extends HttpBackendBase {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl?: string, token?: string) {
    super();
    this.baseUrl = (
      baseUrl ??
      process.env.LIZHI_MCP_STANDALONE_URL ??
      "http://127.0.0.1:13722"
    ).replace(/\/$/, "");
    this.token = token ?? process.env.LIZHI_MCP_TOKEN ?? "";
    if (!this.token) {
      throw new LizhiBridgeError(
        "MISSING_TOKEN",
        "请设置 LIZHI_MCP_TOKEN 环境变量（在狸知设置中复制）",
      );
    }
  }

  protected async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      const err = payload as { error?: string; message?: string } | null;
      throw new LizhiBridgeError(
        err?.error ?? "STANDALONE_ERROR",
        err?.message ?? `HTTP ${response.status}`,
      );
    }

    return payload as T;
  }
}
