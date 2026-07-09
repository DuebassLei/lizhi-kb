import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

export interface FindConfig {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
}

export const setFindConfig = StateEffect.define<FindConfig | null>();
export const setFindActiveMatch = StateEffect.define<number>();

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildFindRegex(config: FindConfig): RegExp | null {
  if (!config.query) return null;
  const body = escapeRegex(config.query);
  const source = config.wholeWord ? `\\b${body}\\b` : body;
  const flags = config.caseSensitive ? "g" : "gi";
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

export function collectFindMatches(doc: string, config: FindConfig): { from: number; to: number }[] {
  const re = buildFindRegex(config);
  if (!re) return [];
  const matches: { from: number; to: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc)) !== null) {
    matches.push({ from: m.index, to: m.index + m[0].length });
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return matches;
}

const findConfigField = StateField.define<FindConfig | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setFindConfig)) return effect.value;
    }
    return value;
  },
});

const findActiveField = StateField.define<number>({
  create: () => -1,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setFindActiveMatch)) return effect.value;
    }
    return value;
  },
});

const findMatchMark = Decoration.mark({ class: "cm-find-match" });
const findMatchActiveMark = Decoration.mark({ class: "cm-find-match cm-find-match--active" });

function buildFindDecorations(doc: string, config: FindConfig | null, activeIndex: number): DecorationSet {
  if (!config?.query) return Decoration.none;
  const matches = collectFindMatches(doc, config);
  if (!matches.length) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]!;
    builder.add(match.from, match.to, i === activeIndex ? findMatchActiveMark : findMatchMark);
  }
  return builder.finish();
}

const findHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    if (
      tr.docChanged ||
      tr.effects.some((effect) => effect.is(setFindConfig) || effect.is(setFindActiveMatch))
    ) {
      const config = tr.state.field(findConfigField);
      const activeIndex = tr.state.field(findActiveField);
      return buildFindDecorations(tr.state.doc.toString(), config, activeIndex);
    }
    return deco.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function emitFindMeta(view: EditorView) {
  const config = view.state.field(findConfigField);
  const active = view.state.field(findActiveField);
  const total = config?.query ? collectFindMatches(view.state.doc.toString(), config).length : 0;
  view.dom.dispatchEvent(
    new CustomEvent("find-meta-change", { detail: { total, active }, bubbles: false }),
  );
}

const findMetaPlugin = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      emitFindMeta(view);
    }

    update(update: ViewUpdate) {
      const configChanged = update.transactions.some((tr) =>
        tr.effects.some((effect) => effect.is(setFindConfig) || effect.is(setFindActiveMatch)),
      );
      if (update.docChanged || configChanged) {
        emitFindMeta(update.view);
      }
    }
  },
);

export const editorFindHighlight = () => [
  findConfigField,
  findActiveField,
  findHighlightField,
  findMetaPlugin,
];
