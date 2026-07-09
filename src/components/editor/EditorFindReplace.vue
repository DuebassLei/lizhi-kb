<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { EditorView } from "@codemirror/view";
import { EditorView as CMEditorView } from "@codemirror/view";
import { Search } from "@lucide/vue";
import {
  buildFindRegex,
  collectFindMatches,
  setFindActiveMatch,
  setFindConfig,
  type FindConfig,
} from "../../extensions/editorFindHighlight";

const props = defineProps<{
  view: EditorView | null;
}>();

const open = ref(false);
const findQuery = ref("");
const replaceQuery = ref("");
const caseSensitive = ref(false);
const wholeWord = ref(false);
const matchCount = ref(0);
const activeMatchIndex = ref(-1);
const findInputRef = ref<HTMLInputElement | null>(null);

const matchLabel = computed(() => {
  if (!findQuery.value.trim()) return "";
  if (matchCount.value === 0) return "未找到";
  if (activeMatchIndex.value < 0) return `${matchCount.value} 处`;
  return `${activeMatchIndex.value + 1}/${matchCount.value}`;
});

function currentConfig(): FindConfig | null {
  const query = findQuery.value;
  if (!query) return null;
  return { query, caseSensitive: caseSensitive.value, wholeWord: wholeWord.value };
}

function syncFindConfig() {
  const view = props.view;
  if (!view) return;
  view.dispatch({ effects: setFindConfig.of(open.value ? currentConfig() : null) });
}

function clearFindState() {
  matchCount.value = 0;
  activeMatchIndex.value = -1;
  const view = props.view;
  if (!view) return;
  view.dispatch({ effects: [setFindConfig.of(null), setFindActiveMatch.of(-1)] });
}

function goToMatch(index: number) {
  const view = props.view;
  const config = currentConfig();
  if (!view || !config) return;
  const matches = collectFindMatches(view.state.doc.toString(), config);
  if (!matches.length) {
    activeMatchIndex.value = -1;
    view.dispatch({ effects: setFindActiveMatch.of(-1) });
    return;
  }
  const normalized = ((index % matches.length) + matches.length) % matches.length;
  const match = matches[normalized]!;
  activeMatchIndex.value = normalized;
  view.dispatch({
    selection: { anchor: match.from, head: match.to },
    effects: [setFindActiveMatch.of(normalized), CMEditorView.scrollIntoView(match.from, { y: "center" })],
  });
  view.focus();
}

function findRelativeIndex(next: boolean): number {
  const view = props.view;
  const config = currentConfig();
  if (!view || !config) return -1;
  const matches = collectFindMatches(view.state.doc.toString(), config);
  if (!matches.length) return -1;
  const { from, to } = view.state.selection.main;
  if (next) {
    const idx = matches.findIndex((match) => match.from >= to);
    return idx >= 0 ? idx : 0;
  }
  let idx = -1;
  for (let i = 0; i < matches.length; i += 1) {
    if (matches[i]!.from < from) idx = i;
    else break;
  }
  return idx >= 0 ? idx : matches.length - 1;
}

function refreshFind(jumpToFirst = false) {
  syncFindConfig();
  const view = props.view;
  const config = currentConfig();
  if (!view || !open.value || !config) {
    matchCount.value = 0;
    activeMatchIndex.value = -1;
    return;
  }
  const matches = collectFindMatches(view.state.doc.toString(), config);
  matchCount.value = matches.length;
  if (!matches.length) {
    activeMatchIndex.value = -1;
    view.dispatch({ effects: setFindActiveMatch.of(-1) });
    return;
  }
  if (jumpToFirst) {
    goToMatch(0);
    return;
  }
  if (activeMatchIndex.value < 0 || activeMatchIndex.value >= matches.length) {
    goToMatch(findRelativeIndex(true));
    return;
  }
  view.dispatch({ effects: setFindActiveMatch.of(activeMatchIndex.value) });
}

function runFind(next = true) {
  if (!findQuery.value) return;
  goToMatch(findRelativeIndex(next));
}

