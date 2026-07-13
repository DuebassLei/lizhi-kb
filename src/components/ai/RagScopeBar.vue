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
    return docCount.value > 0 ? `${docCount.value} 篇笔记` : null;
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

const standaloneHint = "检索笔记后回答并附引用 · 独立页始终全库搜索";

function selectScope(scope: RagScope) {
  chat.setRagScope(scope);
}
</script>

<template>
  <div
    class="rag-scope-bar"
    :class="compact ? 'rag-scope-bar--compact' : 'rag-scope-bar--regular'"
    data-testid="rag-scope-bar"
  >
    <template v-if="isStandalone">
      <span class="rag-scope-bar__badge">
        <BookOpen class="rag-scope-bar__badge-icon" aria-hidden="true" />
        <span class="rag-scope-bar__badge-label">全库检索</span>
        <span v-if="docCount > 0" class="rag-scope-bar__badge-meta">· {{ docCount }} 篇</span>
      </span>
      <span class="rag-scope-bar__hint" :title="standaloneHint">
        {{ standaloneHint }}
      </span>
    </template>

    <template v-else>
      <div
        class="rag-scope-bar__group"
        role="group"
        aria-label="检索范围"
      >
        <button
          v-for="s in scopes"
          :key="s.id"
          type="button"
          class="rag-scope-bar__scope focus-ring"
          :class="{ 'rag-scope-bar__scope--active': chat.ragScope === s.id }"
          :aria-pressed="chat.ragScope === s.id"
          :data-testid="`rag-scope-${s.id}`"
          @click="selectScope(s.id)"
        >
          <component :is="s.icon" class="rag-scope-bar__scope-icon" aria-hidden="true" />
          {{ compact ? s.shortLabel : s.label }}
        </button>
      </div>

      <p
        v-if="scopeWarning"
        class="rag-scope-bar__status rag-scope-bar__status--warn"
      >
        <AlertCircle class="rag-scope-bar__status-icon" aria-hidden="true" />
        <span class="rag-scope-bar__status-text">{{ scopeWarning }}</span>
      </p>
      <p
        v-else-if="scopeContext"
        class="rag-scope-bar__status"
        :title="`上下文 · ${scopeContext}`"
      >
        <span class="rag-scope-bar__status-label">上下文</span>
        <span class="rag-scope-bar__status-text">{{ scopeContext }}</span>
      </p>
    </template>
  </div>
</template>

<style scoped>
.rag-scope-bar {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.625rem;
}

.rag-scope-bar--compact {
  font-size: 0.625rem;
}

.rag-scope-bar--regular {
  font-size: 0.75rem;
}

.rag-scope-bar__badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.375rem;
  border-radius: 9999px;
  border: 1px solid color-mix(in srgb, var(--color-link) 22%, var(--color-border));
  background: color-mix(in srgb, var(--color-link) 8%, var(--color-surface-0));
  padding: 0.25rem 0.625rem;
  color: var(--color-text);
  white-space: nowrap;
}

.rag-scope-bar__badge-icon {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--color-link);
}

.rag-scope-bar__badge-label {
  font-weight: 600;
}

.rag-scope-bar__badge-meta {
  color: var(--color-muted);
  font-weight: 400;
}

.rag-scope-bar__hint {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-muted);
  line-height: 1.35;
}

.rag-scope-bar__group {
  display: inline-flex;
  flex-shrink: 0;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.125rem;
}

.rag-scope-bar__scope {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 0;
  border-radius: 0.375rem;
  background: transparent;
  padding: 0.25rem 0.5rem;
  color: var(--color-muted);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.rag-scope-bar--regular .rag-scope-bar__scope {
  padding: 0.3125rem 0.625rem;
}

.rag-scope-bar__scope:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}

.rag-scope-bar__scope--active {
  background: color-mix(in srgb, var(--color-link) 15%, transparent);
  color: var(--color-link);
  font-weight: 600;
}

.rag-scope-bar__scope-icon {
  width: 0.75rem;
  height: 0.75rem;
  flex-shrink: 0;
}

.rag-scope-bar__status {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.375rem;
  margin: 0;
  color: var(--color-muted);
  line-height: 1.35;
}

.rag-scope-bar__status--warn {
  color: var(--color-warning);
}

.rag-scope-bar__status-icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}

.rag-scope-bar__status-label {
  flex-shrink: 0;
  color: color-mix(in srgb, var(--color-text) 55%, var(--color-muted));
}

.rag-scope-bar__status-label::after {
  content: " · ";
}

.rag-scope-bar__status-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
}

.rag-scope-bar__status--warn .rag-scope-bar__status-text {
  color: inherit;
}
</style>
