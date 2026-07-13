import { test, expect } from "@playwright/test";
import { cmEditor, ensureAppReady } from "./helpers";

test.describe("Full-text search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await ensureAppReady(page, "/workspace");
  });

  test("finds document by body text via command palette and opens it", async ({ page }) => {
    const uniqueToken = `狸知检索${Date.now()}`;

    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await editor.click();
    await editor.press("Control+a");
    await editor.pressSequentially(`# 检索标题\n\n正文包含 ${uniqueToken} 关键词`);

    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("command-palette")).toBeVisible();

    const searchInput = page.getByTestId("command-palette").locator('input[type="search"]');
    await searchInput.fill(uniqueToken);

    const result = page.getByTestId("search-result").first();
    await expect(result).toBeVisible({ timeout: 5_000 });
    await expect(result).toContainText("检索标题");
    await result.click();

    await expect(cmEditor(page)).toContainText(uniqueToken, { timeout: 5_000 });
  });

  test("sidebar full-text search shows snippet and opens document", async ({ page }) => {
    const uniqueToken = `侧栏检索${Date.now()}`;

    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await editor.click();
    await editor.press("Control+a");
    await editor.pressSequentially(`侧栏搜索正文 ${uniqueToken}`);

    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5_000 });

    await page.getByTestId("sidebar-filter").fill(uniqueToken);

    const result = page.getByTestId("sidebar-search-result").first();
    await expect(result).toBeVisible({ timeout: 5_000 });
    await expect(result).toContainText(uniqueToken);
    await result.click();

    await expect(cmEditor(page)).toContainText(uniqueToken);
  });
});
