<script setup lang="ts">
import { Folder, Search, Star } from "@lucide/vue";
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
</script>

<template>
  <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
    <div class="sidebar-tools shrink-0 border-b border-border px-3 pb-3 pt-2.5">
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

    <div class="shrink-0 border-t border-border p-2">
      <button
        type="button"
        class="focus-ring mb-2 w-full rounded-md px-2 py-1 text-left text-[11px] text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
        data-testid="sidebar-asset-library-toggle"
        @click="assetLibraryOpen = !assetLibraryOpen"
      >
        {{ assetLibraryOpen ? "收起资产库" : "资产库" }}
      </button>
      <AssetLibraryPanel
        v-if="assetLibraryOpen"
        class="max-h-48"
        @insert="
          (md) => {
            documents.updateContent(
              documents.content + (documents.content.endsWith('\n') ? '' : '\n') + md + '\n',
            );
          }
        "
      />
    </div>
  </div>
</template>
