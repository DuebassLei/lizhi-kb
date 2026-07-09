/**
 * Playwright 浏览器安装（可选）
 *
 * 本地开发默认使用系统 Edge/Chrome（见 playwright.config.ts channel），
 * 一般不需要运行本脚本。
 *
 * 若 CI 或必须使用内置 Chromium，可尝试国内镜像：
 *   pnpm playwright:install
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

if (existsSync(EDGE) || existsSync(CHROME)) {
  console.log("[playwright] 检测到系统浏览器，E2E 可直接运行：pnpm test:e2e");
  console.log("[playwright] 无需下载内置 Chromium（playwright.config 使用 channel: msedge）");
  process.exit(0);
}

const MIRROR = "https://cdn.npmmirror.com/binaries/playwright";
const browser = process.argv[2] ?? "chromium";

process.env.PLAYWRIGHT_DOWNLOAD_HOST = MIRROR;
delete process.env.PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST;

console.log(`[playwright] 未检测到系统浏览器，尝试镜像下载: ${MIRROR}`);
console.log(`[playwright] 安装: ${browser}`);

const result = spawnSync("pnpm", ["exec", "playwright", "install", browser], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
