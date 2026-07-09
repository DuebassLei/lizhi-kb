import { test, expect } from "@playwright/test";
import { ensureAppReady } from "./helpers";

test.describe("Preview theme settings", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAppReady(page, "/settings");
  });

  test("shows preview theme options in settings", async ({ page }) => {
    const section = page.getByTestId("preview-theme-settings");
    await expect(section).toBeVisible();
    await expect(section.getByText("预览主题")).toBeVisible();
    await expect(page.getByTestId("preview-theme-classic")).toBeVisible();
    await expect(page.getByTestId("preview-theme-document")).toBeVisible();
    await expect(page.getByTestId("preview-theme-compact")).toBeVisible();
    await expect(page.getByTestId("preview-theme-mono")).toBeVisible();
  });

  test("persists preview theme selection after reload", async ({ page }) => {
    await page.getByTestId("preview-theme-document").click();
    await page.reload();
    await ensureAppReady(page, "/settings");

    const documentCard = page.getByTestId("preview-theme-document");
    await expect(documentCard).toHaveClass(/border-link/);
  });
});
