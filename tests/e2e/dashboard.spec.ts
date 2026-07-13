import { test, expect } from "@playwright/test";
import { ensureAppReady } from "./helpers";

test.describe("Insights dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAppReady(page, "/insights");
  });

  test("shows full-page dashboard as home", async ({ page }) => {
    await expect(page).toHaveURL(/\/insights/);
    await expect(page.getByTestId("dashboard-home")).toBeVisible();
    await expect(page.getByRole("heading", { name: "写作看板" })).toBeVisible();
    await expect(page.getByRole("link", { name: "去写作" })).toBeVisible();

    await expect(page.getByTestId("overview-cards")).toBeVisible();
    await expect(page.getByTestId("overview-cards").getByText("文档数")).toBeVisible();
    await expect(page.getByTestId("heatmap")).toBeVisible();
    await expect(page.getByTestId("writing-rhythm")).toBeVisible();
    await expect(page.getByTestId("network-highlights").getByText("双链总数")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "编辑活动" }).locator("..").getByText("暂无编辑记录"),
    ).toBeVisible();
  });

  test("root path redirects to dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/insights/);
    await expect(page.getByRole("heading", { name: "写作看板" })).toBeVisible();
  });
});
