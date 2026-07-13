import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import { isDriveOnlyPath } from "./path-utils.js";

/**
 * Invalid keys in ~/.claude.json `projects` cause Claude Code on Windows to
 * treat drive letters (e.g. "D:") as directories → EISDIR.
 * @param {string} key
 */
export function isInvalidProjectRegistryKey(key) {
  const trimmed = String(key ?? "").trim();
  if (!trimmed) return true;
  if (isDriveOnlyPath(trimmed)) return true;
  const asBackslash = trimmed.replace(/\//g, "\\");
  if (isDriveOnlyPath(asBackslash)) return true;
  if (/^[A-Za-z]:$/.test(trimmed)) return true;
  return false;
}

/**
 * Remove malformed project keys from ~/.claude.json before SDK loads settings.
 * @returns {{ removed: number; written: boolean; error?: string }}
 */
export function sanitizeClaudeJsonProjects() {
  const path = join(homedir(), ".claude.json");
  if (!existsSync(path)) {
    return { removed: 0, written: false };
  }

  /** @type {Record<string, unknown>} */
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { removed: 0, written: false, error: "parse_failed" };
  }

  if (!data || typeof data !== "object") {
    return { removed: 0, written: false };
  }

  const projects = data.projects;
  if (!projects || typeof projects !== "object" || Array.isArray(projects)) {
    return { removed: 0, written: false };
  }

  let removed = 0;
  for (const key of Object.keys(projects)) {
    if (isInvalidProjectRegistryKey(key)) {
      delete /** @type {Record<string, unknown>} */ (projects)[key];
      removed++;
    }
  }

  if (removed === 0) {
    return { removed: 0, written: false };
  }

  try {
    const tmp = `${path}.lizhi-sanitize.tmp`;
    writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    renameSync(tmp, path);
    return { removed, written: true };
  } catch {
    return { removed, written: false, error: "write_failed" };
  }
}

/**
 * Prepare SDK settingSources + sanitize ~/.claude.json project registry.
 * @param {"project"|"vault"} cwdMode
 * @returns {{ settingSources: Array<"user"|"project"|"local">; sanitize: { removed: number; written: boolean } }}
 */
export function bootstrapSdkSettingSources(cwdMode) {
  const sanitize = sanitizeClaudeJsonProjects();
  if (sanitize.removed > 0) {
    console.error(
      `[lizhi-bridge] 已从 ~/.claude.json 移除 ${sanitize.removed} 个无效项目路径键` +
        (sanitize.written ? "" : "（写入失败，请手动检查配置）"),
    );
  }

  /** @type {Array<"user"|"project"|"local">} */
  const settingSources =
    cwdMode === "project" ? ["user", "project", "local"] : ["user"];

  return { settingSources, sanitize };
}
