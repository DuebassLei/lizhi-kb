<script setup lang="ts">
import { Folder, Images, Search, Star, Trash2 } from "@lucide/vue";
import { computed, provide, ref } from "vue";

import { useDocumentsStore } from "../../stores/documents";
import { useFoldersStore } from "../../stores/folders";
import { useUiStore } from "../../stores/ui";
import NewDocMenu from "./NewDocMenu.vue";
import { SIDEBAR_SCROLL_KEY } from "../../constants/folderTree";
import FolderTree from "./FolderTree.vue";
import AssetLibraryPanel from "./AssetLibraryPanel.vue";

const documents = useDocumentsStore();
const folders = useFoldersStore();
const ui = useUiStore();

const creating = ref(false);
const assetLibraryOpen = ref(false);

const sidebarScrollRef = ref<HTMLElement | null>(null);
provide(SIDEBAR_SCROLL_KEY, sidebarScrollRef);

const commandPaletteShortcut = computed(() =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)
    ? "⌘K"
    : "Ctrl+K",
);

const createTargetLabel = computed(
  () => folders.folders.find((f) => f.id === folders.selectedFolderId)?.label ?? "收件箱",
);

const folderTreeNodes = computed(() => folders.buildTree(documents.tree));
const trashActive = computed(() => ui.workspaceViewMode === "trash");

async function handleCreate(templateId?: string) {
  creating.value = true;
  try {
    await documents.create("无标题", folders.selectedFolderId, { templateId });
  } finally {
    creating.value = false;
  }
}

function openSearch() {
  ui.commandPaletteOpen = true;
}

function openTrash() {
  assetLibraryOpen.value = false;
  ui.setWorkspaceView("trash");
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
    <div class="sidebar-tools relative z-20 shrink-0 overflow-visible border-b border-border px-3 pb-3 pt-2.5">
      <button
        type="button"
        class="sidebar-cmd-trigger focus-ring mb-2.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left"
        aria-label="搜索文档、全文或命令"
        data-testid="sidebar-search"
        @click="openSearch"
      >
        <Search :size="14" class="shrink-0 text-muted" aria-hidden="true" />
        <span class="flex-1 truncate text-xs text-muted">搜索全文、文档或命令…</span>
        <kbd class="sidebar-kbd">{{ commandPaletteShortcut }}</kbd>
      </button>

      <NewDocMenu :disabled="creating" :busy="creating" @create="handleCreate" />

      <div
        class="sidebar-create-hint mt-2 flex min-w-0 items-center gap-1.5 px-0.5"
        title="新文档将创建于此文件夹"
      >
        <Folder :size="11" class="shrink-0 text-muted" aria-hidden="true" />
        <span class="truncate text-[10px] text-muted">
          创建于
          <span class="font-medium text-text-secondary">{{ createTargetLabel }}</span>
        </span>
      </div>
    </div>

    <nav
      ref="sidebarScrollRef"
      class="doc-tree-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 text-sm"
      data-testid="doc-tree"
      aria-label="文档目录"
    >
      <template v-if="documents.pinnedDocs.length">
        <p class="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-text-secondary">固定</p>
        <ul class="mb-3 space-y-0.5" data-testid="pinned-docs">
          <li
            v-for="doc in documents.pinnedDocs"
            :key="`pin-${doc.id}`"
            role="button"
            tabindex="0"
            class="interactive-row group flex items-center rounded-sm py-1.5 pr-2 hover:bg-surface-2"
            :class="[
              documents.activeId === doc.id ? 'tree-row-selected px-2' : 'px-2 tree-row-hover',
            ]"
            :aria-current="documents.activeId === doc.id ? 'page' : undefined"
            @click="documents.setActive(doc.id)"
            @keydown.enter="documents.setActive(doc.id)"
            @keydown.space.prevent="documents.setActive(doc.id)"
          >
            <Star :size="12" class="mr-1 shrink-0 fill-paw text-paw" aria-label="已固定" />
            <span class="min-w-0 flex-1 truncate">{{ doc.title }}</span>
            <button
              type="button"
              class="focus-ring ml-1 hidden shrink-0 rounded px-1 text-[10px] text-muted hover:text-paw group-hover:inline"
              title="取消固定"
              aria-label="取消固定"
              @click.stop="documents.togglePin(doc.id)"
            >
              <Star :size="10" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </template>

      <FolderTree :nodes="folderTreeNodes" />
    </nav>

    <div class="sidebar-assets shrink-0 border-t border-border p-2">
      <button
        type="button"
        class="sidebar-assets__toggle focus-ring mb-2"
        :class="{ 'sidebar-assets__toggle--open': trashActive }"
        data-testid="sidebar-trash-toggle"
        :aria-pressed="trashActive"
        @click="openTrash"
      >
        <Trash2 class="sidebar-assets__icon" aria-hidden="true" />
        <span class="sidebar-assets__label">回收站</span>
      </button>
      <button
        type="button"
        class="sidebar-assets__toggle focus-ring"
        :class="{ 'sidebar-assets__toggle--open': assetLibraryOpen }"
        data-testid="sidebar-asset-library-toggle"
        :aria-expanded="assetLibraryOpen"
        @click="assetLibraryOpen = !assetLibraryOpen"
      >
        <Images class="sidebar-assets__icon" aria-hidden="true" />
        <span class="sidebar-assets__label">{{ assetLibraryOpen ? "收起资产库" : "资产库" }}</span>
      </button>
      <AssetLibraryPanel
        v-if="assetLibraryOpen"
        class="max-h-[min(50vh,22rem)]"
        @insert="(md) => ui.requestEditorInsert(md)"
      />
    </div>
  </div>
</template>

<style scoped>
.sidebar-assets__toggle {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-1);
  padding: 0.375rem 0.5rem;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.sidebar-assets__toggle:hover {
  background: var(--color-surface-2);
  border-color: var(--color-border-strong);
}

.sidebar-assets__toggle--open {
  border-color: color-mix(in srgb, var(--color-link) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-link) 10%, var(--color-surface-1));
}

.sidebar-assets__icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  color: var(--color-link);
}

.sidebar-assets__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.01em;
}

.sidebar-assets__toggle:hover .sidebar-assets__label,
.sidebar-assets__toggle--open .sidebar-assets__label {
  color: var(--color-text);
}
</style>
