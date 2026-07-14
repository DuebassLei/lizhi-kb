#!/usr/bin/env node
/**
 * 并行 / 串行跑子进程，供 verify / build 复用。
 */
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const TAURI = join(ROOT, "src-tauri");
const shell = process.platform === "win32";

/**
 * @param {{ label: string, cmd: string, args?: string[], cwd?: string }} step
 * @returns {Promise<{ label: string, status: number, out: string }>}
 */
export function runStep({ label, cmd, args = [], cwd = ROOT }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      shell,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout?.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      out += chunk;
    });
    child.on("error", (err) => {
      out += `${err.message}\n`;
      resolve({ label, status: 1, out });
    });
    child.on("close", (code) => {
      resolve({ label, status: code ?? 1, out });
    });
  });
}

function printResult(result) {
  const body = result.out.trim();
  if (body) process.stdout.write(body.endsWith("\n") ? body : `${body}\n`);
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
    printResult(result);
  }
  const failed = results.find((r) => r.status !== 0);
  if (failed) process.exit(failed.status);
}

/** 串行执行；任一步失败则 exit */
export async function runSerial(steps) {
  for (const step of steps) {
    console.log(`\n▶ ${step.label}`);
    const result = await runStep(step);
    printResult(result);
    if (result.status !== 0) process.exit(result.status);
  }
}
