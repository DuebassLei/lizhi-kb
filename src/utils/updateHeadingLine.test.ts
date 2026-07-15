import { describe, expect, it } from "vitest";
import { updateHeadingLine } from "./updateHeadingLine";

describe("updateHeadingLine", () => {
  it("updates heading text and keeps level", () => {
    const content = "# A\n## Old\nbody";
    expect(updateHeadingLine(content, 1, "New")).toBe("# A\n## New\nbody");
  });

  it("ignores non-heading lines", () => {
    const content = "# A\nplain\n## B";
    expect(updateHeadingLine(content, 1, "X")).toBe(content);
  });

  it("rejects empty text", () => {
    const content = "# A\n## B";
    expect(updateHeadingLine(content, 1, "   ")).toBe(content);
  });
});
