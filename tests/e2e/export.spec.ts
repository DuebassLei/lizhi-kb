import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { cmEditor, ensureAppReady } from "./helpers";

test.describe("Document export", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await ensureAppReady(page, "/workspace");
  });

  test("export menu includes Word format without watermark hint", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    await page.getByTestId("export-menu-trigger").click();

    const wordItem = page.getByTestId("export-format-docx");
    await expect(wordItem).toBeVisible();
    await expect(wordItem).toContainText("Word");
    await expect(wordItem).toContainText("无水印");
  });

  test("exports Word docx with embedded vault image", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    await page.locator('input[type="file"][accept*="image"]').setInputFiles({
      name: "e2e-export.png",
      mimeType: "image/png",
      buffer: pngBuffer,
    });

    await expect(editor).toContainText("asset://", { timeout: 5_000 });
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5_000 });

    await page.getByTestId("export-menu-trigger").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-format-docx").click();
    await page.getByTestId("export-confirm-action").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.docx$/i);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    const bytes = fs.readFileSync(filePath!);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes.length).toBeGreaterThan(4_000);
  });
});
