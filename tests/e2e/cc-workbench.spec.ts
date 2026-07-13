import { test, expect } from "@playwright/test";
import { ensureAppReady } from "./helpers";

test.describe("CC Workbench smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await ensureAppReady(page, "/cc-workbench");
  });

  test("loads /cc-workbench route", async ({ page }) => {
    await expect(page).toHaveURL(/\/cc-workbench/);
    await expect(page.getByTestId("cc-workbench-view")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("cc-workbench-shell")).toBeVisible();
    await expect(page.getByTestId("cc-chat-welcome")).toBeVisible();
    await expect(page.getByTestId("cc-chat-input")).toBeVisible();
  });

  test("shows cwd mode selector with vault label", async ({ page }) => {
    const badge = page.getByTestId("cc-cwd-mode-badge");
    await expect(badge).toBeVisible({ timeout: 10_000 });
    await expect(badge).toContainText("知识库");
    // 浏览器预览模式下工作台未就绪，选择器为 disabled；仅验证 UI 可见
    await expect(badge).toBeDisabled();
  });

  test("opens settings drawer and navigates to cwd tab", async ({ page }) => {
    await page.locator('button[title="工作台设置"]').click();
    await expect(page.getByTestId("cc-workbench-drawer")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("cc-workbench-settings-shell")).toBeVisible();

    await page.getByRole("button", { name: "工作目录" }).click();
    await expect(page.getByRole("heading", { name: "工作目录" })).toBeVisible();
    await expect(page.getByRole("button", { name: "知识库（MCP）" })).toBeVisible();
    await expect(page.getByRole("button", { name: "本地项目" })).toBeVisible();
  });
});