function runReplace() {
  const view = props.view;
  const config = currentConfig();
  if (!view || !config) return;
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to);
  const re = buildFindRegex(config);
  if (!re || !re.test(selected)) {
    runFind(true);
    return;
  }
  re.lastIndex = 0;
  view.dispatch({
    changes: { from, to, insert: replaceQuery.value },
    selection: { anchor: from + replaceQuery.value.length },
  });
  refreshFind(false);
  runFind(true);
  view.focus();
}

function runReplaceAll() {
  const view = props.view;
  const config = currentConfig();
  if (!view || !config) return;
  const re = buildFindRegex(config);
  if (!re) return;
  const doc = view.state.doc.toString();
  const replaced = doc.replace(re, replaceQuery.value);
  if (replaced === doc) return;
  view.dispatch({
    changes: { from: 0, to: doc.length, insert: replaced },
  });
  refreshFind(false);
  view.focus();
}

function onFindMeta(event: Event) {
  const detail = (event as CustomEvent<{ total: number; active: number }>).detail;
  matchCount.value = detail.total;
  if (detail.active >= 0) activeMatchIndex.value = detail.active;
}

function attachMetaListener(view: EditorView) {
  view.dom.addEventListener("find-meta-change", onFindMeta);
}

function detachMetaListener(view: EditorView) {
  view.dom.removeEventListener("find-meta-change", onFindMeta);
}

async function toggle() {
  open.value = !open.value;
  if (!open.value) {
    clearFindState();
    return;
  }
  await nextTick();
  findInputRef.value?.focus();
  findInputRef.value?.select();
  refreshFind(true);
}

watch(
  () => props.view,
  (view, prev) => {
    if (prev) detachMetaListener(prev);
    if (!view) {
      open.value = false;
      clearFindState();
      return;
    }
    attachMetaListener(view);
    if (open.value) refreshFind(false);
  },
);

watch([findQuery, caseSensitive, wholeWord], () => {
  if (!open.value) return;
  refreshFind(true);
});

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) clearFindState();
    else syncFindConfig();
  },
);

onBeforeUnmount(() => {
  if (props.view) detachMetaListener(props.view);
  clearFindState();
});

defineExpose({ toggle, open });
</script>

<template>
  <div v-if="open" class="border-b border-border bg-surface-0 px-3 py-2" data-testid="find-replace-bar">
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <Search :size="14" class="text-muted" aria-hidden="true" />
      <input
        ref="findInputRef"
        v-model="findQuery"
        type="search"
        placeholder="查找"
        class="input-field focus-ring min-w-[8rem] flex-1 py-1 text-xs"
        data-testid="find-input"
        @keydown.enter.prevent="runFind(true)"
        @keydown.shift.enter.prevent="runFind(false)"
      />
      <span
        v-if="matchLabel"
        class="min-w-[3.5rem] tabular-nums text-muted"
        data-testid="find-match-count"
        aria-live="polite"
      >
        {{ matchLabel }}
      </span>
      <input
        v-model="replaceQuery"
        type="text"
        placeholder="替换为"
        class="input-field focus-ring min-w-[8rem] flex-1 py-1 text-xs"
        @keydown.enter.prevent="runReplace"
      />
      <label class="flex items-center gap-1 text-muted">
        <input v-model="caseSensitive" type="checkbox" class="accent-link" />
        区分大小写
      </label>
      <label class="flex items-center gap-1 text-muted">
        <input v-model="wholeWord" type="checkbox" class="accent-link" data-testid="find-whole-word" />
        整词
      </label>
      <button type="button" class="focus-ring rounded px-2 py-1 hover:bg-surface-2" @click="runFind(false)">
        上一个
      </button>
      <button type="button" class="focus-ring rounded px-2 py-1 hover:bg-surface-2" @click="runFind(true)">
        下一个
      </button>
      <button type="button" class="focus-ring rounded px-2 py-1 hover:bg-surface-2" @click="runReplace">替换</button>
      <button type="button" class="focus-ring rounded px-2 py-1 hover:bg-surface-2" @click="runReplaceAll">全部</button>
      <button type="button" class="focus-ring rounded px-2 py-1 text-muted hover:bg-surface-2" @click="open = false">
        关闭
      </button>
    </div>
  </div>
</template>
