#!/usr/bin/env node
/**
 * 将 packages/lizhi-mcp 打包产物同步到 src-tauri/resources/lizhi-mcp，供 Tauri bundle 分发。
 * 前置：packages/lizhi-mcp 已执行 build（产出单文件 dist/index.js）。
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcJs = join(root, "packages", "lizhi-mcp", "dist", "index.js");
const destDir = join(root, "src-tauri", "resources", "lizhi-mcp");
const destJs = join(destDir, "index.js");

if (!existsSync(srcJs)) {
  console.error(`[sync-lizhi-mcp] 未找到打包产物: ${srcJs}`);
  console.error("请先运行: pnpm --dir packages/lizhi-mcp build");
  process.exit(1);
}

if (existsSync(destDir)) {
  rmSync(destDir, { recursive: true, force: true });
}
mkdirSync(destDir, { recursive: true });
cpSync(srcJs, destJs);
writeFileSync(
  join(destDir, "package.json"),
  JSON.stringify({ name: "@lizhi/mcp-bundle", type: "module", private: true }, null, 2) + "\n",
);
console.log(`[sync-lizhi-mcp] ${srcJs} → ${destJs}`);
