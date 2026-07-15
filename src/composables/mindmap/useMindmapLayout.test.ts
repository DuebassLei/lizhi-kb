import { describe, expect, it } from "vitest";
import { buildHeadingTree } from "../../utils/headings";
import { layoutMindmapTree } from "./useMindmapLayout";

describe("layoutMindmapTree", () => {
  it("layouts root and children with links", () => {
    const tree = buildHeadingTree("Root", "# A\n## B\n# C");
    const layout = layoutMindmapTree(tree);
    expect(layout.nodes.length).toBe(4); // root + A + B + C
    expect(layout.links.length).toBe(3);
    const root = layout.nodes[0];
    expect(root.isRoot).toBe(true);
    expect(layout.width).toBeGreaterThan(root.width);
  });

  it("hides children when collapsed", () => {
    const tree = buildHeadingTree("Root", "# A\n## B");
    const a = tree.children[0];
    const layout = layoutMindmapTree(tree, [a.id]);
    expect(layout.nodes.map((n) => n.text)).toEqual(["Root", "A"]);
    expect(layout.nodes.find((n) => n.id === a.id)?.collapsed).toBe(true);
  });

  it("assigns mubu chrome by tree depth", () => {
    const tree = buildHeadingTree("Root", "# A\n## B\n# C");
    const layout = layoutMindmapTree(tree);
    const byText = Object.fromEntries(layout.nodes.map((n) => [n.text, n]));
    expect(byText.Root.chrome).toBe("root");
    expect(byText.A.chrome).toBe("box");
    expect(byText.C.chrome).toBe("box");
    expect(byText.B.chrome).toBe("line");
    expect(byText.B.depth).toBe(2);
  });
});
