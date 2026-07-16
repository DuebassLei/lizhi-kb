<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  placeholder,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const props = defineProps<{
  modelValue: string;
  /** 外部切到 CSS Tab 时递增，触发 focus */
  focusTick?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const hostRef = ref<HTMLElement | null>(null);
let view: EditorView | null = null;
let syncing = false;

const cssHighlight = HighlightStyle.define([
  { tag: tags.comment, color: "#6b7280", fontStyle: "italic" },
  { tag: tags.keyword, color: "#c792ea" },
  { tag: tags.definitionKeyword, color: "#c792ea" },
  { tag: tags.propertyName, color: "#82aaff" },
  { tag: tags.attributeName, color: "#82aaff" },
  { tag: tags.variableName, color: "#f78c6c" },
  { tag: tags.className, color: "#ffcb6b" },
  { tag: tags.tagName, color: "#f07178" },
  { tag: tags.string, color: "#c3e88d" },
  { tag: tags.number, color: "#f78c6c" },
  { tag: tags.unit, color: "#f78c6c" },
  { tag: tags.color, color: "#f78c6c" },
  { tag: tags.operator, color: "#89ddff" },
  { tag: tags.punctuation, color: "#89ddff" },
  { tag: tags.meta, color: "#89ddff" },
  { tag: tags.atom, color: "#ffcb6b" },
  { tag: tags.literal, color: "#c3e88d" },
]);

const cssEditorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "transparent",
      color: "#e8edf5",
      fontSize: "0.8125rem",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: 'ui-monospace, "JetBrains Mono", Consolas, monospace',
      lineHeight: "1.45",
    },
    ".cm-content": {
      caretColor: "var(--color-paw)",
      padding: "0.85rem 0",
      minHeight: "320px",
    },
    ".cm-line": {
      padding: "0 0.9rem 0 0.35rem",
    },
    ".cm-gutters": {
      backgroundColor: "color-mix(in srgb, #000 22%, transparent)",
      color: "color-mix(in srgb, #9aa4b2 70%, transparent)",
      border: "none",
      borderRight: "1px solid color-mix(in srgb, #fff 8%, transparent)",
    },
    ".cm-gutterElement": {
      padding: "0 0.55rem 0 0.4rem",
      minWidth: "2.4rem",
      fontSize: "0.75rem",
      fontVariantNumeric: "tabular-nums",
      lineHeight: "1.45",
    },
    ".cm-activeLineGutter": {
      color: "#c5ced9",
      backgroundColor: "color-mix(in srgb, var(--color-paw) 14%, transparent)",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, #fff 4%, transparent)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-paw)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "color-mix(in srgb, var(--color-paw) 28%, transparent) !important",
    },
    ".cm-placeholder": {
      color: "color-mix(in srgb, #9aa4b2 65%, transparent)",
    },
  },
  { dark: true },
);

function createView(parent: HTMLElement, doc: string) {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        css(),
        syntaxHighlighting(cssHighlight),
        cssEditorTheme,
        placeholder(".knowledge-card {\n  background: ...;\n}"),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || syncing) return;
          emit("update:modelValue", update.state.doc.toString());
        }),
      ],
    }),
  });
}

function setDoc(next: string) {
  if (!view) return;
  const cur = view.state.doc.toString();
  if (cur === next) return;
  syncing = true;
  view.dispatch({
    changes: { from: 0, to: cur.length, insert: next },
  });
  syncing = false;
}

function focus() {
  view?.requestMeasure();
  view?.focus();
}

defineExpose({ focus });

onMounted(() => {
  if (!hostRef.value) return;
  view = createView(hostRef.value, props.modelValue ?? "");
});

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});

watch(
  () => props.modelValue,
  (v) => setDoc(v ?? ""),
);

watch(
  () => props.focusTick,
  (tick) => {
    if (tick == null || tick <= 0) return;
    // v-show 切到 CSS Tab 后需重新测量高度
    requestAnimationFrame(() => focus());
  },
);
</script>

<template>
  <div
    ref="hostRef"
    class="kc-theme-css-editor"
    data-testid="kc-theme-css-editor"
  />
</template>

<style scoped>
.kc-theme-css-editor {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.kc-theme-css-editor :deep(.cm-editor) {
  height: 100%;
  min-height: 320px;
}
</style>
