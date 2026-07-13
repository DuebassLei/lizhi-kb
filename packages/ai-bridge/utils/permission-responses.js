import { createInterface } from "readline";

/** @type {Map<string, { resolve: (value: { behavior: string; message?: string }) => void; timer: ReturnType<typeof setTimeout> }>} */
const pending = new Map();

let listenerStarted = false;

/**
 * Listen for `{ type: "toolPermissionResponse", requestId, behavior, message? }` on stdin.
 */
export function startPermissionResponseListener() {
  if (listenerStarted) return;
  listenerStarted = true;

  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }

    if (msg?.type !== "toolPermissionResponse") return;
    const requestId = typeof msg.requestId === "string" ? msg.requestId : "";
    if (!requestId) return;

    const entry = pending.get(requestId);
    if (!entry) return;

    clearTimeout(entry.timer);
    pending.delete(requestId);
    entry.resolve({
      behavior: msg.behavior === "allow" ? "allow" : "deny",
      message: typeof msg.message === "string" ? msg.message : undefined,
    });
  });
}

/**
 * @param {string} requestId
 * @param {number} [timeoutMs]
 * @returns {Promise<{ behavior: "allow" | "deny"; message?: string }>}
 */
export function waitForToolPermissionResponse(requestId, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve({ behavior: "deny", message: "权限请求超时" });
    }, timeoutMs);

    pending.set(requestId, {
      resolve: (value) => resolve(value),
      timer,
    });
  });
}
