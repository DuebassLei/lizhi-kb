import { describe, expect, it } from "vitest";
import {
  shouldAutoExpandTool,
  toolDisplayLabel,
  toolOutputSummary,
} from "./chatToolDisplay";

describe("chatToolDisplay", () => {
  it("maps known tool names to chinese labels", () => {
    expect(toolDisplayLabel("lizhi_search")).toBe("搜索知识库");
    expect(toolDisplayLabel("search")).toBe("搜索");
  });

  it("summarizes json arrays", () => {
    expect(toolOutputSummary(JSON.stringify([{ id: "1" }, { id: "2" }]))).toBe(
      "返回 2 条结果",
    );
  });

  it("auto-expands short output only", () => {
    expect(shouldAutoExpandTool("ok")).toBe(true);
    expect(shouldAutoExpandTool("x".repeat(200))).toBe(false);
    expect(shouldAutoExpandTool(undefined)).toBe(false);
  });
});
