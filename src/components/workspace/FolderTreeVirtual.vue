<script setup lang="ts">
import { computed, inject, ref } from "vue";
import type { FlatFolderTree } from "../../utils/flattenFolderTree";
import { rowHeight } from "../../utils/flattenFolderTree";
import { SIDEBAR_SCROLL_KEY } from "../../constants/folderTree";
import { useVirtualScroll } from "../../composables/useVirtualScroll";
import FolderTreeVirtualRow from "./FolderTreeVirtualRow.vue";

const props = defineProps<{
  flatTree: FlatFolderTree;
}>();

defineEmits<{
  reorder: [folderId: string, docId: string, beforeDocId: string | null];
}>();

const sidebarScrollEl = inject(SIDEBAR_SCROLL_KEY, ref<HTMLElement | null>(null));

const totalHeight = computed(() => props.flatTree.totalHeight);
const offsets = computed(() => props.flatTree.offsets);
const heights = computed(() => props.flatTree.rows.map(rowHeight));

const { slice } = useVirtualScroll(sidebarScrollEl, totalHeight, offsets, heights);

const visibleRows = computed(() => {
  const { start, end } = slice.value;
  return props.flatTree.rows.slice(start, end).map((row, i) => ({
    row,
    top: props.flatTree.offsets[start + i] ?? 0,
  }));
});
</script>

<template>
  <div
    class="virtual-tree-body relative"
    :style="{ height: `${flatTree.totalHeight}px` }"
    data-testid="folder-tree-virtual"
  >
    <FolderTreeVirtualRow
      v-for="item in visibleRows"
      :key="item.row.key"
      :row="item.row"
      :top="item.top"
      @reorder="(fid, did, bid) => $emit('reorder', fid, did, bid)"
    />
  </div>
</template>
