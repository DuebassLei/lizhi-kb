import { test, expect } from "@playwright/test";
import { cmEditor, ensureAppReady } from "./helpers";

/** 公众号排版已并入工作区；/wechat-studio 重定向至 /workspace?preview=wechat */
async function openWechatWorkspace(page: import("@playwright/test").Page) {
  await ensureAppReady(page, "/workspace?preview=wechat");
  await page.getByTestId("new-doc-btn").click();
  await expect(cmEditor(page)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("toolbar-preview-kind-wechat")).toBeVisible();
}

test.describe("WeChat preview in workspace", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await openWechatWorkspace(page);
  });

  test("shows theme selector with full migrated themes", async ({ page }) => {
    await page.getByTestId("toolbar-preview-kind-wechat").click();
    await page.getByTestId("wechat-toolbar-menu-trigger").click();
    const themeSelect = page.getByTestId("workspace-wechat-theme-select");
    await expect(themeSelect).toBeVisible();
    await themeSelect.click();
    await expect(page.getByTestId("wechat-theme-select-panel")).toBeVisible();
    const options = page.getByTestId("wechat-theme-select-panel").getByRole("option");
    // md-wechat-editor 完整主题：经典 + 草案 + 创意 + 公众号风格 + 专业
    await expect(options).toHaveCount(71);
    await expect(options.filter({ hasText: "默认主题" })).toHaveCount(1);
    await expect(options.filter({ hasText: "朱砂印谱" })).toHaveCount(1);
    await expect(options.filter({ hasText: "宣纸水墨" })).toHaveCount(1);
    await expect(options.filter({ hasText: "科技 · 极客理性" })).toHaveCount(1);
    await expect(options.filter({ hasText: "极简白" })).toHaveCount(1);
  });

  test("renders layout module in preview", async ({ page }) => {
    const editor = cmEditor(page);
    await editor.click();
    await editor.pressSequentially(`:::tip[提示]\n这是一条提示\n:::\n`);

    await expect(page.getByTestId("wechat-preview-content")).toContainText("提示", {
      timeout: 5_000,
    });
  });

  test("renders info callout module in preview", async ({ page }) => {
    const editor = cmEditor(page);
    await editor.click();
    await editor.pressSequentially(`:::info[信息]\n补充说明\n:::\n`);

    await expect(page.getByTestId("wechat-preview-content")).toContainText("信息", {
      timeout: 5_000,
    });
  });

  test("legacy /wechat-studio redirects to workspace wechat preview", async ({ page }) => {
    await page.goto("/wechat-studio");
    await expect(page).toHaveURL(/\/workspace\?preview=wechat/);
    await page.getByTestId("new-doc-btn").click();
    await expect(cmEditor(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("toolbar-preview-kind-wechat")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
