import { describe, expect, it } from "vitest";
import {
  buildSectionWordBudgets,
  formatWordBudgetForPrompt,
  getFrameworkModuleSuggestions,
  getFrameworkSections,
  isOutlineEffectivelyEmpty,
  isOutlineSkeletonOrEmpty,
  recommendFrameworkFromTopic,
  renderOutlineFramework,
  resolveSuggestedFramework,
  WA_OUTLINE_FRAMEWORK_ORDER,
  WA_STYLE_FRAMEWORK_SUGGESTIONS,
} from "./outlineFrameworks";

describe("outlineFrameworks", () => {
  it("renders multi-level ## / ### skeleton for every framework", () => {
    for (const fw of WA_OUTLINE_FRAMEWORK_ORDER) {
      const out = renderOutlineFramework(fw, { title: "测试选题" });
      expect(isOutlineEffectivelyEmpty(out)).toBe(false);
      expect(out.length).toBeGreaterThan(40);
      expect(out).toMatch(/^## /m);
      expect(out).toMatch(/^### /m);
      expect(out).toMatch(/约占全文/);
    }
  });

  it("howto steps nest to #### when children have bullets", () => {
    const out = renderOutlineFramework("howto", { title: "上手" });
    expect(out).toMatch(/^## 步骤一/m);
    expect(out).toMatch(/^### 做什么/m);
    expect(out).toMatch(/^#### /m);
  });

  it("weightPct sums near 100 for each framework", () => {
    for (const fw of WA_OUTLINE_FRAMEWORK_ORDER) {
      const sum = getFrameworkSections(fw).reduce((a, s) => a + (s.weightPct ?? 0), 0);
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(2);
    }
  });

  it("buildSectionWordBudgets and prompt format", () => {
    const budgets = buildSectionWordBudgets("viral", 1800);
    expect(budgets.length).toBe(8);
    expect(budgets.every((b) => b.words >= 50)).toBe(true);
    const text = formatWordBudgetForPrompt(budgets);
    expect(text).toContain("各节字数预算");
    expect(text).toContain("约");
  });

  it("includes style-oriented frameworks", () => {
    expect(getFrameworkSections("viral").length).toBe(8);
    expect(getFrameworkSections("contrarian").length).toBe(6);
    expect(getFrameworkSections("emotional").length).toBe(5);
  });

  it("module suggestions resolve known snippet ids", () => {
    const items = getFrameworkModuleSuggestions("howto", { topicTitle: "测试" });
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.id === "hero" && i.snippet.includes(":::"))).toBe(true);
  });

  it("isOutlineSkeletonOrEmpty treats framework comments as skeleton", () => {
    const sk = renderOutlineFramework("viral", { title: "T" });
    expect(isOutlineSkeletonOrEmpty(sk)).toBe(true);
    expect(isOutlineSkeletonOrEmpty("## 我手写的章节\n- a")).toBe(false);
  });

  it("soft-binds builtin style packs", () => {
    expect(suggestFrameworkForStyleSafe("viral")).toBe("viral");
    expect(WA_STYLE_FRAMEWORK_SUGGESTIONS.checklist).toBe("listicle");
  });

  it("recommends framework from topic keywords", () => {
    expect(recommendFrameworkFromTopic("A 与 B 对比评测哪个好")).toBe("comparison");
    expect(recommendFrameworkFromTopic("新手上手教程怎么做")).toBe("howto");
    expect(recommendFrameworkFromTopic("其实真相是误区")).toBe("contrarian");
    expect(recommendFrameworkFromTopic("无关内容")).toBeUndefined();
  });

  it("resolveSuggestedFramework prefers topic over style", () => {
    expect(
      resolveSuggestedFramework({
        topicText: "工具盘点合集推荐",
        stylePackId: "viral",
      }),
    ).toBe("listicle");
    expect(
      resolveSuggestedFramework({
        topicText: "",
        stylePackId: "viral",
      }),
    ).toBe("viral");
  });
});

function suggestFrameworkForStyleSafe(id: string) {
  return WA_STYLE_FRAMEWORK_SUGGESTIONS[id];
}
