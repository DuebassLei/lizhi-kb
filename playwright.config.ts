import { defineConfig, devices } from "@playwright/test";

/** 优先系统 Edge，无需 playwright install 下载 Chromium */
const channel = (process.env.PLAYWRIGHT_CHANNEL as "chrome" | "msedge" | undefined) ?? "msedge";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: channel,
      use: {
        ...devices["Desktop Edge"],
        channel,
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
