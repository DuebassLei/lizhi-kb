import { computed, onUnmounted, ref, watch, type Ref } from "vue";
import { buildHeadingTree, type HeadingTreeNode } from "../utils/headings";

const DEFAULT_DEBOUNCE_MS = 160;

export function useHeadingTree(options: {
  title: Ref<string> | (() => string);
  content: Ref<string> | (() => string);
  debounceMs?: number;
}) {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const readTitle = () =>
    typeof options.title === "function" ? options.title() : options.title.value;
  const readContent = () =>
    typeof options.content === "function" ? options.content() : options.content.value;

  const tree = ref<HeadingTreeNode>(buildHeadingTree(readTitle(), readContent()));
  let timer: ReturnType<typeof setTimeout> | null = null;

  function refreshImmediate() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    tree.value = buildHeadingTree(readTitle(), readContent());
  }

  function scheduleRefresh() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      tree.value = buildHeadingTree(readTitle(), readContent());
    }, debounceMs);
  }

  watch(
    () => [readTitle(), readContent()] as const,
    () => scheduleRefresh(),
  );

  onUnmounted(() => {
    if (timer) clearTimeout(timer);
  });

  const headingCount = computed(() => countHeadings(tree.value));

  return { tree, headingCount, refreshImmediate };
}

function countHeadings(node: HeadingTreeNode): number {
  let n = node.isRoot ? 0 : 1;
  for (const child of node.children) n += countHeadings(child);
  return n;
}
