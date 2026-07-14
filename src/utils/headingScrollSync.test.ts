import { describe, expect, it } from "vitest";
import { extractHeadings } from "./headings";
import { findActiveHeading } from "./headingScrollSync";

describe("findActiveHeading", () => {
  const content = `# A\n\nbody\n\n## B\n\nmore\n\n## B\n\nend\n`;
  const headings = extractHeadings(content);

  it("returns null before first heading", () => {
    expect(findActiveHeading(headings, -1)).toBeNull();
  });

  it("picks last heading at or before anchor line", () => {
    expect(findActiveHeading(headings, 0)?.heading.text).toBe("A");
    expect(findActiveHeading(headings, 3)?.heading.text).toBe("A");
    expect(findActiveHeading(headings, 4)?.heading.text).toBe("B");
    expect(findActiveHeading(headings, 4)?.occurrence).toBe(0);
    expect(findActiveHeading(headings, 8)?.heading.text).toBe("B");
    expect(findActiveHeading(headings, 8)?.occurrence).toBe(1);
  });
});
