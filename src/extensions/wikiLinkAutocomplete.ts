import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { filterWikiSuggestions, NEW_DOC_SUGGEST_ID, type WikiSuggestion } from "../composables/useWikiSuggest";
import { wikiLinkQueryAt } from "../utils/wikiLinkQuery";

export interface WikiSuggestState {
  open: boolean;
  from: number;
  to: number;
  query: string;
  items: WikiSuggestion[];
  selected: number;
}

const pluginMeta = ViewPlugin.fromClass(
  class {
    state: WikiSuggestState = {
      open: false,
      from: 0,
      to: 0,
      query: "",
      items: [],
      selected: 0,
    };

    update(update: ViewUpdate) {
      if (!update.docChanged && !update.selectionSet) return;
      const view = update.view;
      const pos = view.state.selection.main.head;
      const text = view.state.doc.toString();
      const q = wikiLinkQueryAt(text, pos);
      if (!q) {
        if (this.state.open) this.state = { ...this.state, open: false, items: [] };
        return;
      }
      const items = filterWikiSuggestions(q.query, 10);
      this.state = {
        open: true,
        from: q.from,
        to: q.to,
        query: q.query,
        items,
        selected: 0,
      };
    }
  },
  {
    eventHandlers: {
      keydown(event, view) {
        const plugin = view.plugin(pluginMeta);
        if (!plugin?.state.open) return false;

        const { items, selected, from, to } = plugin.state;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          plugin.state = {
            ...plugin.state,
            selected: Math.min(selected + 1, items.length - 1),
          };
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          plugin.state = {
            ...plugin.state,
            selected: Math.max(selected - 1, 0),
          };
          return true;
        }
        if (event.key === "Escape") {
          plugin.state = { ...plugin.state, open: false, items: [] };
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const pick = items[selected];
          if (!pick) return true;
          const insertTitle = pick.isNew ? pick.title : pick.title;
          const replacement = `${insertTitle}]]`;
          view.dispatch({
            changes: { from, to, insert: replacement },
            selection: { anchor: from + replacement.length },
          });
          plugin.state = { ...plugin.state, open: false, items: [] };
          return true;
        }
        return false;
      },
    },
  },
);

const wikiSuggestTheme = EditorView.baseTheme({
  ".wiki-suggest-panel": {
    position: "fixed",
    zIndex: "120",
    minWidth: "12rem",
    maxWidth: "20rem",
    maxHeight: "14rem",
    overflowY: "auto",
    borderRadius: "0.375rem",
    border: "1px solid var(--color-border)",
    backgroundColor: "var(--color-surface-1)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    fontSize: "0.8125rem",
  },
  ".wiki-suggest-item": {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "0.375rem 0.625rem",
    cursor: "pointer",
    color: "var(--color-text-secondary)",
  },
  ".wiki-suggest-item--active": {
    backgroundColor: "var(--color-surface-2)",
    color: "var(--color-link)",
  },
  ".wiki-suggest-item--new": {
    fontStyle: "italic",
  },
});

/** 渲染 [[ 补全下拉（挂载在 editor-shell 内） */
export const wikiSuggestHostClass = "wiki-suggest-host";

export function wikiLinkAutocomplete() {
  return [pluginMeta, wikiSuggestTheme];
}

export { pluginMeta as wikiSuggestPlugin };

export function getWikiSuggestState(view: EditorView): WikiSuggestState | null {
  const plugin = view.plugin(pluginMeta);
  return plugin?.state ?? null;
}

/** 视口坐标，配合 Teleport + position:fixed 定位补全面板 */
export function wikiSuggestCoords(view: EditorView, from: number): { left: number; top: number } | null {
  const coords = view.coordsAtPos(from);
  if (!coords) return null;
  return {
    left: coords.left,
    top: coords.bottom + 4,
  };
}

export function applyWikiSuggestion(view: EditorView, pick: WikiSuggestion, from: number, to: number) {
  const replacement = `${pick.title}]]`;
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: { anchor: from + replacement.length },
  });
  const plugin = view.plugin(pluginMeta);
  if (plugin) plugin.state = { ...plugin.state, open: false, items: [] };
}

export { NEW_DOC_SUGGEST_ID };
