import { describe, expect, it } from "vitest";

import { detectSlashTrigger } from "./useCcInputCompletions";

describe("detectSlashTrigger", () => {
  it("行首触发斜杠补全", () => {
    const text = "/using";
    const result = detectSlashTrigger(text, text.length);
    expect(result).toMatchObject({
      open: true,
      kind: "slash",
      query: "using",
      triggerStart: 0,
    });
  });

  it("支持同消息叠技能：空白后的第二个 /", () => {
    const text = "/using-superpowers /";
    const result = detectSlashTrigger(text, text.length);
    expect(result).toMatchObject({
      open: true,
      kind: "slash",
      query: "",
      triggerStart: text.lastIndexOf("/"),
    });
  });

  it("支持第二个技能名筛选", () => {
    const text = "/code-review /fix";
    const result = detectSlashTrigger(text, text.length);
    expect(result).toMatchObject({
      open: true,
      kind: "slash",
      query: "fix",
      triggerStart: text.lastIndexOf("/"),
    });
  });

  it("路径中间的 / 不触发", () => {
    const text = "看一下 src/utils/";
    expect(detectSlashTrigger(text, text.length)).toBeNull();
  });
});
