import type { HeadingTreeNode } from "./headings";
import type { MubuTreeNode } from "../types/mubu";

/** 将幕布树转为导图布局所需的 HeadingTreeNode（不含备注） */
export function mubuToHeadingTree(root: MubuTreeNode): HeadingTreeNode {
  const walk = (n: MubuTreeNode, depth: number): HeadingTreeNode => {
    const icon = n.decor?.icon ? `${n.decor.icon} ` : "";
    const todo = n.isTodo ? (n.isDone ? "☑ " : "☐ ") : "";
    return {
      id: n.id,
      text: `${todo}${icon}${n.text}`,
      slug: n.id,
      level: depth,
      kind: "body",
      isRoot: depth === 0,
      children: n.children.map((c: MubuTreeNode) => walk(c, depth + 1)),
    };
  };
  return walk(root, 0);
}

export function findMubuNode(
  root: MubuTreeNode,
  id: string,
): MubuTreeNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const hit = findMubuNode(c, id);
    if (hit) return hit;
  }
  return null;
}

export function findMubuParent(
  root: MubuTreeNode,
  id: string,
): MubuTreeNode | null {
  for (const c of root.children) {
    if (c.id === id) return root;
    const hit = findMubuParent(c, id);
    if (hit) return hit;
  }
  return null;
}

export function collectVisibleIds(
  root: MubuTreeNode,
  collapsed: Set<string>,
): string[] {
  const out: string[] = [root.id];
  if (collapsed.has(root.id)) return out;
  for (const c of root.children) {
    out.push(...collectVisibleIds(c, collapsed));
  }
  return out;
}

/** 大纲导出：整树写出，忽略 collapsed */
export function mubuTreeToMarkdown(root: MubuTreeNode): string {
  const lines: string[] = [];
  const walk = (n: MubuTreeNode, depth: number) => {
    const indent = "  ".repeat(depth);
    const icon = n.decor?.icon ? `${n.decor.icon} ` : "";
    const body = `${icon}${n.text}`.trim() || "未命名";
    if (n.isTodo) {
      lines.push(`${indent}- [${n.isDone ? "x" : " "}] ${body}`);
    } else {
      lines.push(`${indent}- ${body}`);
    }
    for (const c of n.children) walk(c, depth + 1);
  };
  walk(root, 0);
  return lines.join("\n") + "\n";
}
