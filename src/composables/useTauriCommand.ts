import { invoke } from "@tauri-apps/api/core";
import type { VaultErrorCode } from "../types/vault";

export class TauriCommandError extends Error {
  code: VaultErrorCode;

  constructor(code: VaultErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function mapError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("VAULT_LOCKED")) throw new TauriCommandError("VAULT_LOCKED", msg);
    if (msg.includes("WRONG_PASSWORD")) throw new TauriCommandError("WRONG_PASSWORD", msg);
    if (msg.includes("PASSWORD_REQUIRED")) throw new TauriCommandError("IO_ERROR", msg);
  if (msg.includes("VAULT_NOT_FOUND")) throw new TauriCommandError("VAULT_NOT_FOUND", msg);
  throw new TauriCommandError("IO_ERROR", msg);
}

export async function tauriInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    mapError(e);
  }
}
