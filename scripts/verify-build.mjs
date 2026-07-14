#!/usr/bin/env node
/**
 * 零警告验证门禁
 * SSOT: docs/agent-workflow/verification.md
 *
 * 用法: node scripts/verify-build.mjs
 *       pnpm verify
 *
 * 子进程必须 inherit stdio：pipe + process.exit 会在大段 cargo 输出未刷盘时截断 CI 日志。
 */

import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TAURI = join(ROOT, "src-tauri");
const shell = process.platform === "win32";

function run(label, cmd, args, { cwd = ROOT } = {}) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(cmd, args, {
    cwd,
    shell,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error(`\n✗ ${label} 失败: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\n✗ ${label} 失败 (exit ${result.status ?? 1})`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${label}`);
}

run("vue-tsc", "pnpm", ["exec", "vue-tsc", "--noEmit"]);
run("vite build", "pnpm", ["exec", "vite", "build"]);
run("lizhi-mcp build", "pnpm", ["run", "build:mcp"]);
run("cargo clippy", "cargo", [
  "clippy",
  "--no-default-features",
  "--features",
  "sqlcipher",
  "--",
  "-D",
  "warnings",
], { cwd: TAURI });
run("cargo test", "cargo", [
  "test",
  "--no-default-features",
  "--features",
  "sqlcipher",
  "--quiet",
], { cwd: TAURI });

console.log("\n✓ pnpm verify 全部通过（零警告编译）");
