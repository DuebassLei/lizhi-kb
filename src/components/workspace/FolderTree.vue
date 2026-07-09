<script setup lang="ts">
import { ChevronsDownUp, ChevronsUpDown, FolderPlus } from "@lucide/vue";
import { computed, ref } from "vue";
import type { FolderTreeNode as FolderNodeType } from "../../types/folder";
import { useFoldersStore } from "../../stores/folders";
import { useFolderActions } from "../../composables/useFolderActions";
import { FOLDER_TREE_VIRTUAL_THRESHOLD } from "../../constants/folderTree";
import { flattenFolderTree } from "../../utils/flattenFolderTree";
import FolderTreeNode from "./FolderTreeNode.vue";
import FolderTreeVirtual from "./FolderTreeVirtual.vue";

const props = defineProps<{
  nodes: FolderNodeType[];
  filterActive?: boolean;
}>();

const folders = useFoldersStore();
const { createSubfolder } = useFolderActions();
const showSubfolderInput = ref(false);
const subfolderName = ref("");

const flatTree = computed(() => flattenFolderTree(props.nodes, folders.isExpanded));
const useVirtual = computed(() => flatTree.value.rows.length >= FOLDER_TREE_VIRTUAL_THRESHOLD);

function promptSubfolder() {
  showSubfolderInput.value = true;
  subfolderName.value = "";
}

function confirmSubfolder() {
  const parentId = folders.selectedFolderId;
  const created = createSubfolder(parentId, subfolderName.value);
  if (created) {
    folders.selectFolder(created.id);
  }
  showSubfolderInput.value = false;
  subfolderName.value = "";
}

function cancelSubfolder() {
  showSubfolderInput.value = false;
  subfolderName.value = "";
}

function onDocDropReorder(folderId: string, docId: string, beforeDocId: string | null) {
  folders.onDocumentReordered(folderId, docId, beforeDocId);
}
</script>

<template>
  <div class="folder-tree" data-testid="folder-tree">
    <div class="tree-header mb-1.5 flex items-center justify-between gap-2 px-1">
      <p class="text-[10px] font-medium uppercase tracking-wider text-text-secondary">目录</p>
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          class="focus-ring tree-toolbar-btn"
          title="全部展开"
          aria-label="全部展开"
          data-testid="expand-all-folders"
          @click="folders.expandAll()"
        >
          <ChevronsDownUp :size="13" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="focus-ring tree-toolbar-btn"
          title="全部折叠"
          aria-label="全部折叠"
          data-testid="collapse-all-folders"
          @click="folders.collapseAll()"
        >
          <ChevronsUpDown :size="13" aria-hidden="true" />
        </button>
        <span class="mx-0.5 h-3 w-px bg-border" aria-hidden="true" />
        <button
          type="button"
          class="focus-ring tree-toolbar-btn"
          title="在选中目录下新建子目录"
          aria-label="新建子目录"
          data-testid="add-subfolder-btn"
          @click="promptSubfolder"
        >
          <FolderPlus :size="13" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div
      v-if="showSubfolderInput"
      class="mx-1 mb-2 flex gap-1.5 rounded-md border border-border bg-surface-1/60 p-1.5"
      data-testid="subfolder-form"
    >
      <input
        v-model="subfolderName"
        type="text"
        placeholder="子目录名称…"
        aria-label="子目录名称"
        class="field-input focus-ring min-w-0 flex-1 bg-transparent text-xs placeholder:text-muted"
        @keydown.enter="confirmSubfolder"
        @keydown.escape="cancelSubfolder"
      />
      <button type="button" class="focus-ring shrink-0 text-xs font-medium text-paw" @click="confirmSubfolder">
        添加
      </button>
    </div>

    <FolderTreeVirtual
      v-if="useVirtual"
      :flat-tree="flatTree"
      @reorder="onDocDropReorder"
    />
    <div v-else class="tree-body space-y-0.5">
      <FolderTreeNode
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        @reorder="onDocDropReorder"
      />
    </div>

    <p v-if="!nodes.length" class="px-2 py-4 text-center text-xs text-muted">暂无目录</p>
  </div>
</template>

<style scoped>
.folder-tree {
  --tree-indent: 10px;
  --tree-guide: 4px;
}

.tree-toolbar-btn {
  display: inline-flex;
  height: 1.375rem;
  width: 1.375rem;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  transition: background-color 120ms ease-out, color 120ms ease-out;
}

.tree-toolbar-btn:hover {
  background: var(--color-surface-2);
  color: var(--color-paw);
}
</style>
