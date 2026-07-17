import { describe, expect, it } from "vitest";
import { LLM_AUTO_TARGET } from "../../services/aiService";
import { buildOutlineMessages } from "../../services/writingAssistantService";
import { WA_DEFAULT_CONFIG } from "./defaults";

describe("buildOutlineMessages", () => {
  it("mentions framework and multi-level headings, not legacy writing-format labels", () => {
    const msgs = buildOutlineMessages({
      config: { ...WA_DEFAULT_CONFIG, outlineFramework: "howto" },
      topicTitle: "上手指南",
      intent: "教新手",
      llmTarget: LLM_AUTO_TARGET,
    });
    const user = msgs.find((m) => m.role === "user")?.content ?? "";
    expect(user).toContain("教程步骤");
    expect(user).toContain("多级标题");
    expect(user).toContain("###");
    expect(user).not.toContain("书写格式为");
    expect(user).not.toContain("一级章节 4–6");
  });
});
