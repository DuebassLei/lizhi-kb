import { describe, expect, it } from "vitest";
import { updateOutlineLine } from "./updateOutlineLine";

describe("updateOutlineLine", () => {
  it("updates heading, list and body lines", () => {
    const content = "# Old\n- item\nplain";
    expect(updateOutlineLine(content, 0, "New")).toBe("# New\n- item\nplain");
    expect(updateOutlineLine(content, 1, "changed")).toBe("# Old\n- changed\nplain");
    expect(updateOutlineLine(content, 2, "body")).toBe("# Old\n- item\nbody");
  });
});
