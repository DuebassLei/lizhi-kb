import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/** Markdown 语法高亮，匹配狸知色板 */
export const lizhiMarkdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: "var(--color-text)", fontWeight: "600" },
  { tag: tags.heading2, color: "var(--color-text-secondary)", fontWeight: "600" },
  { tag: tags.heading3, color: "var(--color-text-secondary)", fontWeight: "500" },
  { tag: tags.heading4, color: "var(--color-muted)", fontWeight: "500" },
  { tag: tags.strong, fontWeight: "600", color: "var(--color-text)" },
  { tag: tags.emphasis, fontStyle: "italic", color: "var(--color-text-secondary)" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--color-muted)" },
  { tag: tags.link, color: "var(--color-link)" },
  { tag: tags.url, color: "var(--color-link)", textDecoration: "underline", textDecorationColor: "color-mix(in srgb, var(--color-link) 30%, transparent)" },
  { tag: tags.monospace, color: "var(--color-paw)", fontFamily: "var(--font-mono)" },
  { tag: tags.quote, color: "var(--color-muted)", fontStyle: "italic" },
  { tag: tags.processingInstruction, color: "var(--color-muted)", fontWeight: "500" },
  { tag: tags.labelName, color: "var(--color-hold)" },
  { tag: tags.string, color: "var(--color-text-secondary)" },
  { tag: tags.comment, color: "var(--color-muted)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--color-text-secondary)" },
  { tag: tags.contentSeparator, color: "var(--color-border-strong)" },
]);

/** CodeMirror 6 主题，跟随全局 CSS 变量 */
export const lizhiCodeMirrorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "var(--color-canvas)",
      color: "var(--color-text)",
      fontSize: "var(--text-base)",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "var(--font-mono)",
      lineHeight: "1.7",
      letterSpacing: "0.01em",
    },
    ".cm-content": {
      caretColor: "var(--color-paw)",
      padding: "1.25rem 0 3rem",
    },
    ".cm-line": {
      padding: "0 1.25rem 0 1.5rem",
    },
    ".cm-gutters": {
      backgroundColor: "color-mix(in srgb, var(--color-surface-0) 72%, var(--color-canvas))",
      color: "var(--color-muted)",
      border: "none",
      borderRight: "1px solid var(--color-divider)",
    },
    ".cm-gutterElement": {
      padding: "0 0.75rem 0 0.625rem",
      minWidth: "2.75rem",
      fontSize: "0.6875rem",
      fontVariantNumeric: "tabular-nums",
      lineHeight: "1.7",
    },
    ".cm-activeLineGutter": {
      color: "var(--color-text-secondary)",
      backgroundColor: "color-mix(in srgb, var(--color-paw) 10%, transparent)",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--color-paw) 5%, transparent)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-paw)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "color-mix(in srgb, var(--color-paw) 20%, transparent) !important",
    },
    ".cm-matchingBracket": {
      backgroundColor: "color-mix(in srgb, var(--color-link) 18%, transparent)",
      outline: "1px solid color-mix(in srgb, var(--color-link) 35%, transparent)",
    },
    ".cm-find-match": {
      backgroundColor: "color-mix(in srgb, var(--color-warning) 32%, transparent)",
      borderRadius: "2px",
    },
    ".cm-find-match--active": {
      backgroundColor: "color-mix(in srgb, var(--color-paw) 28%, transparent)",
      outline: "1px solid color-mix(in srgb, var(--color-paw) 45%, transparent)",
    },
  },
);

/** 分栏预览时收紧编辑区内边距 */
export const lizhiCodeMirrorCompactTheme = EditorView.theme(
  {
    ".cm-content": {
      padding: "0.875rem 0 2rem",
    },
    ".cm-line": {
      padding: "0 0.875rem 0 1rem",
    },
    ".cm-gutterElement": {
      minWidth: "2.25rem",
      padding: "0 0.5rem 0 0.375rem",
    },
  },
);

export const lizhiMarkdownSyntax = syntaxHighlighting(lizhiMarkdownHighlight);
