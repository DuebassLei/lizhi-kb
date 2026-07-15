import { describe, expect, it } from "vitest";
import { buildHeadingTree, extractHeadings, findHeadingLineIndex } from "./headings";

describe("extractHeadings", () => {
  it("extracts real headings", () => {
    expect(extractHeadings("# One\n## Two\n### Three").map((h) => h.text)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    const content = "# Real\n```bash\n# sdwan生产的改用编排的回单接口\n```\n## After";
    expect(extractHeadings(content).map((h) => h.text)).toEqual(["Real", "After"]);
  });

  it("ignores indented code lines", () => {
    const content = "# Real\n    # not a heading\n## After";
    expect(extractHeadings(content).map((h) => h.text)).toEqual(["Real", "After"]);
  });

  it("keeps distinct line indexes for duplicate titles", () => {
    const content = "# First\n## Target\n```\n## Target\n```\n## Target";
    const headings = extractHeadings(content);
    expect(headings.map((h) => h.text)).toEqual(["First", "Target", "Target"]);
    expect(headings[1].lineIndex).not.toBe(headings[2].lineIndex);
  });
});

describe("findHeadingLineIndex", () => {
  it("finds heading by occurrence outside code blocks", () => {
    const content = "# First\n## Target\n```\n## Target\n```\n## Target";
    const headings = extractHeadings(content);
    expect(findHeadingLineIndex(content, "Target", 1)).toBe(headings[2].lineIndex);
  });
});

describe("buildHeadingTree", () => {
  it("builds nested tree with line indexes", () => {
    const content = "# One\n## Two\n### Three\n## Four";
    const tree = buildHeadingTree("Doc", content);
    expect(tree.isRoot).toBe(true);
    expect(tree.text).toBe("Doc");
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].text).toBe("One");
    expect(tree.children[0].lineIndex).toBe(0);
    expect(tree.children[0].children[0].text).toBe("Two");
    expect(tree.children[0].children[0].children[0].text).toBe("Three");
    expect(tree.children[0].children[1].text).toBe("Four");
  });
});
