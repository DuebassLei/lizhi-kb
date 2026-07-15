import { slugifyHeading, type HeadingTreeNode } from "./headings";

export type OutlineNodeKind = "heading" | "body" | "list";

function isIndentedCodeLine(line: string): boolean {
  return /^(?:\t| {4})/.test(line);
}

function skipFrontmatter(lines: string[]): number {
  if (lines[0]?.trim() !== "---") return 0;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") return i + 1;
  }
  return 0;
}

function makeNode(
  id: string,
  text: string,
  level: number,
  lineIndex: number,
  kind: OutlineNodeKind,
): HeadingTreeNode {
  return {
    id,
    text,
    slug: kind === "heading" ? slugifyHeading(text) : "",
    level,
    lineIndex,
    kind,
    children: [],
  };
}

function appendNote(node: HeadingTreeNode, text: string) {
  node.note = node.note ? `${node.note}\n${text}` : text;
}

/**
 * 幕布式大纲树（主题 + 备注 + 子主题）：
 * - 标题 / 列表项 / 根级独立段落 → 导图主题节点
 * - 标题后的段落 → 该主题的备注（note），不单独成气泡
 * - 列表项后缩进段落 → 可选备注
 * - 列表按缩进嵌套为子主题
 */
export function buildOutlineTree(docTitle: string, content: string): HeadingTreeNode {
  const root: HeadingTreeNode = {
    id: "root",
    text: docTitle.trim() || "无标题",
    slug: "",
    level: 0,
    isRoot: true,
    children: [],
  };

  const lines = content.split("\n");
  const start = skipFrontmatter(lines);
  const headingStack: HeadingTreeNode[] = [root];
  let listStack: { node: HeadingTreeNode; depth: number }[] = [];
  let lastListItem: HeadingTreeNode | null = null;
  let inFence = false;
  let inIndentedCode = false;
  let idx = 0;

  const currentSection = () => headingStack[headingStack.length - 1];

  for (let lineIndex = start; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    const trimmedStart = line.trimStart();
    const leading = (line.match(/^\s*/)?.[0] ?? "").replace(/\t/g, "  ").length;

    if (/^```/.test(trimmedStart)) {
      inFence = !inFence;
      listStack = [];
      lastListItem = null;
      continue;
    }
    if (inFence) continue;

    // 缩进代码块：跳过；若紧跟列表项且有文本，记为该列表备注
    if (
      isIndentedCodeLine(line) &&
      !/^([-*+]|\d+\.)\s+/.test(trimmedStart)
    ) {
      if (trimmed && lastListItem) appendNote(lastListItem, trimmed);
      inIndentedCode = true;
      continue;
    }
    if (inIndentedCode) {
      if (trimmed === "") {
        inIndentedCode = false;
        continue;
      }
      // 仍缩进则继续当作代码/备注；否则结束缩进块并重新解析本行
      if (isIndentedCodeLine(line)) {
        if (lastListItem) appendNote(lastListItem, trimmed);
        continue;
      }
      inIndentedCode = false;
    }

    if (!trimmed) {
      // 空行：断开列表嵌套栈，但保留「当前标题」以便后续段落继续写入备注
      listStack = [];
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) continue;

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      listStack = [];
      lastListItem = null;
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      while (headingStack.length > 1 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      const node = makeNode(
        `h-${idx}-${lineIndex}-${slugifyHeading(text)}`,
        text,
        level,
        lineIndex,
        "heading",
      );
      idx += 1;
      currentSection().children.push(node);
      headingStack.push(node);
      continue;
    }

    const listMatch = /^(\s*)([-*+]|\d+\.)\s+(.+)$/.exec(line);
    if (listMatch) {
      const indent = listMatch[1].replace(/\t/g, "  ").length;
      const depth = Math.floor(indent / 2);
      const text = listMatch[3].trim();
      while (listStack.length && listStack[listStack.length - 1].depth >= depth) {
        listStack.pop();
      }
      const parent = listStack.length ? listStack[listStack.length - 1].node : currentSection();
      const node = makeNode(
        `l-${idx}-${lineIndex}`,
        text,
        (parent.level || 0) + 1,
        lineIndex,
        "list",
      );
      idx += 1;
      parent.children.push(node);
      listStack.push({ node, depth });
      lastListItem = node;
      continue;
    }

    const bodyText = trimmed.replace(/^>\s?/, "");
    if (!bodyText) continue;

    // 幕布备注：缩进段落挂列表项；否则挂当前标题；根下独立段落=主题
    if (leading >= 2 && lastListItem) {
      appendNote(lastListItem, bodyText);
      continue;
    }

    const section = currentSection();
    if (section !== root) {
      appendNote(section, bodyText);
      continue;
    }

    listStack = [];
    lastListItem = null;
    const node = makeNode(`b-${idx}-${lineIndex}`, bodyText, 1, lineIndex, "body");
    idx += 1;
    root.children.push(node);
  }

  return root;
}

export function countOutlineNodes(node: HeadingTreeNode): number {
  let n = node.isRoot ? 0 : 1;
  for (const child of node.children) n += countOutlineNodes(child);
  return n;
}
