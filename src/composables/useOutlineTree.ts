import { computed, onUnmounted, ref, watch, type Ref } from "vue";
import type { HeadingTreeNode } from "../utils/headings";
import { buildOutlineTree, countOutlineNodes } from "../utils/outlineTree";

const DEFAULT_DEBOUNCE_MS = 160;

/** 导图用：标题 + 正文 + 列表的幕布式大纲树 */
export function useOutlineTree(options: {
  title: Ref<string> | (() => string);
  content: Ref<string> | (() => string);
  debounceMs?: number;
}) {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const readTitle = () =>
    typeof options.title === "function" ? options.title() : options.title.value;
  const readContent = () =>
    typeof options.content === "function" ? options.content() : options.content.value;

  const tree = ref<HeadingTreeNode>(buildOutlineTree(readTitle(), readContent()));
  let timer: ReturnType<typeof setTimeout> | null = null;

  function refreshImmediate() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    tree.value = buildOutlineTree(readTitle(), readContent());
  }

  function scheduleRefresh() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      tree.value = buildOutlineTree(readTitle(), readContent());
    }, debounceMs);
  }

  watch(
    () => [readTitle(), readContent()] as const,
    () => scheduleRefresh(),
  );

  onUnmounted(() => {
    if (timer) clearTimeout(timer);
  });

  const nodeCount = computed(() => countOutlineNodes(tree.value));

  return { tree, nodeCount, refreshImmediate };
}
