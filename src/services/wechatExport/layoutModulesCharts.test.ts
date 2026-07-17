import { describe, expect, it } from "vitest";
import { parseLayoutMarkdown } from "./parseLayoutMarkdown";
import { listRegisteredLayoutModules } from "./layoutModuleRenderers";

const THEME = "lizhiClassic" as const;

describe("CSS chart modules", () => {
  it("registers all chart module ids", () => {
    const mods = listRegisteredLayoutModules();
    for (const id of [
      "bar-chart",
      "column-chart",
      "progress",
      "donut",
      "line-chart",
      "radar-chart",
      "stack-bar",
    ]) {
      expect(mods).toContain(id);
    }
  });

  it("renders bar-chart without 未知模块", () => {
    const html = parseLayoutMarkdown(
      `:::bar-chart[阅读来源]
搜索 | 42
朋友圈 | 28
:::
`,
      THEME,
    );
    expect(html).not.toContain("未知模块");
    expect(html).toContain("阅读来源");
    expect(html).toContain("搜索");
    expect(html).toContain("42");
  });

  it("renders donut with legend percentages", () => {
    const html = parseLayoutMarkdown(
      `:::donut[构成]
A | 50
B | 50
:::
`,
      THEME,
    );
    expect(html).not.toContain("未知模块");
    expect(html).toContain("conic-gradient");
    expect(html).toContain("50.0%");
  });

  it("renders stack-bar segments", () => {
    const html = parseLayoutMarkdown(
      `:::stack-bar[流量]
搜索 | 40
社交 | 60
:::
`,
      THEME,
    );
    expect(html).not.toContain("未知模块");
    expect(html).toContain("搜索");
    expect(html).toContain("60.0%");
  });

  it("renders multi-series radar-chart", () => {
    const html = parseLayoutMarkdown(
      `:::radar-chart[能力对比]
维度 | 狸知 | 竞品
安全 | 95 | 70
双链 | 90 | 60
:::
`,
      THEME,
    );
    expect(html).not.toContain("未知模块");
    expect(html).toContain("能力对比");
    expect(html).toContain("狸知");
    expect(html).toContain("竞品");
    expect(html).toContain("clip-path");
  });
});
