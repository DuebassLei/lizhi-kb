import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { getSdkRootDir } from "./path-utils.js";

const sdkCache = new Map();

function getPackageDir(sdkRootDir) {
  return join(sdkRootDir, "node_modules", "@anthropic-ai", "claude-agent-sdk");
}

function resolveEntryFile(packageDir) {
  const pkgJsonPath = join(packageDir, "package.json");
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
      const candidate =
        (typeof pkg.exports === "object" && pkg.exports["."]?.import) ||
        pkg.module ||
        pkg.main;
      if (candidate && typeof candidate === "string") {
        return join(packageDir, candidate);
      }
    } catch {
      /* fall through */
    }
  }
  for (const file of ["sdk.mjs", "index.mjs", "index.js"]) {
    const full = join(packageDir, file);
    if (existsSync(full)) return full;
  }
  return null;
}

export function isClaudeSdkAvailable() {
  const sdkRoot = getSdkRootDir();
  const pkgDir = getPackageDir(sdkRoot);
  return existsSync(pkgDir);
}

export function getSdkStatus() {
  const sdkRoot = getSdkRootDir();
  const pkgDir = getPackageDir(sdkRoot);
  return {
    installed: existsSync(pkgDir),
    path: pkgDir,
    root: sdkRoot,
  };
}

export async function loadClaudeSdk() {
  if (sdkCache.has("claude")) {
    return sdkCache.get("claude");
  }
  const sdkRoot = getSdkRootDir();
  const pkgDir = getPackageDir(sdkRoot);
  if (!existsSync(pkgDir)) {
    throw new Error("SDK_NOT_INSTALLED");
  }
  const entry = resolveEntryFile(pkgDir);
  if (!entry) {
    throw new Error(`无法解析 SDK 入口: ${pkgDir}`);
  }
  const sdk = await import(pathToFileURL(entry).href);
  sdkCache.set("claude", sdk);
  return sdk;
}
