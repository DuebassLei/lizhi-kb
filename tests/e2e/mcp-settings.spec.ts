import { test, expect } from "@playwright/test";
import { ensureAppReady } from "./helpers";

test.describe("MCP settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await ensureAppReady(page, "/settings");
  });

  test("shows MCP settings section on settings page", async ({ page }) => {
    await page.getByTestId("settings-anchor-settings-mcp").click();
    await expect(page.getByTestId("mcp-settings-panel")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "AI 集成 / MCP" })).toBeVisible();
    await expect(page.getByTestId("mcp-enabled-toggle")).toBeVisible({ timeout: 10_000 });
  });
});
