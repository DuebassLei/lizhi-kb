import { describe, expect, it } from "vitest";
import { parseLayoutMarkdown, collectPTitleLevel1 } from "./parseLayoutMarkdown";
import { listRegisteredLayoutModules } from "./layoutModuleRenderers";

const THEME = "lizhiClassic" as const;

describe("layout modules migration", () => {
  it("registers hero / cards / reading-path / p-title", () => {
    const mods = listRegisteredLayoutModules();
    for (const id of ["hero", "cards", "reading-path", "p-title", "badges", "breaking", "case-flow"]) {
      expect(mods).toContain(id);
    }
  });

  it("renders hero without 未知模块", () => {
    const md = `:::hero
eyebrow: TOOL · 知识库
title: 狸知知识库
subtitle: 本地优先
chips: 狸知|Tauri
:::
`;
    const html = parseLayoutMarkdown(md, THEME);
    expect(html).not.toContain("未知模块");
    expect(html).toContain("狸知知识库");
    expect(html).toContain("TOOL");
  });

  it("renders cards", () => {
    const md = `:::cards
双链成网 | Wiki + 图谱 | 补全与反向链接
本地加密 | 端到端 | 密钥不出本地
:::
`;
    const html = parseLayoutMarkdown(md, THEME);
    expect(html).not.toContain("未知模块");
    expect(html).toContain("双链成网");
    expect(html).toContain("Wiki + 图谱");
  });

  it("collects p-title and builds reading-path", () => {
    const md = `:::reading-path
:::

:::p-title
num: 01
title: 开篇
level: 1
:::

:::p-title
num: 02
title: 核心能力
level: 1
:::
`;
    const lines = md.split("\n");
    const titles = collectPTitleLevel1(lines);
    expect(titles).toHaveLength(2);
    expect(titles[0].title).toBe("开篇");

    const html = parseLayoutMarkdown(md, THEME);
    expect(html).not.toContain("未知模块");
    expect(html).toContain("阅读路线");
    expect(html).toContain("开篇");
    expect(html).toContain("核心能力");
  });

  it("parses badges open attrs", () => {
    const md = `:::badges tone="accent"
Vue|TypeScript
:::
`;
    const html = parseLayoutMarkdown(md, THEME);
    expect(html).not.toContain("未知模块");
    expect(html).toContain("Vue");
    expect(html).toContain("TypeScript");
  });
});
