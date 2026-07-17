import { describe, expect, it } from "vitest";
import { LLM_AUTO_TARGET } from "../../services/aiService";
import { buildHumanizeMessages } from "../../services/writingAssistantService";
import {
  normalizeHumanizeSkillName,
  resolveTargetWords,
  WA_DEFAULT_CONFIG,
  WA_HUMANIZE_FALLBACK_RULES,
  WA_TARGET_WORDS_MAX,
  WA_TARGET_WORDS_MIN,
} from "./defaults";

describe("resolveTargetWords", () => {
  it("clamps and steps", () => {
    expect(resolveTargetWords(50)).toBe(WA_TARGET_WORDS_MIN);
    expect(resolveTargetWords(100)).toBe(100);
    expect(resolveTargetWords(99999)).toBe(WA_TARGET_WORDS_MAX);
    expect(resolveTargetWords(1850)).toBe(1900);
    expect(resolveTargetWords("short")).toBe(800);
    expect(resolveTargetWords("long")).toBe(3500);
  });
});

describe("normalizeHumanizeSkillName", () => {
  it("strips leading slashes", () => {
    expect(normalizeHumanizeSkillName("/humanizer-zh")).toBe("humanizer-zh");
    expect(normalizeHumanizeSkillName("  humanizer-zh  ")).toBe("humanizer-zh");
  });
});

describe("buildHumanizeMessages", () => {
  it("injects skill body when provided", () => {
    const msgs = buildHumanizeMessages({
      config: { ...WA_DEFAULT_CONFIG, humanizeSkill: "humanizer-zh" },
      body: "## 一\n你好",
      humanizeSkillBody: "删除填充短语",
      llmTarget: LLM_AUTO_TARGET,
    });
    const user = msgs.find((m) => m.role === "user")?.content ?? "";
    expect(user).toContain("Skill「humanizer-zh」");
    expect(user).toContain("删除填充短语");
    expect(user).toContain("## 一");
  });

  it("uses fallback when skill body missing", () => {
    const msgs = buildHumanizeMessages({
      config: { ...WA_DEFAULT_CONFIG, humanizeSkill: "" },
      body: "正文",
      llmTarget: LLM_AUTO_TARGET,
    });
    const user = msgs.find((m) => m.role === "user")?.content ?? "";
    expect(user).toContain(WA_HUMANIZE_FALLBACK_RULES.slice(0, 12));
    expect(user).not.toContain("Skill「");
  });
});
