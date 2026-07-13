import { existsSync, realpathSync, statSync } from "fs";
import { homedir } from "os";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

export function getLizhiDataDir() {
  const raw = process.env.LIZHI_DATA_DIR?.trim();
  if (raw) {
    const normalized = sanitizeDirectoryPath(raw);
    if (normalized) return normalized;
  }
  return joinSafe(homedir(), ".lizhi-kb");
}

export function getSdkRootDir() {
  return joinSafe(getLizhiDataDir(), "dependencies", "claude-sdk");
}

function joinSafe(...parts) {
  return resolve(...parts);
}

/**
 * @param {string | null | undefined} candidate
 */
export function isDriveOnlyPath(candidate) {
  if (!candidate || typeof candidate !== "string") return false;
  const trimmed = candidate.trim();
  return /^[A-Za-z]:[\\/]?$/.test(trimmed);
}

/**
 * @param {string | null | undefined} candidate
 * @returns {string | null}
 */
export function sanitizeDirectoryPath(candidate) {
  if (!candidate || typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;
  if (isDriveOnlyPath(trimmed)) return null;
  try {
    const normalized = resolve(trimmed.replace(/\//g, "\\"));
    if (isDriveOnlyPath(normalized)) return null;
    if (!existsSync(normalized)) return null;
    if (!statSync(normalized).isDirectory()) return null;
    return normalized;
  } catch {
    return null;
  }
}

let cachedBridgeDir = null;

function getBridgeDir() {
  if (cachedBridgeDir) return cachedBridgeDir;
  const bridgeDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    cachedBridgeDir = realpathSync(bridgeDir);
  } catch {
    cachedBridgeDir = bridgeDir;
  }
  return cachedBridgeDir;
}

function isBridgeDirectory(pathValue) {
  if (!pathValue) return false;
  try {
    const a = realpathSync(pathValue);
    const b = getBridgeDir();
    return a.toLowerCase() === b.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Pick a validated working directory for the SDK.
 * @param {string | null | undefined} requestedCwd
 */
export function selectWorkingDirectory(requestedCwd) {
  const candidates = [];
  const envProject = process.env.LIZHI_PROJECT_PATH
    || process.env.IDEA_PROJECT_PATH
    || process.env.PROJECT_PATH;

  const requested = sanitizeDirectoryPath(requestedCwd);
  if (requested) candidates.push(requested);

  const fromEnv = sanitizeDirectoryPath(envProject);
  if (fromEnv) candidates.push(fromEnv);

  const processCwd = sanitizeDirectoryPath(process.cwd());
  if (processCwd) candidates.push(processCwd);

  for (const candidate of candidates) {
    if (isBridgeDirectory(candidate)) continue;
    return candidate;
  }

  const home = sanitizeDirectoryPath(homedir());
  if (home) return home;
  throw new Error("无法解析有效的工作目录，请在设置中重新选择项目文件夹");
}

/**
 * @param {string} cwd
 * @returns {string[]}
 */
export function buildAdditionalDirectories(cwd) {
  const dirs = new Set();
  const main = sanitizeDirectoryPath(cwd);
  if (main && !isDriveOnlyPath(main)) dirs.add(main);
  return [...dirs];
}

/**
 * In project mode, only keep file paths that exist under cwd (drops vault-relative paths).
 * @param {string[]} openedFiles
 * @param {string} cwd
 * @param {"project"|"vault"} cwdMode
 * @returns {{ files: string[]; dropped: number }}
 */
export function sanitizeOpenedFiles(openedFiles, cwd, cwdMode) {
  if (cwdMode !== "project" || !Array.isArray(openedFiles)) {
    return { files: openedFiles ?? [], dropped: 0 };
  }
  const base = sanitizeDirectoryPath(cwd);
  if (!base) return { files: [], dropped: openedFiles.length };

  const baseLower = base.toLowerCase();
  const safe = [];
  for (const raw of openedFiles) {
    const rel = String(raw ?? "").trim();
    if (!rel || isDriveOnlyPath(rel)) continue;
    let full;
    try {
      full = resolve(base, rel.replace(/\//g, "\\"));
    } catch {
      continue;
    }
    if (!full.toLowerCase().startsWith(baseLower)) continue;
    try {
      if (existsSync(full) && statSync(full).isFile()) safe.push(rel);
    } catch {
      /* skip unreadable paths */
    }
  }
  return { files: safe, dropped: Math.max(0, openedFiles.length - safe.length) };
}
