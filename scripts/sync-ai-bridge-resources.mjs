#!/usr/bin/env node
/**
 * 将 packages/ai-bridge 同步到 src-tauri/resources/ai-bridge，供 Tauri bundle 分发。
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "packages", "ai-bridge");
const dest = join(root, "src-tauri", "resources", "ai-bridge");

if (!existsSync(src)) {
  console.error(`[sync-ai-bridge] 源目录不存在: ${src}`);
  process.exit(1);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}
mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[sync-ai-bridge] ${src} → ${dest}`);
