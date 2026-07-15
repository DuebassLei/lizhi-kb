import { describe, expect, it } from "vitest";
import { buildOutlineTree, countOutlineNodes } from "./outlineTree";

describe("buildOutlineTree", () => {
  it("attaches body paragraphs as notes (幕布备注), not sibling nodes", () => {
    const md = "# 章节\n这是正文第一段。\n\n继续的说明\n## 小节\n小节内容";
    const tree = buildOutlineTree("文档", md);
    expect(tree.children).toHaveLength(1);
    const chapter = tree.children[0];
    expect(chapter.text).toBe("章节");
    expect(chapter.note).toBe("这是正文第一段。\n继续的说明");
    expect(chapter.children).toHaveLength(1);
    expect(chapter.children[0].text).toBe("小节");
    expect(chapter.children[0].note).toBe("小节内容");
  });

  it("nests list items as child topics", () => {
    const md = "# A\nintro\n- 父项\n  - 子项\n  - 子项二\n- 同级";
    const tree = buildOutlineTree("Doc", md);
    const a = tree.children[0];
    expect(a.note).toBe("intro");
    expect(a.children.map((c) => c.text)).toEqual(["父项", "同级"]);
    expect(a.children[0].children.map((c) => c.text)).toEqual(["子项", "子项二"]);
  });

  it("treats root paragraphs and lists as topics", () => {
    const md = "开篇段落\n- 一点\n- 两点";
    const tree = buildOutlineTree("无标题文", md);
    expect(tree.children.map((c) => c.text)).toEqual(["开篇段落", "一点", "两点"]);
    expect(countOutlineNodes(tree)).toBe(3);
  });

  it("skips fenced code; following prose becomes note", () => {
    const md = "---\ntitle: x\n---\n# H\n```js\nconst a = 1\n```\n正文";
    const tree = buildOutlineTree("D", md);
    expect(tree.children[0].text).toBe("H");
    expect(tree.children[0].note).toBe("正文");
    expect(tree.children[0].children).toHaveLength(0);
  });
});
