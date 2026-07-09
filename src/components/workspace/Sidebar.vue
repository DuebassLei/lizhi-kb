<script setup lang="ts">

import { Plus, Search, Star } from "@lucide/vue";

import { computed, provide, ref, watch } from "vue";

import { useDocumentsStore } from "../../stores/documents";

import { useFoldersStore } from "../../stores/folders";

import { useUiStore } from "../../stores/ui";

import { useLinksStore } from "../../stores/links";

import { searchKnowledgeBase } from "../../services/knowledgeIndexService";

import { searchDocuments } from "../../utils/documentSearch";

import { isTauriRuntime } from "../../services/vaultService";

import type { SearchHit } from "../../utils/documentSearch";

import { SIDEBAR_SCROLL_KEY } from "../../constants/folderTree";

import FolderTree from "./FolderTree.vue";



const documents = useDocumentsStore();

const folders = useFoldersStore();

const ui = useUiStore();

const links = useLinksStore();

const creating = ref(false);

const filter = ref("");

const sidebarScrollRef = ref<HTMLElement | null>(null);
provide(SIDEBAR_SCROLL_KEY, sidebarScrollRef);



const filterActive = computed(() => filter.value.trim().length > 0);

const commandPaletteShortcut = computed(() =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)
    ? "⌘K"
    : "Ctrl+K",
);



const searchHits = ref<SearchHit[]>([]);
let searchSeq = 0;

watch(
  () => filter.value.trim(),
  async (q) => {
    if (!q) {
      searchHits.value = [];
      return;
    }
    if (isTauriRuntime()) {
      const seq = ++searchSeq;
      searchHits.value = await searchKnowledgeBase(documents.tree, links.plainTextMap, q, 50);
      if (seq !== searchSeq) return;
      return;
    }
    void links.ensureIndex(documents.tree);
    searchHits.value = searchDocuments(documents.tree, links.plainTextMap, q, 50);
  },
);



const filteredPinned = computed(() => {

  const q = filter.value.trim();

  if (!q) return documents.pinnedDocs;

  const hitIds = new Set(searchHits.value.map((h) => h.id));

  return documents.pinnedDocs.filter((d) => hitIds.has(d.id));

});



const folderTreeNodes = computed(() => folders.buildTree(documents.tree));



const folderLabel = (folderId: string) => folders.pathLabel(folderId);



async function handleCreate() {

  creating.value = true;

  try {

    await documents.create("无标题", folders.selectedFolderId);

  } finally {

    creating.value = false;

  }

}



</script>



<template>

  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">

    <div class="shrink-0 border-b border-border px-3 py-2">

      <button
        type="button"
        class="focus-ring mb-2 flex w-full items-center gap-2 rounded-md border border-border bg-surface-1/50 px-2 py-1.5 text-left transition-colors hover:bg-surface-2/60"
        aria-label="打开命令面板"
        @click="ui.commandPaletteOpen = true"
      >
        <Search :size="14" class="shrink-0 text-muted" aria-hidden="true" />
        <span class="flex-1 truncate text-xs text-muted">搜索…</span>
        <kbd class="sidebar-kbd">{{ commandPaletteShortcut }}</kbd>
      </button>

      <input

        v-model="filter"

        type="search"

        placeholder="全文搜索…"

        aria-label="全文搜索"

        class="input-field focus-ring text-xs"

        data-testid="sidebar-filter"

      />

    </div>



    <div class="shrink-0 border-b border-border px-3 py-2">

      <button
        type="button"
        data-testid="new-doc-btn"
        class="focus-ring flex w-full items-center gap-1.5 rounded-md bg-paw/15 px-2 py-1.5 text-left text-xs text-paw transition-colors hover:bg-paw/25 disabled:opacity-50"
        :disabled="creating"
        :aria-busy="creating"
        aria-label="新建文档"
        @click="handleCreate"
      >
        <Plus :size="12" aria-hidden="true" />
        <span>{{ creating ? "创建中…" : "新建文档" }}</span>
      </button>

      <p v-if="!filterActive" class="mt-1 truncate text-[10px] text-muted">

        将创建于：{{ folders.folders.find((f) => f.id === folders.selectedFolderId)?.label ?? "收件箱" }}

      </p>

    </div>



    <nav ref="sidebarScrollRef" class="flex-1 overflow-y-auto p-2 text-sm" data-testid="doc-tree">

      <!-- 固定 -->

      <template v-if="filteredPinned.length">

        <p class="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-text-secondary">固定</p>

        <ul class="mb-3 space-y-0.5" data-testid="pinned-docs">

          <li

            v-for="doc in filteredPinned"

            :key="`pin-${doc.id}`"

            role="button"

            tabindex="0"

            class="interactive-row group flex items-center rounded-sm py-1.5 pr-2 hover:bg-surface-2"

            :class="[
              documents.activeId === doc.id
                ? 'tree-row-selected px-2'
                : 'px-2 tree-row-hover',
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



      <!-- 搜索模式：扁平列表 -->

      <template v-if="filterActive">

        <p v-if="links.indexing" class="px-2 py-1 text-[10px] text-muted" role="status">
          正在建立全文索引…
        </p>

        <p class="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-text-secondary">

          搜索结果 ({{ searchHits.length }})

        </p>

        <ul class="space-y-0.5">

          <li

            v-for="hit in searchHits"

            :key="hit.id"

            role="button"

            tabindex="0"

            class="interactive-row group flex flex-col rounded-sm py-1.5 pr-2 hover:bg-surface-2"

            :class="[
              documents.activeId === hit.id
                ? 'tree-row-selected px-2'
                : 'px-2 tree-row-hover',
            ]"

            :aria-current="documents.activeId === hit.id ? 'page' : undefined"

            data-testid="sidebar-search-result"

            @click="documents.setActive(hit.id)"

            @keydown.enter="documents.setActive(hit.id)"

            @keydown.space.prevent="documents.setActive(hit.id)"

          >

            <span class="min-w-0 truncate text-xs">{{ hit.title }}</span>

            <span class="mt-0.5 truncate text-[10px] text-muted">{{ hit.snippet }}</span>

            <span class="mt-0.5 text-[9px] text-muted">{{ folderLabel(documents.tree.find((d) => d.id === hit.id)?.folder ?? '') }}</span>

          </li>

          <li v-if="!searchHits.length" class="px-2 py-6 text-center text-xs text-muted" role="status">

            <p>无匹配文档</p>

            <p class="mt-1 text-[10px]">尝试其他关键词</p>

          </li>

        </ul>

      </template>



      <!-- 目录树 -->

      <FolderTree v-else :nodes="folderTreeNodes" />

    </nav>

  </div>

</template>


