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
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { countWords } from "../../services/documentService";
import { insertWikiLinkAtCursor } from "../../utils/markdownInsert";
import { useDocumentsStore } from "../../stores/documents";
import { useUiStore } from "../../stores/ui";
import { editorFindHighlight } from "../../extensions/editorFindHighlight";
import { wikiLinkAutocomplete } from "../../extensions/wikiLinkAutocomplete";
import { wikiLinkTitleAt } from "../../utils/wikiLinkAt";
import {
  extractClipboardImage,
  insertImageFromFile,
} from "../../utils/editorImageInsert";
import {
  lizhiCodeMirrorCompactTheme,
  lizhiCodeMirrorTheme,
  lizhiMarkdownSyntax,
} from "../../utils/codemirrorTheme";
import MarkdownEditorToolbar from "./MarkdownEditorToolbar.vue";
import WikiHoverPreview from "./WikiHoverPreview.vue";
import WikiSuggestPanel from "./WikiSuggestPanel.vue";

const props = defineProps<{
  modelValue: string;
  typewriter?: boolean;
  showToolbar?: boolean;
  /** 分栏预览时收紧内边距 */
  compact?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "word-count": [count: number];
}>();

const documents = useDocumentsStore();
const ui = useUiStore();
const hostRef = ref<HTMLElement | null>(null);
const editorView = ref<EditorView | null>(null);
const pastingImage = ref(false);

function emitContent(view: EditorView) {
  const value = view.state.doc.toString();
  emit("update:modelValue", value);
  emit("word-count", countWords(value));
}

async function handleClipboardImagePaste(view: EditorView, file: File) {
  if (pastingImage.value) return;
  pastingImage.value = true;
  try {
    await insertImageFromFile(view, file);
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "粘贴图片失败");
  } finally {
    pastingImage.value = false;
  }
}

function createView(parent: HTMLElement, doc: string) {
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        EditorView.lineWrapping,
        history(),
        markdown(),
        lizhiCodeMirrorTheme,
        ...(props.compact ? [lizhiCodeMirrorCompactTheme] : []),
        lizhiMarkdownSyntax,
        wikiLinkAutocomplete(),
        editorFindHighlight(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          {
            key: "Mod-Shift-l",
            run: (view) => {
              insertWikiLinkAtCursor(view);
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) emitContent(update.view);
        }),
        EditorView.domEventHandlers({
          paste(event, view) {
            const file = extractClipboardImage(event.clipboardData);
            if (!file) return false;
            event.preventDefault();
            void handleClipboardImagePaste(view, file);
            return true;
          },
          click(event) {
            const view = editorView.value;
            if (!view) return false;
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos == null) return false;
            const title = wikiLinkTitleAt(view.state.doc.toString(), pos);
            if (!title) return false;
            if (event.metaKey || event.ctrlKey) {
              void documents.openWikiLinkInNewTab(title);
            } else {
              void documents.openWikiLink(title);
            }
            return true;
          },
        }),
        EditorView.contentAttributes.of({
          "data-testid": "markdown-codemirror",
          spellcheck: "false",
        }),
      ],
    }),
    parent,
  });
}

onMounted(() => {
  if (!hostRef.value) return;
  editorView.value = createView(hostRef.value, props.modelValue);
  emit("word-count", countWords(props.modelValue));
});

watch(
  () => props.modelValue,
  (value) => {
    const view = editorView.value;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value === current) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  },
);

onBeforeUnmount(() => {
  editorView.value?.destroy();
  editorView.value = null;
});

function scrollToLine(lineIndex: number) {
  const view = editorView.value;
  if (!view) return;
  const line = view.state.doc.line(Math.min(lineIndex + 1, view.state.doc.lines));
  view.dispatch({
    effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    selection: { anchor: line.from },
  });
  view.focus();
}

defineExpose({ editorView, scrollToLine });
</script>

<template>
  <div
    class="editor-shell"
    :class="{
      'editor-shell--compact': compact,
      'editor-shell--split': compact,
      'editor-shell--typewriter': typewriter,
    }"
  >
    <MarkdownEditorToolbar
      v-if="showToolbar !== false && editorView"
      :view="(editorView as EditorView)"
    />
    <div class="relative flex min-h-0 flex-1 flex-col">
      <div ref="hostRef" class="cm-editor-host" />
      <WikiSuggestPanel :view="editorView as EditorView | null" />
      <WikiHoverPreview :view="editorView as EditorView | null" />
    </div>
  </div>
</template>
