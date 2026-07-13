import { test, expect } from "@playwright/test";
import { cmEditor, ensureAppReady } from "./helpers";

test.describe("Workspace editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await ensureAppReady(page, "/workspace");
  });

  test("creates a document via sidebar, edits content, and persists after reload", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/workspace/);
    await expect(page.getByRole("link", { name: "个人知识库", exact: true })).toBeVisible();

    await page.getByTestId("new-doc-btn").click();

    const editor = cmEditor(page);
    await expect(editor).toBeVisible();

    const content = `E2E 测试内容 ${Date.now()}`;
    await editor.click();
    await editor.press("Control+a");
    await editor.pressSequentially(content);

    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await ensureAppReady(page, "/workspace");

    await expect(cmEditor(page)).toContainText(content, { timeout: 5_000 });
  });

  test("wiki link navigation opens linked document", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await editor.click();
    await editor.pressSequentially("[[目标文档]]");

    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5_000 });

    await editor.getByText("[[目标文档]]").click();
    await expect(page.getByTestId("doc-title")).toContainText("目标文档", { timeout: 5_000 });
  });

  test("pins document and shows in pinned section", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    await expect(page.getByTestId("toggle-pin-toolbar")).toBeVisible();
    await page.getByTestId("toggle-pin-toolbar").click();

    await expect(page.getByTestId("pinned-docs")).toBeVisible();
    await expect(page.getByTestId("pinned-docs")).toContainText("无标题");
  });

  test("graph view has zoom controls", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    await page.getByRole("button", { name: "图谱", exact: true }).click();
    await expect(page.getByTestId("graph-zoom-controls")).toBeVisible();
  });

  test("renaming title does not corrupt body content", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await editor.click();
    await editor.press("Control+a");
    await editor.pressSequentially("正文内容不应被修改");

    await expect(page.getByText("未保存")).toBeVisible();
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5_000 });

    await page.getByTestId("doc-title").click();
    const titleInput = page.getByTestId("title-input");
    await titleInput.fill("新标题");
    await titleInput.press("Enter");

    await expect(page.getByTestId("doc-title")).toContainText("新标题");
    await expect(editor).toContainText("正文内容不应被修改");
    await expect(editor).not.toContainText("# 新标题");
  });

  test("markdown heading and code block persist after reload", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await expect(editor).toBeVisible();

    await editor.click();
    await editor.press("Control+a");
    await editor.press("Backspace");
    await editor.pressSequentially("# 持久化标题\n\n```\nconst x = 1;\n```");

    await expect(editor).toContainText("# 持久化标题");
    await expect(editor).toContainText("const x = 1;");

    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await ensureAppReady(page, "/workspace");

    await expect(cmEditor(page)).toContainText("# 持久化标题", { timeout: 5_000 });
    await expect(cmEditor(page)).toContainText("const x = 1;");
  });

  test("paste plain markdown keeps raw syntax in editor", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://localhost:1420",
    });
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await editor.click();
    await editor.press("Control+a");
    await editor.press("Backspace");

    const markdown = `# 测试标题1\n\n普通段落\n\n\`\`\`sql\nSELECT 1;\n\`\`\``;
    await page.evaluate(async (md) => {
      await navigator.clipboard.writeText(md);
    }, markdown);

    await editor.press("Control+v");

    await expect(editor).toContainText("# 测试标题1");
    await expect(editor).toContainText("普通段落");
    await expect(editor).toContainText("SELECT 1;");
    await expect(editor).toContainText("```");
  });

  test("inserted image persists after reload with asset reference", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await expect(editor).toBeVisible();

    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    await page.locator('input[type="file"][accept*="image"]').setInputFiles({
      name: "e2e-test.png",
      mimeType: "image/png",
      buffer: pngBuffer,
    });

    await expect(editor).toContainText("![", { timeout: 5_000 });
    await expect(editor).toContainText("asset://");

    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await ensureAppReady(page, "/workspace");

    await expect(cmEditor(page)).toContainText("asset://", { timeout: 5_000 });
  });

  test("Alt+Left navigates back after wiki link jump", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await editor.click();
    await editor.pressSequentially("[[返回测试]]");
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5_000 });
    await editor.getByText("[[返回测试]]").click();
    await expect(page.getByTestId("doc-title")).toContainText("返回测试");

    await page.keyboard.press("Alt+ArrowLeft");
    await expect(page.getByTestId("doc-title")).toContainText("无标题", { timeout: 3_000 });
  });

  test("split preview toggle shows GFM preview panel", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await editor.click();
    await editor.press("Control+a");
    await page.getByRole("button", { name: "标题 1" }).click();
    await editor.pressSequentially("分栏标题");
    await editor.press("Enter");
    await editor.pressSequentially("预览段落");

    await expect(page.getByTestId("split-preview-pane")).not.toBeVisible();

    await page.getByTestId("toolbar-split-preview").click();
    await expect(page.getByTestId("split-preview-pane")).toBeVisible();

    const preview = page.getByTestId("markdown-preview");
    await expect(preview).toBeVisible();
    await expect(preview.locator("h1")).toContainText("分栏标题");
    await expect(preview.locator("p")).toContainText("预览段落");

    await page.getByTestId("toolbar-split-preview").click();
    await expect(page.getByTestId("split-preview-pane")).not.toBeVisible();
  });

  test("split preview preference persists after reload", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    await page.getByTestId("toolbar-split-preview").click();
    await expect(page.getByTestId("split-preview-pane")).toBeVisible();

    await page.reload();
    await ensureAppReady(page, "/workspace");
    await expect(page.getByTestId("split-preview-pane")).toBeVisible();
  });

  test("split preview switches to wechat kind with theme and copy", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await editor.click();
    await editor.press("Control+a");
    await page.getByRole("button", { name: "标题 1" }).click();
    await editor.pressSequentially("公众号标题");
    await editor.press("Enter");
    await editor.pressSequentially("公众号正文");

    await page.getByTestId("toolbar-split-preview").click();
    await expect(page.getByTestId("split-preview-pane")).toBeVisible();
    await expect(page.getByTestId("markdown-preview")).toBeVisible();

    await page.getByTestId("toolbar-preview-kind-wechat").click();
    await expect(page.getByTestId("wechat-preview-panel")).toBeVisible();
    await page.getByTestId("wechat-toolbar-menu-trigger").click();
    await expect(page.getByTestId("workspace-wechat-theme-select")).toBeVisible();
    await expect(page.getByTestId("workspace-wechat-copy")).toBeVisible();
    await expect(page.getByTestId("markdown-preview")).not.toBeVisible();

    const wechatPreview = page.getByTestId("wechat-preview-content");
    await expect(wechatPreview.locator("h1")).toContainText("公众号标题", { timeout: 5_000 });
  });

  test("split preview kind preference persists after reload", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    await page.getByTestId("toolbar-split-preview").click();
    await page.getByTestId("toolbar-preview-kind-wechat").click();
    await expect(page.getByTestId("wechat-preview-panel")).toBeVisible();

    await page.reload();
    await ensureAppReady(page, "/workspace");
    await expect(page.getByTestId("wechat-preview-panel")).toBeVisible();
  });

  test("autosave failure shows banner and retry succeeds", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await editor.click();
    await editor.pressSequentially("触发保存失败");

    await page.evaluate(() => localStorage.setItem("lizhi-kb-e2e-save-fail", "1"));
    await editor.pressSequentially("！");

    await expect(page.getByTestId("autosave-error-banner")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("app-toast")).toContainText("保存失败");

    await page.evaluate(() => localStorage.removeItem("lizhi-kb-e2e-save-fail"));
    await page.getByTestId("autosave-retry").click();
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("autosave-error-banner")).not.toBeVisible();
  });

  test("frontmatter is edited in markdown editor, not a separate panel", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    const editor = cmEditor(page);
    await expect(editor).toBeVisible();
    await expect(page.getByTestId("frontmatter-panel")).not.toBeVisible();
    await expect(page.getByTestId("doc-tags-row")).not.toBeVisible();

    await editor.click();
    await editor.press("Control+Home");
    await editor.pressSequentially("---\ndate: 2026-07-13\ntags:\n  - e2e\n---\n");

    await expect(editor).toContainText("---");
    await expect(editor).toContainText("date: 2026-07-13");
  });

  test("split graph toggle shows graph panel beside editor", async ({ page }) => {
    await page.getByTestId("new-doc-btn").click();
    await page.getByTestId("toolbar-split-graph").click();
    await expect(page.getByTestId("split-graph-panel")).toBeVisible();
  });
});
