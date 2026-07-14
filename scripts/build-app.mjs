#!/usr/bin/env node
/**
 * 日常 / Tauri beforeBuild：
 * 1) vue-tsc（单独跑，避免与 Vite 争抢磁盘/CPU）
 * 2) vite build + MCP 并行
 * 3) sync lizhi-mcp resources
 */

import { runParallel, runSerial, ROOT } from "./run-steps.mjs";

await runSerial([
  { label: "vue-tsc", cmd: "pnpm", args: ["exec", "vue-tsc", "--noEmit"] },
]);

await runParallel([
  { label: "vite build", cmd: "pnpm", args: ["exec", "vite", "build"] },
  { label: "lizhi-mcp build", cmd: "pnpm", args: ["run", "build:mcp"] },
]);

await runSerial([
  {
    label: "sync lizhi-mcp resources",
    cmd: "node",
    args: ["scripts/sync-lizhi-mcp-resources.mjs"],
    cwd: ROOT,
  },
]);

console.log("\n✓ pnpm build 完成");
