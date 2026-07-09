<script setup lang="ts">
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Inbox,
  Library,
  Star,
  Trash2,
} from "@lucide/vue";
import { computed } from "vue";
import type { FlatTreeRow } from "../../utils/flattenFolderTree";
import { rowHeight } from "../../utils/flattenFolderTree";
import { FOLDER_INBOX, FOLDER_PROJECTS } from "../../types/folder";
import {
  docRowPadding,
  folderRowPadding,
} from "../../constants/folderTree";
import { useFolderTreeRow } from "../../composables/useFolderTreeRow";
import { useDocumentDelete } from "../../composables/useDocumentDelete";

const props = defineProps<{
  row: FlatTreeRow;
  top: number;
}>();

const emit = defineEmits<{
  reorder: [folderId: string, docId: string, beforeDocId: string | null];
}>();

const folderNode = computed(() =>
  props.row.kind === "folder" ? props.row.node : props.row.folderNode,
);

const {
  documents,
  showFolderMenu,
  showDocMenu,
  isOpen,
  isSelected,
  isCustomFolder,
  hasContent,
  folderDragTarget,
  toggle,
  selectFolder,
  onDocDragStart,
  onFolderDragStart,
  onDragEnd,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  docDropTarget,
  onDocDragOver,
  onDocDragLeave,
  onDocDrop,
  handleExternalFileDrop,
  openDoc,
  onDocKeydown,
} = useFolderTreeRow(folderNode, (folderId, docId, beforeDocId) => {
  emit("reorder", folderId, docId, beforeDocId);
});

const { requestDelete } = useDocumentDelete();

const indentStyle = computed(() => {
  const depth = props.row.kind === "folder" ? props.row.node.depth : props.row.depth;
  return { paddingLeft: `${folderRowPadding(depth)}px` };
});

const docIndentStyle = computed(() => {
  if (props.row.kind !== "doc") return {};
  return { paddingLeft: `${docRowPadding(props.row.depth)}px` };
});

const rowStyle = computed(() => ({
  top: `${props.top}px`,
  height: `${rowHeight(props.row)}px`,
}));
</script>

