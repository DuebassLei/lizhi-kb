import { describe, expect, it } from "vitest";
import { parseLayoutMarkdown } from "./parseLayoutMarkdown";
import { listRegisteredLayoutModules } from "./layoutModuleRenderers";

const THEME = "lizhiClassic" as const;

const IDS = [
  "before-after",
  "pros-cons",
  "number-callout",
  "quote-thread",
  "checklist-done",
  "footnote-box",
  "chapter-nav",
  "key-takeaway",
  "alert-banner",
  "score-card",
  "recipe-meta",
  "image-caption",
  "heatmap",
  "grouped-bar",
  "waterfall",
] as const;

describe("practical layout modules", () => {
  it("registers all practical module ids", () => {
    const mods = listRegisteredLayoutModules();
    for (const id of IDS) expect(mods).toContain(id);
  });

  it("renders before-after and pros-cons", () => {
    const html = parseLayoutMarkdown(
      `:::before-after
旧方案 | 新方案
:::

:::pros-cons
快 | 贵
:::
`,
      THEME,
    );
    expect(html).not.toContain("未知模块");
    expect(html).toContain("旧方案");
    expect(html).toContain("优点");
  });

  it("renders number-callout and score-card", () => {
    const html = parseLayoutMarkdown(
      `:::number-callout
value: 3×
label: 提升
:::

:::score-card
score: 8.6
max: 10
安全 | 9
:::
`,
      THEME,
    );
    expect(html).not.toContain("未知模块");
    expect(html).toContain("3×");
    expect(html).toContain("8.6");
  });

  it("renders heatmap / grouped-bar / waterfall", () => {
    const html = parseLayoutMarkdown(
      `:::heatmap
日 | 一 | 二
上 | 1 | 5
:::

:::grouped-bar
类 | A | B
x | 10 | 20
:::

:::waterfall
start: 10
涨 | 5
跌 | -2
:::
`,
      THEME,
    );
    expect(html).not.toContain("未知模块");
    expect(html).toContain("上");
    expect(html).toContain("终点");
  });

  it("renders checklist-done and key-takeaway", () => {
    const html = parseLayoutMarkdown(
      `:::checklist-done
[x] 完成项
[ ] 待办项
:::

:::key-takeaway
一句话带走
:::
`,
      THEME,
    );
    expect(html).not.toContain("未知模块");
    expect(html).toContain("完成项");
    expect(html).toContain("读完带走");
  });
});
