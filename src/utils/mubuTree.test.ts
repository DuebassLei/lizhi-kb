import { describe, expect, it } from "vitest";
import { buildMubuTree, flattenMubuTree, countMubuStats } from "../services/mubuService";
import type { MubuNode } from "../types/mubu";

describe("mubu tree helpers", () => {
  it("round-trips flatten/build without notes", () => {
    const flat: MubuNode[] = [
      {
        id: "r",
        docId: "d",
        parentId: null,
        sortOrder: 0,
        text: "根",
        note: "",
        collapsed: false,
        isTodo: false,
        isDone: false,
        headingLevel: 0,
        decor: {},
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "a",
        docId: "d",
        parentId: "r",
        sortOrder: 0,
        text: "A",
        note: "",
        collapsed: false,
        isTodo: true,
        isDone: false,
        headingLevel: 2,
        decor: { bold: true, icon: "⭐" },
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const tree = buildMubuTree(flat);
    expect(tree?.children[0].isTodo).toBe(true);
    expect(tree?.children[0].decor.icon).toBe("⭐");
    const again = flattenMubuTree(tree!);
    expect(again.find((n) => n.id === "a")?.headingLevel).toBe(2);
    expect(countMubuStats(tree).topics).toBe(2);
  });
});
