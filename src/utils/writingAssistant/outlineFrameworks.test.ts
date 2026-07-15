import { describe, expect, it } from "vitest";
import {
  isOutlineEffectivelyEmpty,
  renderOutlineFramework,
  WA_OUTLINE_FRAMEWORK_ORDER,
} from "./outlineFrameworks";

describe("outlineFrameworks", () => {
  it("renders non-empty skeleton for every framework × format", () => {
    for (const fw of WA_OUTLINE_FRAMEWORK_ORDER) {
      for (const fmt of ["h2h3", "cn", "list", "custom"] as const) {
        const out = renderOutlineFramework(fw, fmt, { title: "测试选题" });
        expect(isOutlineEffectivelyEmpty(out)).toBe(false);
        expect(out.length).toBeGreaterThan(40);
      }
    }
  });

  it("h2h3 includes ## headings", () => {
    const out = renderOutlineFramework("howto", "h2h3");
    expect(out).toMatch(/^## /m);
  });

  it("detects empty outline including comment-only", () => {
    expect(isOutlineEffectivelyEmpty("")).toBe(true);
    expect(isOutlineEffectivelyEmpty("  \n  ")).toBe(true);
    expect(isOutlineEffectivelyEmpty("<!-- x -->\n")).toBe(true);
    expect(isOutlineEffectivelyEmpty("## 开篇")).toBe(false);
  });
});
