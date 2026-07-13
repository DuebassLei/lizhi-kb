import type { Page } from "@playwright/test";

/** CodeMirror 6 编辑器：testid 在 `.cm-content` 元素上 */
export function cmEditor(page: Page) {
  return page.getByTestId("markdown-codemirror");
}

/** Skip welcome FTUE if the app redirects there on first visit. */
export async function ensureAppReady(page: Page, targetPath = "/insights") {
  await page.goto(targetPath);

  const continueBtn = page.getByRole("button", { name: "继续" });
  const startBtn = page.getByRole("button", { name: "开始使用" });

  for (let i = 0; i < 3; i += 1) {
    if (page.url().includes("/welcome")) {
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
      } else if (await startBtn.isVisible()) {
        await startBtn.click();
      }
      await page.waitForURL((url) => !url.pathname.includes("/welcome"), {
        timeout: 10_000,
      });
    } else {
      break;
    }
  }

  if (!page.url().includes(targetPath)) {
    await page.goto(targetPath);
  }

  await page.getByTestId("app-shell-sidebar").waitFor({ state: "visible", timeout: 10_000 });
}
