import { describe, expect, it } from "vitest";
import { parseTopicLabel } from "./parseTopicLabel";

describe("parseTopicLabel", () => {
  it("splits trailing #tags", () => {
    expect(parseTopicLabel("第二章：规则和假设 #重点")).toEqual({
      title: "第二章：规则和假设",
      tags: ["重点"],
    });
  });

  it("keeps text without tags", () => {
    expect(parseTopicLabel("读前说明")).toEqual({
      title: "读前说明",
      tags: [],
    });
  });

  it("collects multiple tags", () => {
    expect(parseTopicLabel("标题 #重点 #todo")).toEqual({
      title: "标题",
      tags: ["重点", "todo"],
    });
  });
});
