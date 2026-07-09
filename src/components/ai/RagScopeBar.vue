<script setup lang="ts">
import { computed } from "vue";
import { AlertCircle, BookOpen, FileText, FolderOpen } from "@lucide/vue";
import { useChatStore, type RagSurface } from "../../stores/chat";
import { useDocumentsStore } from "../../stores/documents";
import { useFoldersStore } from "../../stores/folders";
import type { RagScope } from "../../services/aiService";

const { compact = false, surface = "workspace" } = defineProps<{
  compact?: boolean;
  surface?: RagSurface;
}>();

const chat = useChatStore();
const documents = useDocumentsStore();
const folders = useFoldersStore();

const isStandalone = computed(() => surface === "standalone");

const scopes: {
  id: RagScope;
  label: string;
  shortLabel: string;
  icon: typeof BookOpen;
}[] = [
  { id: "all", label: "全库", shortLabel: "全库", icon: BookOpen },
  { id: "currentDocument", label: "当前文档", shortLabel: "文档", icon: FileText },
  { id: "currentFolder", label: "当前文件夹", shortLabel: "文件夹", icon: FolderOpen },
];

const activeDoc = computed(() =>
  documents.tree.find((d) => d.id === documents.activeId),
);

const docCount = computed(() => documents.tree.length);

const scopeContext = computed(() => {
  if (isStandalone.value) {
    return docCount.value > 0 ? `共 ${docCount.value} 篇笔记` : null;
  }
  if (chat.ragScope === "currentDocument") {
    return activeDoc.value?.title ?? null;
  }
  if (chat.ragScope === "currentFolder") {
    const folderId = activeDoc.value?.folder ?? folders.selectedFolderId;
    return folders.pathLabel(folderId);
  }
  return docCount.value > 0 ? `共 ${docCount.value} 篇笔记` : null;
});

const scopeWarning = computed(() => {
  if (isStandalone.value) return null;
  if (chat.ragScope === "currentDocument" && !activeDoc.value) {
    return "当前未打开文档，将改为全库检索";
  }
  if (chat.ragScope === "currentFolder") {
    const folderId = activeDoc.value?.folder ?? folders.selectedFolderId;
    const docsInFolder = documents.tree.filter((d) => d.folder === folderId).length;
    if (docsInFolder === 0) return "当前文件夹内暂无笔记";
  }
  return null;
});

function selectScope(scope: RagScope) {
  chat.setRagScope(scope);
}
</script>

<template>
  <div :class="compact ? 'space-y-1.5' : 'space-y-2.5'">
    <div v-if="isStandalone" class="space-y-1">
      <div
        class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-2.5 py-1.5 text-xs text-[var(--color-text)]"
      >
        <BookOpen class="h-3.5 w-3.5 text-link" aria-hidden="true" />
        <span class="font-medium">全库检索</span>
        <span v-if="docCount > 0" class="text-muted">· {{ docCount }} 篇笔记</span>
      </div>
      <p class="text-[10px] leading-relaxed text-muted">
        独立对话页无编辑上下文，始终搜索全部笔记
      </p>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-if="!compact"
          class="shrink-0 text-xs font-medium text-muted"
        >
          检索范围
        </span>
        <div
          class="inline-flex rounded-lg border border-border bg-surface-0 p-0.5"
          role="group"
          aria-label="检索范围"
        >
          <button
            v-for="s in scopes"
            :key="s.id"
            type="button"
            class="focus-ring inline-flex items-center gap-1 rounded-md transition-colors"
            :class="[
              compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
              chat.ragScope === s.id
                ? 'bg-link/15 font-medium text-link shadow-sm'
                : 'text-muted hover:bg-surface-2 hover:text-[var(--color-text)]',
            ]"
            :aria-pressed="chat.ragScope === s.id"
            :data-testid="`rag-scope-${s.id}`"
            @click="selectScope(s.id)"
          >
            <component :is="s.icon" class="h-3 w-3 shrink-0" aria-hidden="true" />
            {{ compact ? s.shortLabel : s.label }}
          </button>
        </div>
      </div>

      <div
        v-if="scopeContext || scopeWarning"
        class="flex flex-wrap items-start gap-2 rounded-md border border-divider bg-surface-0 px-2.5 py-2"
        :class="compact ? 'text-[10px]' : 'text-xs'"
      >
        <p
          v-if="scopeContext && !scopeWarning"
          class="min-w-0 flex-1 leading-relaxed text-muted"
        >
          <span class="text-[var(--color-text)]/70">上下文 · </span>
          <span class="text-[var(--color-text)]">{{ scopeContext }}</span>
        </p>

        <p
          v-if="scopeWarning"
          class="flex min-w-0 flex-1 items-center gap-1.5 text-amber-400"
        >
          <AlertCircle class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{{ scopeWarning }}</span>
        </p>
      </div>
    </template>
  </div>
</template>
