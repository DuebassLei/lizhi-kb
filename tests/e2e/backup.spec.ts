import { test, expect } from "@playwright/test";
import { ensureAppReady } from "./helpers";

test.describe("Backup and restore settings", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAppReady(page, "/settings");
  });

  test("shows backup restore panel in settings", async ({ page }) => {
    await expect(page.getByTestId("backup-restore-panel")).toBeVisible();
    await expect(page.getByTestId("export-backup-btn")).toHaveText("导出备份");
    await expect(page.getByTestId("import-backup-btn")).toHaveText("从备份恢复");
    await expect(page.getByTestId("export-all-md-btn")).toHaveText("导出全部为 Markdown");
    await expect(page.getByTestId("export-md-folder-btn")).toHaveText("按文件夹导出 Markdown");
  });
});
