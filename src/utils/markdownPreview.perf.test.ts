import { describe, expect, it } from "vitest";
import { markdownToPreviewHtml } from "./markdownPreview";

function makeDoc(paragraphs: number, withCode = false, withMermaid = false): string {
  const parts: string[] = ["# 性能测试样例\n"];
  for (let i = 0; i < paragraphs; i += 1) {
    parts.push(`## 小节 ${i + 1}\n\n这是第 ${i + 1} 段正文，用于模拟写作时的预览重绘成本。\n`);
    if (withCode && i % 5 === 0) {
      parts.push("```ts\nexport const x = " + i + ";\nconsole.log(x);\n```\n");
    }
    if (withMermaid && i === 0) {
      parts.push("```mermaid\nflowchart LR\n  A-->B\n  B-->C\n```\n");
    }
  }
  return parts.join("\n");
}

describe("markdownToPreviewHtml 耗时基线", () => {
  it("短文应在合理时间内完成（同步解析）", () => {
    const md = makeDoc(20);
    const t0 = performance.now();
    const html = markdownToPreviewHtml(md);
    const ms = performance.now() - t0;
    expect(html.length).toBeGreaterThan(100);
    // CI 机器差异大，只做宽松上限；真正瓶颈看桌面 HUD
    expect(ms).toBeLessThan(200);
    // eslint-disable-next-line no-console
    console.info(`[perf] short(~20段) markdownToPreviewHtml: ${ms.toFixed(1)}ms`);
  });

  it("中长文+代码块", () => {
    const md = makeDoc(80, true);
    const t0 = performance.now();
    const html = markdownToPreviewHtml(md);
    const ms = performance.now() - t0;
    expect(html.length).toBeGreaterThan(500);
    expect(ms).toBeLessThan(800);
    // eslint-disable-next-line no-console
    console.info(`[perf] mid(+code) markdownToPreviewHtml: ${ms.toFixed(1)}ms`);
  });
});
