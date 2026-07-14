import { test, expect } from "@playwright/test";
import { ensureAppReady } from "./helpers";

test.describe("Folder tree", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await ensureAppReady(page, "/workspace");
  });

  test("shows inbox and knowledge base folders", async ({ page }) => {
    await expect(page.getByTestId("folder-tree")).toBeVisible();
    await expect(page.getByTestId("folder-row").filter({ hasText: "收件箱" })).toBeVisible();
    await expect(page.getByTestId("folder-row").filter({ hasText: "知识库" })).toBeVisible();
  });

  test("creates document in selected folder", async ({ page }) => {
    await page.getByTestId("folder-row").filter({ hasText: "知识库" }).click();
    await page.getByTestId("new-doc-btn").click();
    await expect(page.locator(".sidebar-create-hint")).toContainText("知识库");
    await expect(page.getByTestId("folder-doc-item").first()).toBeVisible({ timeout: 5000 });
  });

  test("adds nested subfolders", async ({ page }) => {
    await page.getByTestId("folder-row").filter({ hasText: "知识库" }).click();
    await page.getByTestId("add-subfolder-btn").click();
    await page.getByTestId("subfolder-form").locator("input").fill("写作计划");
    await page.getByTestId("subfolder-form").getByRole("button", { name: "添加" }).click();
    await expect(page.getByTestId("folder-row").filter({ hasText: "写作计划" })).toBeVisible();

    await page.getByTestId("folder-row").filter({ hasText: "写作计划" }).click();
    await page.getByTestId("add-subfolder-btn").click();
    await page.getByTestId("subfolder-form").locator("input").fill("第一章");
    await page.getByTestId("subfolder-form").getByRole("button", { name: "添加" }).click();
    await expect(page.getByTestId("folder-row").filter({ hasText: "第一章" })).toBeVisible();
  });

  test("moves document via command palette", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    await expect(page.getByTestId("folder-doc-item").first()).toBeVisible({ timeout: 5000 });

    await page.keyboard.press("Control+k");
    await page.getByTestId("command-palette").locator("input").fill("移动");
    await page.getByTestId("command-palette").getByText("移动到…").click();

    const moveDialog = page.getByTestId("move-to-folder-dialog");
    await expect(moveDialog).toBeVisible();
    await moveDialog.getByLabel("搜索目录").fill("知识库");
    await moveDialog.getByRole("button").filter({ hasText: "知识库" }).first().click();

    await page.getByTestId("folder-row").filter({ hasText: "知识库" }).locator("..").click();
    await expect(page.getByTestId("folder-row").filter({ hasText: "知识库" })).toBeVisible();
    await page.getByTestId("folder-row").filter({ hasText: "知识库" }).click();
    await expect(page.locator("[data-folder-id='projects'] [data-testid='folder-doc-item']")).toBeVisible({
      timeout: 5000,
    });
  });

  test("breadcrumb reveals folder in sidebar", async ({ page }) => {
    await page.getByTestId("folder-row").filter({ hasText: "知识库" }).click();
    await page.getByTestId("add-subfolder-btn").click();
    await page.getByTestId("subfolder-form").locator("input").fill("面包屑测试");
    await page.getByTestId("subfolder-form").getByRole("button", { name: "添加" }).click();
    await page.getByTestId("new-doc-btn").click();
    await expect(page.getByTestId("doc-breadcrumb")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("doc-breadcrumb").getByRole("button", { name: "知识库" }).click();
    await expect(page.getByTestId("folder-row").filter({ hasText: "知识库" })).toHaveClass(/tree-row-selected/);
  });

  test("imports markdown file via drag and drop into inbox", async ({ page }) => {
    await page.getByTestId("folder-row").filter({ hasText: "收件箱" }).click();
    const inboxZone = page.locator("[data-folder-id='inbox'] [data-testid='folder-empty-drop-zone']");
    await expect(inboxZone).toBeVisible();

    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.items.add(
        new File(["# 导入测试\n\n正文内容"], "import-test.md", { type: "text/markdown" }),
      );
      return dt;
    });

    await inboxZone.dispatchEvent("dragover", { dataTransfer });
    await inboxZone.dispatchEvent("drop", { dataTransfer });

    await expect(page.getByTestId("app-toast")).toContainText("已导入", { timeout: 5_000 });
    await expect(
      page.locator("[data-folder-id='inbox'] [data-testid='folder-doc-item']").filter({ hasText: "导入测试" }),
    ).toBeVisible({ timeout: 5_000 });
  });
});
