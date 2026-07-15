<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, ChevronRight } from "@lucide/vue";
import type { HeadingTreeNode } from "../../utils/headings";
import { parseTopicLabel } from "../../utils/mindmap/parseTopicLabel";

const props = defineProps<{
  tree: HeadingTreeNode;
  selectedId: string | null;
  collapsedIds: Set<string>;
}>();

const emit = defineEmits<{
  select: [node: HeadingTreeNode];
  toggle: [id: string];
  open: [node: HeadingTreeNode];
}>();

interface FlatRow {
  node: HeadingTreeNode;
  depth: number;
  label: ReturnType<typeof parseTopicLabel>;
}

const rows = computed(() => {
  const out: FlatRow[] = [];
  function walk(nodes: HeadingTreeNode[], depth: number) {
    for (const node of nodes) {
      out.push({ node, depth, label: parseTopicLabel(node.text) });
      if (node.children.length && !props.collapsedIds.has(node.id)) {
        walk(node.children, depth + 1);
      }
    }
  }
  walk(props.tree.children ?? [], 0);
  return out;
});

const rootLabel = computed(() => parseTopicLabel(props.tree.text));

function depthClass(depth: number) {
  const d = Math.min(4, Math.max(0, depth));
  return `mm-ol-row--d${d}`;
}
</script>

<template>
  <div class="mm-outline" data-testid="mindmap-outline-notes">
    <header class="mm-outline__root">
      <h2 class="mm-outline__root-title">
        <span>{{ rootLabel.title }}</span>
        <span v-for="tag in rootLabel.tags" :key="tag" class="mm-tag">#{{ tag }}</span>
      </h2>
    </header>

    <ul v-if="rows.length" class="mm-outline__list" role="tree">
      <li
        v-for="{ node, depth, label } in rows"
        :key="node.id"
        class="mm-ol-row"
        :class="[
          depthClass(depth),
          {
            'mm-ol-row--selected': selectedId === node.id,
            'mm-ol-row--has-children': node.children.length > 0,
          },
        ]"
        :style="{ '--mm-ol-depth': String(depth) }"
        role="treeitem"
        :aria-expanded="node.children.length ? !collapsedIds.has(node.id) : undefined"
      >
        <div class="mm-ol-row__main">
          <button
            v-if="node.children.length"
            type="button"
            class="mm-ol-collapse focus-ring"
            :aria-label="collapsedIds.has(node.id) ? '展开' : '折叠'"
            @click.stop="emit('toggle', node.id)"
          >
            <ChevronRight v-if="collapsedIds.has(node.id)" class="size-3.5" aria-hidden="true" />
            <ChevronDown v-else class="size-3.5" aria-hidden="true" />
          </button>
          <span v-else class="mm-ol-collapse mm-ol-collapse--spacer" aria-hidden="true" />

          <button
            type="button"
            class="mm-ol-topic focus-ring"
            @click="emit('select', node)"
            @dblclick="emit('open', node)"
          >
            <span class="mm-ol-bullet" aria-hidden="true" />
            <span class="mm-ol-text">
              <span class="mm-ol-title">{{ label.title }}</span>
              <span
                v-for="tag in label.tags"
                :key="`${node.id}-${tag}`"
                class="mm-tag"
              >#{{ tag }}</span>
            </span>
            <span
              v-if="node.children.length && collapsedIds.has(node.id)"
              class="mm-ol-count"
            >{{ node.children.length }}</span>
          </button>
        </div>

        <p v-if="node.note" class="mm-ol-note">
          {{ node.note }}
        </p>
      </li>
    </ul>

    <div v-else class="mm-outline__empty">
      <p>暂无大纲主题</p>
      <p class="mm-outline__empty-hint">
        在编辑器用 <code># 标题</code> 或 <code>- 列表</code> 组织内容
      </p>
    </div>
  </div>
</template>