<template>
  <div class="virtual-tree-row absolute left-0 right-0" :style="rowStyle">
    <!-- 目录行 -->
    <template v-if="row.kind === 'folder'">
      <div :data-folder-id="row.node.id">
        <div
          class="group relative flex h-[30px] items-center gap-0.5 rounded-md py-1 pr-1.5 tree-row-hover"
          :class="[
            isSelected ? 'tree-row-selected' : '',
            folderDragTarget?.position === 'into' ? 'bg-paw/10 ring-1 ring-paw/35' : '',
          ]"
          :style="indentStyle"
          :draggable="isCustomFolder"
          data-testid="folder-row"
          @dragstart="onFolderDragStart"
          @dragend="onDragEnd"
          @dragover="onFolderDragOver"
          @dragleave="onFolderDragLeave"
          @drop="onFolderDrop"
          @click="selectFolder"
          @contextmenu="showFolderMenu($event, row.node.id)"
        >
          <span
            v-if="folderDragTarget?.position === 'before'"
            class="pointer-events-none absolute left-1 right-1 top-0 h-0.5 rounded bg-paw"
            data-testid="folder-drop-before"
          />
          <span
            v-if="folderDragTarget?.position === 'after'"
            class="pointer-events-none absolute bottom-0 left-1 right-1 h-0.5 rounded bg-paw"
            data-testid="folder-drop-after"
          />

          <button
            type="button"
            class="focus-ring flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface-2/80 hover:text-text"
            :aria-expanded="hasContent ? isOpen : undefined"
            :aria-label="hasContent ? (isOpen ? '折叠目录' : '展开目录') : undefined"
            :tabindex="hasContent ? 0 : -1"
            @click.stop="toggle"
          >
            <ChevronRight
              v-if="hasContent"
              :size="12"
              class="transition-transform duration-150"
              :class="{ 'rotate-90': isOpen }"
              aria-hidden="true"
            />
          </button>

          <span class="flex h-4 w-4 shrink-0 items-center justify-center text-muted">
            <Inbox
              v-if="row.node.id === FOLDER_INBOX"
              :size="13"
              class="text-paw/80"
              aria-hidden="true"
            />
            <Library
              v-else-if="row.node.id === FOLDER_PROJECTS"
              :size="13"
              class="text-paw/80"
              aria-hidden="true"
            />
            <FolderOpen
              v-else-if="isOpen && hasContent"
              :size="13"
              class="text-text-secondary"
              aria-hidden="true"
            />
            <Folder v-else :size="13" class="text-text-secondary" aria-hidden="true" />
          </span>

          <span
            class="min-w-0 flex-1 truncate text-xs"
            :class="isSelected ? 'font-medium' : ''"
          >
            {{ row.node.label }}
          </span>

          <span v-if="row.node.documents.length" class="tree-count-badge mr-0.5">
            {{ row.node.documents.length }}
          </span>
        </div>
      </div>
    </template>

    <!-- 文档行 -->
    <template v-else-if="row.kind === 'doc'">
      <div :data-folder-id="row.folderId">
        <div
          draggable="true"
          role="button"
          tabindex="0"
          class="group/doc relative flex h-[30px] cursor-grab items-center gap-1 rounded-md py-1 pr-1.5 tree-row-hover focus-ring active:cursor-grabbing"
          :class="documents.activeId === row.doc.id ? 'tree-row-selected' : ''"
          :style="docIndentStyle"
          :aria-current="documents.activeId === row.doc.id ? 'page' : undefined"
          data-testid="folder-doc-item"
          @dragstart="onDocDragStart($event, row.doc.id)"
          @dragend="onDragEnd"
          @dragover="onDocDragOver($event, row.doc.id)"
          @dragleave="onDocDragLeave($event, row.doc.id)"
          @drop="onDocDrop($event, row.doc.id)"
          @click="openDoc(row.doc.id)"
          @keydown="onDocKeydown($event, row.doc.id)"
          @contextmenu="showDocMenu($event, row.doc.id)"
        >
          <span
            v-if="docDropTarget(row.doc.id)?.position === 'before'"
            class="pointer-events-none absolute left-2 right-1 top-0 h-0.5 rounded bg-paw"
            data-testid="doc-drop-indicator"
          />
          <span
            v-if="docDropTarget(row.doc.id)?.position === 'after'"
            class="pointer-events-none absolute bottom-0 left-2 right-1 h-0.5 rounded bg-paw"
            data-testid="doc-drop-indicator-after"
          />
          <FileText :size="12" class="shrink-0 text-muted" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-xs" :title="row.doc.title">{{ row.doc.title }}</span>
          <button
            type="button"
            class="focus-ring ml-auto hidden shrink-0 rounded p-0.5 text-muted hover:bg-surface-1 hover:text-paw group-hover/doc:inline-flex"
            :title="documents.isPinned(row.doc.id) ? '取消固定' : '固定'"
            :aria-label="documents.isPinned(row.doc.id) ? '取消固定' : '固定'"
            @click.stop="documents.togglePin(row.doc.id)"
          >
            <Star
              :size="11"
              :class="documents.isPinned(row.doc.id) ? 'fill-paw text-paw' : ''"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            class="focus-ring hidden shrink-0 rounded p-0.5 text-muted hover:bg-surface-1 hover:text-danger group-hover/doc:inline-flex"
            title="删除"
            aria-label="删除文档"
            @click.stop="requestDelete(row.doc.id)"
          >
            <Trash2 :size="11" aria-hidden="true" />
          </button>
        </div>
      </div>
    </template>

    <!-- 空目录占位 -->
    <template v-else>
      <div :data-folder-id="row.folderId">
        <div
          class="tree-empty-state virtual-empty"
          role="status"
          data-testid="folder-empty-drop-zone"
          :style="{ marginLeft: `${docRowPadding(row.depth)}px` }"
          @dragover="onFolderDragOver"
          @dragleave="onFolderDragLeave"
          @drop="handleExternalFileDrop"
        >
          <Inbox
            v-if="row.folderId === FOLDER_INBOX"
            :size="18"
            class="text-paw/60"
            aria-hidden="true"
          />
          <Folder v-else :size="18" class="text-muted/70" aria-hidden="true" />
          <p class="text-[11px] font-medium text-text-secondary">
            {{ row.folderId === FOLDER_INBOX ? "收件箱为空" : "目录为空" }}
          </p>
          <p class="text-[10px] leading-relaxed text-muted">拖入文档，或点击上方「新建文档」</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.virtual-empty {
  min-height: 68px;
}
</style>
