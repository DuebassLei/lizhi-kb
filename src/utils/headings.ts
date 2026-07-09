export interface HeadingItem {
  level: number;
  text: string;
  slug: string;
}

export interface HeadingTreeNode {
  id: string;
  text: string;
  slug: string;
  /** Markdown heading level 1–6; root is 0 */
  level: number;
  isRoot?: boolean;
  children: HeadingTreeNode[];
}

export function slugifyHeading(text: string): string {
  return text.replace(/\s+/g, "-").toLowerCase();
}

function isIndentedCodeLine(line: string): boolean {
  return /^(?:\t| {4})/.test(line);
}

export function extractHeadings(content: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const lines = content.split("\n");
  let inFencedCodeBlock = false;
  let inIndentedCodeBlock = false;

  for (const line of lines) {
    const trimmedStart = line.trimStart();

    if (/^```/.test(trimmedStart)) {
      inFencedCodeBlock = !inFencedCodeBlock;
      continue;
    }
    if (inFencedCodeBlock) continue;

    if (isIndentedCodeLine(line)) {
      inIndentedCodeBlock = true;
      continue;
    }
    if (inIndentedCodeBlock) {
      if (line.trim() === "") {
        inIndentedCodeBlock = false;
        continue;
      }
      inIndentedCodeBlock = false;
    }

    const m = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const text = m[2].trim();
    headings.push({
      level: m[1].length,
      text,
      slug: slugifyHeading(text),
    });
  }
  return headings;
}

/** @internal Self-check for extractHeadings edge cases */
export function verifyExtractHeadings(): void {
  const assert = (label: string, content: string, expected: string[]) => {
    const got = extractHeadings(content).map((h) => h.text);
    const ok =
      got.length === expected.length && got.every((t, i) => t === expected[i]);
    if (!ok) {
      throw new Error(
        `${label}: expected [${expected.join(", ")}], got [${got.join(", ")}]`,
      );
    }
  };

  assert("real headings", "# One\n## Two\n### Three", ["One", "Two", "Three"]);
  assert(
    "fenced bash comment",
    "# Real\n```bash\n# sdwan生产的改用编排的回单接口\n```\n## After",
    ["Real", "After"],
  );
  assert(
    "indented code",
    "# Real\n    # not a heading\n## After",
    ["Real", "After"],
  );
}

/** 以文档标题为根节点，将 Markdown 标题解析为树 */
export function buildHeadingTree(docTitle: string, content: string): HeadingTreeNode {
  const headings = extractHeadings(content);
  const root: HeadingTreeNode = {
    id: "root",
    text: docTitle.trim() || "无标题",
    slug: "",
    level: 0,
    isRoot: true,
    children: [],
  };

  if (!headings.length) return root;

  const stack: HeadingTreeNode[] = [root];
  let idx = 0;
  for (const h of headings) {
    while (stack.length > 1 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    const node: HeadingTreeNode = {
      id: `h-${idx}-${h.slug}`,
      text: h.text,
      slug: h.slug,
      level: h.level,
      children: [],
    };
    idx += 1;
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root;
}
