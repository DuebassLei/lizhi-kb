import type { EditorView } from "@codemirror/view";
import { AI_PRIVATE_SNIPPET } from "./aiPrivacy";

export function insertAtCursor(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  view.focus();
}

export function wrapSelection(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const insert = before + selected + after;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
  view.focus();
}

/** 插入 [[ 并定位光标到括号内，触发双链补全 */
export function insertWikiLinkAtCursor(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const insert = "[[]]";
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + 2 },
  });
  view.focus();
}

export function insertWikiLinkTitle(view: EditorView, title: string) {
  const { from, to } = view.state.selection.main;
  const insert = `[[${title}]]`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
  view.focus();
}

export function prefixLines(view: EditorView, prefix: string) {
  const { from, to } = view.state.selection.main;
  const startLine = view.state.doc.lineAt(from).number;
  const endLine = view.state.doc.lineAt(to).number;
  const changes: { from: number; to: number; insert: string }[] = [];
  for (let n = startLine; n <= endLine; n += 1) {
    const line = view.state.doc.line(n);
    changes.push({ from: line.from, to: line.from, insert: prefix });
  }
  view.dispatch({ changes });
  view.focus();
}

const TABLE_TEMPLATE = `\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n`;
const TABLE_HEADER_PLACEHOLDER = "列1";

/** 插入 GFM 表格模板，并选中首个表头占位文本 */
export function insertTableAtCursor(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const headerStart = from + TABLE_TEMPLATE.indexOf(TABLE_HEADER_PLACEHOLDER);
  const headerEnd = headerStart + TABLE_HEADER_PLACEHOLDER.length;
  view.dispatch({
    changes: { from, to, insert: TABLE_TEMPLATE },
    selection: { anchor: headerStart, head: headerEnd },
  });
  view.focus();
}

/** 插入或包裹 :::ai-private 围栏 */
export function insertAiPrivate(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  if (!selected) {
    const anchorLine = "账号：";
    const anchorOffset = AI_PRIVATE_SNIPPET.indexOf(anchorLine) + anchorLine.length;
    view.dispatch({
      changes: { from, to, insert: AI_PRIVATE_SNIPPET },
      selection: { anchor: from + anchorOffset },
    });
  } else {
    const insert = `:::ai-private\n${selected}\n:::\n`;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    });
  }
  view.focus();
}
