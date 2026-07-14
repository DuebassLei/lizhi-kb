<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { DEFAULT_APP_ROUTE } from "../../router/constants";
import { useDocumentsStore } from "../../stores/documents";
import { useFoldersStore } from "../../stores/folders";
import { useJournalStore } from "../../stores/journal";
import { useFolderActions } from "../../composables/useFolderActions";
import { useDocumentDelete } from "../../composables/useDocumentDelete";
import { useFolderNameDialog } from "../../composables/useFolderNameDialog";
import { useUiStore } from "../../stores/ui";
import { useLinksStore } from "../../stores/links";
import { searchKnowledgeBase } from "../../services/knowledgeIndexService";
import { isTauriRuntime } from "../../services/vaultService";
import { matchesDocQuery } from "../../utils/textMatch";
import { searchDocuments, type SearchHit } from "../../utils/documentSearch";
import { exportDocument, EXPORT_FORMATS } from "../../utils/exportFile";
import { formatDayLabel, formatEntryTime } from "../../utils/journalDates";
import {
  filterJournalEntries,
  journalEntrySnippet,
  journalEntryTitle,
} from "../../utils/journalSearch";

const ui = useUiStore();
const documents = useDocumentsStore();
const folders = useFoldersStore();
const journal = useJournalStore();
const links = useLinksStore();
const { createSubfolder } = useFolderActions();
const { requestDelete } = useDocumentDelete();
const folderDialog = useFolderNameDialog();
const router = useRouter();

const query = ref("");
const selected = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const fullTextHits = ref<SearchHit[]>([]);
let fullTextSeq = 0;

watch(query, async () => {
  selected.value = 0;
  const q = query.value.trim();
  if (!q) {
    fullTextHits.value = [];
    return;
  }
  if (isTauriRuntime()) {
    const seq = ++fullTextSeq;
    fullTextHits.value = await searchKnowledgeBase(documents.tree, links.plainTextMap, q, 30);
    if (seq !== fullTextSeq) return;
    return;
  }
  void links.ensureIndex(documents.tree);
  fullTextHits.value = searchDocuments(documents.tree, links.plainTextMap, q, 30);
});

type Action = {
  id: string;
  label: string;
  hint?: string;
  run: () => void | Promise<unknown>;
};

const pinnedDocActions = computed(() => {
  const q = query.value.trim();
  return documents.pinnedDocs
    .filter((d) => matchesDocQuery(d.title, q))
    .map(
      (d): Action => ({
        id: `pin-${d.id}`,
        label: `★ ${d.title}`,
        hint: "固定文档",
        run: async () => {
          await router.push("/workspace");
          await documents.openDocument(d.id);
        },
      }),
    );
});

const recentDocActions = computed(() => {
  const q = query.value.trim();
  const pinnedSet = new Set(documents.pinnedIds);
  return documents.recentDocs
    .filter((d) => !pinnedSet.has(d.id) && matchesDocQuery(d.title, q))
    .slice(0, 6)
    .map(
      (d): Action => ({
        id: `recent-${d.id}`,
        label: d.title,
        hint: "最近打开",
        run: async () => {
          await router.push("/workspace");
          await documents.openDocument(d.id);
        },
      }),
    );
});

const moveActions = computed((): Action[] => {
  if (!documents.activeId) return [];
  const q = query.value.trim().toLowerCase();
  const doc = documents.tree.find((d) => d.id === documents.activeId);
  const currentFolder = doc ? folders.normalizeFolder(doc.folder) : "";
  const showMove =
    !q || q.includes("移动") || q.startsWith(">") || q.startsWith("到");

  if (!showMove && q) {
    const pathMatch = folders.flatFolders.some(
      (f) =>
        f.id !== currentFolder &&
        (matchesDocQuery(f.label, q) || folders.pathLabel(f.id).toLowerCase().includes(q)),
    );
    if (!pathMatch) return [];
  }

  return folders.flatFolders
    .filter((f) => f.id !== currentFolder)
    .filter((f) => {
      if (!q || q.includes("移动") || q.startsWith(">")) return true;
      return (
        matchesDocQuery(f.label, q) || folders.pathLabel(f.id).toLowerCase().includes(q)
      );
    })
    .map(
      (f): Action => ({
        id: `move-${f.id}`,
        label: `移动到 › ${folders.pathLabel(f.id)}`,
        hint: doc?.title ?? "当前文档",
        run: async () => {
          await router.push("/workspace");
          await documents.moveToFolder(documents.activeId!, f.id);
        },
      }),
    );
});

