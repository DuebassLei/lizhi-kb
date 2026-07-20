import { test, expect } from "@playwright/test";
import { ensureAppReady } from "./helpers";

test.describe("Document trash", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await ensureAppReady(page, "/workspace");
  });

  test("soft-deletes to trash and restores", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    await expect(page.getByTestId("doc-title")).toBeVisible();

    const title = (await page.getByTestId("doc-title").innerText()).trim() || "无标题";
    const tree = page.getByTestId("doc-tree");
    const docItem = tree.getByTestId("folder-doc-item").filter({ hasText: title }).first();
    await expect(docItem).toBeVisible();

    await docItem.click({ button: "right" });
    const menu = page.getByTestId("context-menu");
    await expect(menu).toBeVisible();
    await menu.getByText("移至回收站", { exact: true }).click();

    const softDialog = page.getByTestId("delete-document-dialog");
    await expect(softDialog).toBeVisible();
    await expect(softDialog).toContainText("移至回收站");
    await expect(softDialog).not.toContainText("无法恢复");
    await softDialog.getByTestId("confirm-dialog-confirm").click();

    await expect(tree.getByText(title)).toHaveCount(0);

    await page.getByTestId("sidebar-trash-toggle").click();
    await expect(page.getByTestId("trash-panel")).toBeVisible();
    await expect(page.getByTestId("trash-list")).toContainText(title);

    await page.getByTestId("trash-restore-btn").first().click();
    await expect(page.getByTestId("trash-empty")).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "编辑", exact: true }).click();
    await expect(page.getByTestId("doc-tree").getByText(title)).toBeVisible({ timeout: 5_000 });
  });
});
