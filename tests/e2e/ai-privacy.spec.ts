import { test, expect } from "@playwright/test";
import { cmEditor, ensureAppReady } from "./helpers";

test.describe("AI privacy guard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await ensureAppReady(page, "/workspace");
  });

  test("toolbar inserts ai-private fence and scan banner offers wrap", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await expect(editor).toBeVisible();

    await page.getByTestId("editor-toolbar-ai-private").click();
    await expect(editor).toContainText(":::ai-private", { timeout: 5_000 });

    await editor.click();
    await editor.press("Control+End");
    await editor.pressSequentially("\n密码: e2eSecret99\n");

    await expect(page.getByTestId("ai-privacy-scan-banner")).toBeVisible({ timeout: 8_000 });
    await page.getByTestId("ai-privacy-scan-wrap").click();
    await expect(page.getByTestId("ai-privacy-scan-banner")).toBeHidden({ timeout: 5_000 });
    await expect(editor).toContainText(":::ai-private");
    await expect(editor).toContainText("e2eSecret99");
  });

  test("toolbar toggle marks document ai-exclude", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    await expect(page.getByTestId("toggle-ai-exclude-toolbar")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("toggle-ai-exclude-toolbar").click();
    await expect(page.getByTestId("toggle-ai-exclude-toolbar")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
