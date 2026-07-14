#!/usr/bin/env node
/**
 * 零警告验证门禁
 * SSOT: docs/agent-workflow/verification.md
 *
 * 用法: node scripts/verify-build.mjs
 *       pnpm verify
 *
 * vue-tsc 单独跑；vite + MCP 并行；再 sync → clippy → test。
 */

import { runParallel, runSerial, ROOT, TAURI } from "./run-steps.mjs";

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
  {
    label: "cargo clippy",
    cmd: "cargo",
    args: [
      "clippy",
      "--no-default-features",
      "--features",
      "sqlcipher",
      "--",
      "-D",
      "warnings",
    ],
    cwd: TAURI,
  },
  {
    label: "cargo test",
    cmd: "cargo",
    args: [
      "test",
      "--no-default-features",
      "--features",
      "sqlcipher",
      "--quiet",
    ],
    cwd: TAURI,
  },
]);

console.log("\n✓ pnpm verify 全部通过（零警告编译）");
