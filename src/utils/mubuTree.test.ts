import { describe, expect, it } from "vitest";
import { buildMubuTree, flattenMubuTree, countMubuStats } from "../services/mubuService";
import { mubuTreeToMarkdown } from "./mubuTree";
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

  it("mubuTreeToMarkdown writes full tree ignoring collapse", () => {
    const flat: MubuNode[] = [
      {
        id: "r",
        docId: "d",
        parentId: null,
        sortOrder: 0,
        text: "根",
        note: "",
        collapsed: true,
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
        text: "待办",
        note: "",
        collapsed: false,
        isTodo: true,
        isDone: false,
        headingLevel: 0,
        decor: { icon: "⭐" },
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "b",
        docId: "d",
        parentId: "r",
        sortOrder: 1,
        text: "已做",
        note: "",
        collapsed: false,
        isTodo: true,
        isDone: true,
        headingLevel: 0,
        decor: {},
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const tree = buildMubuTree(flat)!;
    expect(mubuTreeToMarkdown(tree)).toBe(
      ["- 根", "  - [ ] ⭐ 待办", "  - [x] 已做", ""].join("\n"),
    );
  });
});
