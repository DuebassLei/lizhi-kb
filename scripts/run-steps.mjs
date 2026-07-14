#!/usr/bin/env node
/**
 * 并行 / 串行跑子进程，供 verify / build 复用。
 *
 * 使用 stdio: inherit，避免 pipe 缓冲 + 进程退出时日志未刷盘，
 * 导致 CI 只看到 exit 101 却看不到 clippy 正文。
 */
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const TAURI = join(ROOT, "src-tauri");
const shell = process.platform === "win32";

/**
 * @param {{ label: string, cmd: string, args?: string[], cwd?: string }} step
 * @returns {Promise<{ label: string, status: number }>}
 */
export function runStep({ label, cmd, args = [], cwd = ROOT }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      shell,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", (err) => {
      console.error(err.message);
      resolve({ label, status: 1 });
    });
    child.on("close", (code) => {
      resolve({ label, status: code ?? 1 });
    });
  });
}

function printStatus(result) {
  if (result.status === 0) {
    console.log(`✓ ${result.label}`);
  } else {
    console.error(`\n✗ ${result.label} 失败 (exit ${result.status})`);
  }
}

/** 并行执行；全部成功才 resolve，否则 process.exit(1) */
export async function runParallel(steps) {
  const labels = steps.map((s) => s.label).join(" + ");
  console.log(`\n▶ 并行：${labels}`);
  const results = await Promise.all(steps.map((step) => runStep(step)));
  for (const result of results) {
    printStatus(result);
  }
  const failed = results.find((r) => r.status !== 0);
  if (failed) process.exit(failed.status);
}

/** 串行执行；任一步失败则 exit */
export async function runSerial(steps) {
  for (const step of steps) {
    console.log(`\n▶ ${step.label}`);
    const result = await runStep(step);
    printStatus(result);
    if (result.status !== 0) process.exit(result.status);
  }
}
