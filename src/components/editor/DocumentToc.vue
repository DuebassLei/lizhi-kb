<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ListTree } from "@lucide/vue";
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

const headingCount = computed(() => countNodes(props.tree));

/** 始终展开：按树深度扁平化全部节点 */
const flatRows = computed(() => {
  const rows: FlatTocRow[] = [];
  function walk(nodes: HeadingTreeNode[], depth: number) {
    for (const node of nodes) {
      rows.push({ node, depth });
      if (node.children.length) walk(node.children, depth + 1);
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

function onSelect(node: HeadingTreeNode) {
  if (node.lineIndex === undefined) return;
  activeKey.value = node.id;
  emit("select", { text: node.text, lineIndex: node.lineIndex });
}

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
          <button
            type="button"
            class="toc-item focus-ring"
            :class="{
              'toc-item--active': activeKey === node.id,
              [`toc-item--h${node.level}`]: true,
            }"
            :title="node.text"
            @click="onSelect(node)"
          >
            <span class="toc-item__mark" aria-hidden="true" />
            <span class="toc-item__label">{{ node.text }}</span>
          </button>
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
