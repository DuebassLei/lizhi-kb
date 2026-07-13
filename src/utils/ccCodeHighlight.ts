import { lowlight } from "./lowlightSetup";

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string | string[] };
  children?: HastNode[];
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hastToHtml(node: HastNode): string {
  if (node.type === "text" && node.value != null) return escapeHtml(node.value);
  if (node.type === "element" && node.tagName) {
    const classes = node.properties?.className;
    const classAttr = classes
      ? ` class="${(Array.isArray(classes) ? classes : [classes]).join(" ")}"`
      : "";
    const inner = (node.children ?? []).map(hastToHtml).join("");
    return `<${node.tagName}${classAttr}>${inner}</${node.tagName}>`;
  }
  if (node.type === "root") return (node.children ?? []).map(hastToHtml).join("");
  return "";
}

const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  vue: "html",
  py: "python",
  rs: "rust",
  md: "markdown",
  markdown: "markdown",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  less: "css",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  sql: "sql",
  go: "go",
  java: "java",
  kt: "kotlin",
  rb: "ruby",
  php: "php",
  c: "c",
  cpp: "cpp",
  h: "c",
  cs: "csharp",
  swift: "swift",
  xml: "xml",
};

/** 从文件路径推断 lowlight 语言 id */
export function languageFromFilePath(path: string | null | undefined): string {
  if (!path?.trim()) return "plaintext";
  const base = path.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot === -1) return "plaintext";
  const ext = base.slice(dot + 1).toLowerCase();
  return EXT_LANG[ext] ?? ext;
}

/** 高亮代码块为 HTML（hljs span） */
export function highlightCodeHtml(code: string, lang?: string | null): string {
  const trimmedLang = lang?.trim().toLowerCase() ?? "";
  try {
    const tree = trimmedLang
      ? lowlight.highlight(trimmedLang, code)
      : lowlight.highlightAuto(code);
    return hastToHtml(tree as HastNode);
  } catch {
    return escapeHtml(code);
  }
}

/** 高亮 diff 单行（空行返回 nbsp） */
export function highlightDiffLineHtml(line: string, lang?: string | null): string {
  if (!line) return "&nbsp;";
  return highlightCodeHtml(line, lang);
}
