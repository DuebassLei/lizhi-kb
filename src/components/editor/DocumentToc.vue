<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronDown, ChevronRight, ListTree } from "@lucide/vue";
import type { HeadingTreeNode } from "../../utils/headings";

const props = defineProps<{
  tree: HeadingTreeNode;
}>();

const emit = defineEmits<{
  select: [payload: { text: string; lineIndex: number }];
}>();

interface FlatTocRow {
  node: HeadingTreeNode;
  depth: number;
}

const activeKey = ref<string | null>(null);
/** 默认折叠；用标题序号作稳定 key，避免行号变动冲掉展开状态 */
const collapsedKeys = ref<Set<string>>(new Set());

const headingCount = computed(() => countNodes(props.tree));

function nodeCollapseKey(node: HeadingTreeNode): string {
  const m = /^h-(\d+)-/.exec(node.id);
  return m?.[1] ?? node.id;
}

function collectCollapsibleKeys(root: HeadingTreeNode): string[] {
  const keys: string[] = [];
  function walk(nodes: HeadingTreeNode[]) {
    for (const n of nodes) {
      if (!n.children.length) continue;
      keys.push(nodeCollapseKey(n));
      walk(n.children);
    }
  }
  walk(root.children ?? []);
  return keys;
}

const flatRows = computed(() => {
  const rows: FlatTocRow[] = [];
  function walk(nodes: HeadingTreeNode[], depth: number) {
    for (const node of nodes) {
      rows.push({ node, depth });
      if (node.children.length && !collapsedKeys.value.has(nodeCollapseKey(node))) {
        walk(node.children, depth + 1);
      }
    }
  }
  walk(props.tree.children ?? [], 0);
  return rows;
});

function countNodes(node: HeadingTreeNode): number {
  let n = node.isRoot ? 0 : 1;
  for (const c of node.children) n += countNodes(c);
  return n;
}

function levelIndent(depth: number) {
  return `${depth * 0.65}rem`;
}

function isCollapsed(node: HeadingTreeNode): boolean {
  return collapsedKeys.value.has(nodeCollapseKey(node));
}

function toggleCollapse(node: HeadingTreeNode) {
  const key = nodeCollapseKey(node);
  const next = new Set(collapsedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  collapsedKeys.value = next;
}

function onSelect(node: HeadingTreeNode) {
  if (node.lineIndex === undefined) return;
  activeKey.value = node.id;
  emit("select", { text: node.text, lineIndex: node.lineIndex });
}

watch(
  () => collectCollapsibleKeys(props.tree).join(","),
  (sig, prevSig) => {
    const keys = sig ? sig.split(",") : [];
    const prevKeys = new Set(prevSig ? prevSig.split(",") : []);
    const next = new Set(collapsedKeys.value);
    for (const key of keys) {
      if (!prevKeys.has(key)) next.add(key);
    }
    const valid = new Set(keys);
    for (const key of [...next]) {
      if (!valid.has(key)) next.delete(key);
    }
    collapsedKeys.value = next;
  },
  { immediate: true },
);

watch(
  () => props.tree.id + ":" + headingCount.value,
  () => {
    activeKey.value = null;
  },
);
</script>

<template>
  <aside
    class="toc-panel hidden w-60 shrink-0 self-stretch overflow-hidden border-l border-border bg-surface-0 lg:flex lg:flex-col"
    data-testid="document-toc"
  >
    <div class="toc-panel__header">
      <div class="flex min-w-0 items-center gap-1.5">
        <ListTree class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        <h3 class="text-[11px] font-semibold tracking-wide text-text-secondary">大纲</h3>
      </div>
      <span v-if="headingCount" class="tree-count-badge">{{ headingCount }}</span>
    </div>

    <nav class="toc-panel__body scrollbar-thin" aria-label="文档大纲">
      <ul v-if="headingCount" class="toc-list">
        <li
          v-for="{ node, depth } in flatRows"
          :key="node.id"
          class="toc-list__item"
          :style="{ '--toc-indent': levelIndent(depth) }"
        >
          <div class="flex min-w-0 items-stretch">
            <button
              v-if="node.children.length"
              type="button"
              class="focus-ring flex w-5 shrink-0 items-center justify-center text-muted hover:text-[var(--color-text)]"
              :aria-label="isCollapsed(node) ? '展开' : '折叠'"
              @click.stop="toggleCollapse(node)"
            >
              <ChevronRight
                v-if="isCollapsed(node)"
                class="size-3"
                aria-hidden="true"
              />
              <ChevronDown v-else class="size-3" aria-hidden="true" />
            </button>
            <span v-else class="w-5 shrink-0" aria-hidden="true" />

            <button
              type="button"
              class="toc-item focus-ring min-w-0 flex-1"
              :class="{
                'toc-item--active': activeKey === node.id,
                [`toc-item--h${node.level}`]: true,
              }"
              :title="node.text"
              @click="onSelect(node)"
            >
              <span class="toc-item__rail" aria-hidden="true" />
              <span class="toc-item__dot" aria-hidden="true" />
              <span class="toc-item__label">{{ node.text }}</span>
            </button>
          </div>
        </li>
      </ul>

      <div v-else class="toc-empty">
        <p class="text-xs leading-relaxed text-muted">本文暂无标题</p>
        <p class="mt-1.5 text-[11px] leading-relaxed text-muted/80">
          使用
          <code class="toc-empty__hint"># 标题</code>
          生成大纲导航
        </p>
      </div>
    </nav>
  </aside>
</template>