const fullTextActions = computed(() => {
  const q = query.value.trim();
  if (!q || links.indexing) return [];
  const pinnedSet = new Set(documents.pinnedIds);
  return fullTextHits.value
    .filter((hit) => !pinnedSet.has(hit.id))
    .map(
      (hit): Action => ({
        id: `search-${hit.id}`,
        label: hit.title,
        hint:
          hit.matchIn === "title"
            ? "标题匹配"
            : hit.matchIn === "both"
              ? hit.snippet
              : hit.snippet,
        run: async () => {
          await router.push("/workspace");
          await documents.openDocument(hit.id);
        },
      }),
    );
});

const journalSearchActions = computed((): Action[] => {
  const q = query.value.trim();
  if (!q) return [];
  return filterJournalEntries(journal.entries, q)
    .slice(0, 8)
    .map(
      (entry): Action => ({
        id: `journal-${entry.id}`,
        label: journalEntryTitle(entry),
        hint: `${formatDayLabel(entry.dayDate)} ${formatEntryTime(entry.createdAt)} · ${journalEntrySnippet(entry, q)}`,
        run: async () => {
          await router.push("/journal");
          journal.select(entry.id);
        },
      }),
    );
});

const journalQuickWriteAction = computed((): Action | null => {
  const q = query.value.trim();
  const match = q.match(/^小记[:：]?\s*(.+)$/s);
  const content = match?.[1]?.trim();
  if (!content) return null;
  const preview = content.split("\n")[0] ?? content;
  return {
    id: "journal-quick-write",
    label: `写小记：${preview.length > 36 ? `${preview.slice(0, 36)}…` : preview}`,
    hint: "立即保存",
    run: async () => {
      await journal.ensureLoaded();
      await journal.add(content);
    },
  };
});

const docActions = computed(() => {
  const q = query.value.trim();
  const pinnedSet = new Set(documents.pinnedIds);
  const fullTextIds = new Set(fullTextActions.value.map((a) => a.id.replace("search-", "")));
  return documents.tree
    .filter(
      (d) =>
        matchesDocQuery(d.title, q) &&
        !pinnedSet.has(d.id) &&
        !fullTextIds.has(d.id),
    )
    .slice(0, 8)
    .map(
      (d): Action => ({
        id: `doc-${d.id}`,
        label: d.title,
        hint: "打开文档",
        run: async () => {
          await router.push("/workspace");
          await documents.openDocument(d.id);
        },
      }),
    );
});

const staticActions = computed((): Action[] => {
  const q = query.value.trim().toLowerCase();
  const all: Action[] = [
    {
      id: "new-subfolder",
      label: "新建子目录",
      hint: folders.pathLabel(folders.selectedFolderId),
      run: async () => {
        await router.push("/workspace");
        const parent = folders.folders.find((f) => f.id === folders.selectedFolderId);
        const name = await folderDialog.promptCreateSubfolder(parent?.label);
        if (name) {
          const created = createSubfolder(folders.selectedFolderId, name);
          if (created) folders.selectFolder(created.id);
        }
      },
    },
    {
      id: "new",
      label: "新建文档",
      hint: "知识库",
      run: async () => {
        await router.push("/workspace");
        await documents.create();
      },
    },
    {
      id: "journal-new",
      label: "写小记",
      hint: "每日小记",
      run: async () => {
        await router.push({ path: "/journal", query: { compose: "1" } });
      },
    },
    {
      id: "journal",
      label: "每日小记",
      hint: "导航",
      run: () => router.push("/journal"),
    },
    {
      id: "insights",
      label: "写作看板",
      hint: "导航",
      run: () => router.push(DEFAULT_APP_ROUTE),
    },
    {
      id: "workspace",
      label: "个人知识库",
      hint: "导航",
      run: () => router.push("/workspace"),
    },
    {
      id: "settings",
      label: "设置",
      hint: "导航",
      run: () => router.push("/settings"),
    },
  ];

  if (documents.activeId) {
    const activeTitle = documents.tree.find((d) => d.id === documents.activeId)?.title;
    const pinned = documents.isPinned(documents.activeId);
    for (const format of EXPORT_FORMATS) {
      all.unshift({
        id: `export-${format.id}`,
        label: `导出为 ${format.label}`,
        hint: activeTitle,
        run: () => void exportDocument(activeTitle ?? "文档", documents.content, format.id),
      });
    }
    all.unshift({
      id: "toggle-pin",
      label: pinned ? "取消固定当前文档" : "固定当前文档",
      hint: activeTitle,
      run: () => documents.togglePin(documents.activeId!),
    });
    all.unshift({
      id: "delete",
      label: "删除当前文档",
      hint: activeTitle,
      run: async () => {
        const id = documents.activeId!;
        requestDelete(id);
      },
    });
  }

  return all.filter(
    (a) =>
      !q ||
      a.label.toLowerCase().includes(q) ||
      (a.hint?.toLowerCase().includes(q) ?? false) ||
      (a.id === "journal-new" && (q.includes("小记") || q.includes("日记"))),
  );
});

