<script setup lang="ts">

import { Search, Star } from "@lucide/vue";

import { computed, provide, ref, watch } from "vue";

import { useDocumentsStore } from "../../stores/documents";

import { useFoldersStore } from "../../stores/folders";

import { useUiStore } from "../../stores/ui";

import { useLinksStore } from "../../stores/links";

import { searchKnowledgeBase } from "../../services/knowledgeIndexService";

import { searchDocuments } from "../../utils/documentSearch";
import { filterDocsByTag, listAllTags } from "../../utils/documentTags";
import { getTagPillClass } from "../../utils/tagColor";
import NewDocMenu from "./NewDocMenu.vue";

import { isTauriRuntime } from "../../services/vaultService";

import type { SearchHit } from "../../utils/documentSearch";

import { SIDEBAR_SCROLL_KEY } from "../../constants/folderTree";

import FolderTree from "./FolderTree.vue";
import AssetLibraryPanel from "./AssetLibraryPanel.vue";



const documents = useDocumentsStore();

const folders = useFoldersStore();

const ui = useUiStore();

const links = useLinksStore();

const creating = ref(false);
const filter = ref("");
const selectedTag = ref<string | null>(null);
const tagsExpanded = ref(false);
const assetLibraryOpen = ref(false);

/** 折叠时预览数量；展开后显示全部并在容器内滚动 */
const TAGS_PREVIEW_COUNT = 6;

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



const allTags = computed(() => listAllTags());

const hasMoreTags = computed(() => allTags.value.length > TAGS_PREVIEW_COUNT);

const visibleTags = computed(() => {
  const tags = allTags.value;
  if (tagsExpanded.value) return tags;
  const preview = tags.slice(0, TAGS_PREVIEW_COUNT);
  const sel = selectedTag.value;
  if (sel && !preview.includes(sel)) {
    return [...preview.slice(0, TAGS_PREVIEW_COUNT - 1), sel];
  }
  return preview;
});

const tagFilteredDocs = computed(() => {
  if (!selectedTag.value) return [];
  const ids = filterDocsByTag(
    documents.tree.map((doc) => doc.id),
    selectedTag.value,
  );
  const idSet = new Set(ids);
  return documents.tree.filter((doc) => idSet.has(doc.id));
});

async function handleCreate(templateId?: string) {
  creating.value = true;
  try {
    await documents.create("无标题", folders.selectedFolderId, { templateId });
  } finally {
    creating.value = false;
  }
}

function toggleTagFilter(tag: string) {
  selectedTag.value = selectedTag.value === tag ? null : tag;
}



</script>



<template>

  <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">

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



    <div class="relative shrink-0 border-b border-border px-3 py-2">
      <NewDocMenu :disabled="creating" :busy="creating" @create="handleCreate" />

      <p v-if="!filterActive" class="mt-1 truncate text-[10px] text-muted">
        将创建于：{{ folders.folders.find((f) => f.id === folders.selectedFolderId)?.label ?? "收件箱" }}
      </p>

      <div v-if="allTags.length && !filterActive" class="mt-2" data-testid="sidebar-tag-filter">
        <div
          class="doc-tags-row flex flex-wrap gap-1 overflow-y-auto overscroll-contain"
          :class="tagsExpanded ? 'max-h-24' : 'max-h-12'"
        >
          <button
            v-for="tag in visibleTags"
            :key="tag"
            type="button"
            :class="[getTagPillClass(tag), selectedTag === tag ? 'ring-1 ring-link/40' : '']"
            @click="toggleTagFilter(tag)"
          >
            {{ tag }}
          </button>
        </div>
        <button
          v-if="hasMoreTags"
          type="button"
          class="focus-ring mt-1 text-[10px] text-link hover:underline"
          data-testid="sidebar-tag-filter-toggle"
          @click="tagsExpanded = !tagsExpanded"
        >
          {{ tagsExpanded ? "收起" : `展开 (+${allTags.length - TAGS_PREVIEW_COUNT})` }}
        </button>
      </div>
    </div>



    <nav
      ref="sidebarScrollRef"
      class="doc-tree-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 text-sm"
      data-testid="doc-tree"
      aria-label="文档目录"
    >

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



      <!-- 标签筛选 -->
      <template v-else-if="selectedTag">
        <p class="mb-2 px-2 text-[10px] text-muted">
          标签「{{ selectedTag }}」共 {{ tagFilteredDocs.length }} 篇
          <button type="button" class="ml-1 text-link hover:underline" @click="selectedTag = null">
            清除
          </button>
        </p>
        <ul class="space-y-0.5">
          <li
            v-for="doc in tagFilteredDocs"
            :key="doc.id"
            role="button"
            tabindex="0"
            class="interactive-row group flex flex-col rounded-sm px-2 py-1.5 hover:bg-surface-2"
            :class="documents.activeId === doc.id ? 'tree-row-selected' : 'tree-row-hover'"
            data-testid="sidebar-tag-result"
            @click="documents.setActive(doc.id)"
            @keydown.enter="documents.setActive(doc.id)"
          >
            <span class="min-w-0 truncate text-xs">{{ doc.title }}</span>
            <span class="mt-0.5 text-[9px] text-muted">{{ folderLabel(doc.folder) }}</span>
          </li>
          <li v-if="!tagFilteredDocs.length" class="px-2 py-6 text-center text-xs text-muted">
            该标签下暂无文档
          </li>
        </ul>
      </template>

      <!-- 目录树 -->
      <FolderTree v-else :nodes="folderTreeNodes" />

    </nav>

    <div v-if="!filterActive && !selectedTag" class="shrink-0 border-t border-border p-2">
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
        @insert="(md) => { documents.updateContent(documents.content + (documents.content.endsWith('\n') ? '' : '\n') + md + '\n'); }"
      />
    </div>

  </div>

</template>


