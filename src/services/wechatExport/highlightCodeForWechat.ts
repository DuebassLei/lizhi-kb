import { lowlight } from "../../utils/lowlightSetup";
import type { WechatThemeId } from "./themes";

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string | string[] };
  children?: HastNode[];
};

/**
 * atom-one-dark token 规则 — 供 juice 内联到 span（对齐 mdnice / md-wechat-editor 做法：
 * 高亮 class → CSS → juice inline，而非手写 font 标签）。
 */
export const WECHAT_CODE_HLJS_CSS = `
#nice pre code .hljs-comment,
#nice pre code .hljs-quote { color: #5c6370; font-style: italic; }
#nice pre code .hljs-keyword,
#nice pre code .hljs-selector-tag,
#nice pre code .hljs-literal { color: #c678dd; }
#nice pre code .hljs-string,
#nice pre code .hljs-char,
#nice pre code .hljs-attr,
#nice pre code .hljs-attribute,
#nice pre code .hljs-regexp { color: #98c379; }
#nice pre code .hljs-number,
#nice pre code .hljs-built_in,
#nice pre code .hljs-builtin-name { color: #d19a66; }
#nice pre code .hljs-title,
#nice pre code .hljs-section,
#nice pre code .hljs-function,
#nice pre code .function_ { color: #61afef; }
#nice pre code .hljs-type,
#nice pre code .hljs-class,
#nice pre code .class_ { color: #e6c07b; }
#nice pre code .hljs-name,
#nice pre code .hljs-variable,
#nice pre code .hljs-template-variable,
#nice pre code .hljs-tag { color: #e06c75; }
#nice pre code .hljs-operator,
#nice pre code .hljs-symbol,
#nice pre code .hljs-punctuation { color: #56b6c2; }
#nice pre code .hljs-meta,
#nice pre code .hljs-subst,
#nice pre code .hljs-property,
#nice pre code .hljs-params { color: #abb2bf; }
#nice pre code .hljs-link { color: #61afef; }
#nice pre code .hljs-emphasis { font-style: italic; }
#nice pre code .hljs-strong { font-weight: bold; }
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeClasses(className?: string | string[]): string[] {
  if (!className) return [];
  return (Array.isArray(className) ? className : [className]).flatMap((c) => c.split(/\s+/)).filter(Boolean);
}

function hastToHljsHtml(node: HastNode): string {
  if (node.type === "text" && node.value != null) return escapeHtml(node.value);
  if (node.type === "root") {
    return (node.children ?? []).map((child) => hastToHljsHtml(child)).join("");
  }
  if (node.type === "element" && node.tagName) {
    if (node.tagName === "pre" || node.tagName === "code") {
      return (node.children ?? []).map((child) => hastToHljsHtml(child)).join("");
    }
    const classes = normalizeClasses(node.properties?.className);
    const classAttr = classes.length ? ` class="${classes.join(" ")}"` : "";
    const inner = (node.children ?? []).map((child) => hastToHljsHtml(child)).join("");
    return `<span${classAttr}>${inner}</span>`;
  }
  return "";
}

function extractLanguage(className: string): string {
  for (const token of className.split(/\s+/).filter(Boolean)) {
    const m = token.match(/^(?:language|lang)-(\w+)$/);
    if (m) return m[1];
  }
  return "";
}

/** 将源码高亮为 hljs span HTML（juice 前调用） */
export function highlightCodeToHljsHtml(code: string, lang: string): string {
  const trimmed = lang.trim().toLowerCase();
  try {
    const tree = trimmed ? lowlight.highlight(trimmed, code) : lowlight.highlightAuto(code);
    const html = hastToHljsHtml(tree as HastNode);
    if (html) return html;
  } catch {
    /* fall through */
  }
  return escapeHtml(code);
}

/**
 * juice 之前：为 pre > code 注入 hljs token span，保留 class 供 CSS 匹配。
 * 容器样式由 WECHAT_BASE_CSS + 主题 CSS 经 juice 内联，不在此硬编码 style。
 */
export function highlightCodeBlocksInHtml(html: string, _themeId: WechatThemeId = "normal"): string {
  if (typeof DOMParser === "undefined") return html;

  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const codes = doc.querySelectorAll("pre > code");
    codes.forEach((codeEl) => {
      const lang =
        extractLanguage(codeEl.className) || codeEl.getAttribute("data-lang") || "";
      const rawText = codeEl.textContent ?? "";
      const langClass = lang ? `language-${lang}` : "language-plaintext";
      codeEl.className = `hljs ${langClass}`.trim();
      codeEl.innerHTML = highlightCodeToHljsHtml(rawText, lang);
    });
    return doc.body.firstElementChild?.innerHTML ?? html;
  } catch {
    return html;
  }
}

/** juice 之后：微信编辑器会吞掉标签间空格，pre 内文本空格转 nbsp */
export function preserveCodeBlockWhitespace(html: string): string {
  if (typeof DOMParser === "undefined") return html;

  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    doc.querySelectorAll("pre").forEach((pre) => {
      preserveWhitespaceInElement(pre);
    });
    return doc.body.firstElementChild?.innerHTML ?? html;
  } catch {
    return html;
  }
}

function preserveWhitespaceInElement(el: Element): void {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? "";
    if (!text.includes(" ") && !text.includes("\t")) continue;
    node.textContent = text.replace(/ /g, "\u00a0").replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0");
  }
}

/** juice 后 span color 转 font，提升微信粘贴兼容性（参考 cardSyntaxGuide font 标签） */
export function convertColorSpansToFont(html: string): string {
  return html.replace(
    /<span\b[^>]*\bstyle="[^"]*color:\s*(#[0-9a-fA-F]{3,8})[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_match, color: string, inner: string) => `<font color="${color}">${inner}</font>`,
  );
}

/** 供脚本断言：高亮结果应含 font 标签、nbsp 空格、多色 token */
export function assertWechatCodeHighlight(html: string, source: string): string[] {
  const errors: string[] = [];
  if (!html.includes("<font color=")) errors.push("missing <font color> tags");
  if (source.includes(" ") && !html.includes("&nbsp;") && !html.includes("\u00a0")) {
    errors.push("spaces not preserved as nbsp");
  }
  const fontColors = html.match(/<font color="([^"]+)"/g) ?? [];
  if (fontColors.length < 2 && source.trim().split(/\s+/).length > 1) {
    errors.push("expected multiple colored tokens");
  }
  return errors;
}