const items = computed(() => {
  const quickWrite = journalQuickWriteAction.value;
  return [
    ...(quickWrite ? [quickWrite] : []),
    ...journalSearchActions.value,
    ...moveActions.value,
    ...pinnedDocActions.value,
    ...recentDocActions.value,
    ...fullTextActions.value,
    ...docActions.value,
    ...staticActions.value,
  ];
});

watch(
  () => ui.commandPaletteOpen,
  async (open) => {
    if (open) {
      query.value = "";
      selected.value = 0;
      void journal.ensureLoaded();
      await nextTick();
      inputRef.value?.focus();
    }
  },
);

function close() {
  ui.commandPaletteOpen = false;
}

async function runItem(index: number) {
  const item = items.value[index];
  if (!item) return;
  close();
  await item.run();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    selected.value = Math.min(selected.value + 1, items.value.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selected.value = Math.max(selected.value - 1, 0);
  } else if (e.key === "Enter") {
    e.preventDefault();
    void runItem(selected.value);
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ui.commandPaletteOpen"
      class="fixed inset-0 z-[100] flex items-start justify-center bg-base/60 pt-[15vh] backdrop-blur-sm"
      @click.self="close"
    >
      <div
        class="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface-1"
        :style="{ boxShadow: 'var(--shadow-float)' }"
        role="dialog"
        aria-label="命令面板"
        data-testid="command-palette"
      >
        <input
          ref="inputRef"
          v-model="query"
          type="search"
          placeholder="搜索全文、小记或命令…（小记：内容 可快速保存）"
          class="field-input focus-ring w-full border-b border-border bg-transparent px-4 py-3 text-sm placeholder:text-muted"
          aria-controls="command-palette-list"
          aria-activedescendant="command-item-selected"
          @keydown="onKeydown"
        />
        <ul id="command-palette-list" class="max-h-72 overflow-y-auto py-1 text-sm" role="listbox">
          <li
            v-for="(item, i) in items"
            :id="i === selected ? 'command-item-selected' : undefined"
            :key="item.id"
            role="option"
            class="interactive-row flex items-center justify-between gap-3 px-4 py-2"
            :class="i === selected ? 'bg-surface-1 text-[var(--color-text)]' : 'text-muted hover:bg-surface-2/50'"
            :aria-selected="i === selected"
            :data-testid="item.id.startsWith('search-') ? 'search-result' : undefined"
            @click="runItem(i)"
            @mouseenter="selected = i"
          >
            <span class="min-w-0 truncate">{{ item.label }}</span>
            <span v-if="item.hint" class="max-w-[45%] shrink-0 truncate text-[10px] text-muted">{{ item.hint }}</span>
          </li>
          <li v-if="!items.length" class="px-4 py-8 text-center text-xs text-muted" role="status">
            <p>无匹配结果</p>
            <p class="mt-1 text-[10px]">试试其他关键词，或输入「移动」归类文档</p>
          </li>
        </ul>
        <p class="border-t border-border px-4 py-2 text-[10px] text-muted">
          ↑↓ 选择 · Enter 确认 · Esc 关闭
        </p>
      </div>
    </div>
  </Teleport>
</template>
