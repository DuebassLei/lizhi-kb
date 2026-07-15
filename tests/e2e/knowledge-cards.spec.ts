import { test, expect } from "@playwright/test";
import { cmEditor, ensureAppReady } from "./helpers";

async function openCardWorkspace(page: import("@playwright/test").Page) {
  await ensureAppReady(page, "/workspace?preview=card");
  await page.getByTestId("new-doc-btn").click();
  await expect(cmEditor(page)).toBeVisible({ timeout: 10_000 });
  const splitBtn = page.getByTestId("toolbar-split-preview");
  if ((await splitBtn.getAttribute("aria-pressed")) !== "true") {
    await splitBtn.click();
  }
  await page.getByTestId("toolbar-preview-kind-card").click();
  await expect(page.getByTestId("knowledge-card-preview-panel")).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("Knowledge cards in workspace", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await openCardWorkspace(page);
  });

  test("shows card preview and format/theme pickers", async ({ page }) => {
    await expect(page.getByTestId("kc-toolbar-menu")).toBeVisible();
    await expect(page.getByTestId("kc-format-picker")).toBeVisible();
    await expect(page.getByTestId("kc-theme-picker")).toBeVisible();
    await expect(page.getByTestId("kc-status")).toBeVisible();

    const editor = cmEditor(page);
    await editor.click();
    await editor.pressSequentially("# 标题\n\n正文内容\n\n---\n\n## 第二页\n\n更多文字\n");

    await expect(page.getByTestId("knowledge-card")).toHaveCount(2, { timeout: 8_000 });
  });

  test("legacy /knowledge-cards redirects to workspace card preview", async ({ page }) => {
    await page.goto("/knowledge-cards");
    await expect(page).toHaveURL(/\/workspace\?preview=card/);
    await page.getByTestId("new-doc-btn").click();
    await expect(cmEditor(page)).toBeVisible({ timeout: 10_000 });
    const splitBtn = page.getByTestId("toolbar-split-preview");
    if ((await splitBtn.getAttribute("aria-pressed")) !== "true") {
      await splitBtn.click();
    }
    await page.getByTestId("toolbar-preview-kind-card").click();
    await expect(page.getByTestId("toolbar-preview-kind-card")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("knowledge-card-preview-panel")).toBeVisible();
  });
});
