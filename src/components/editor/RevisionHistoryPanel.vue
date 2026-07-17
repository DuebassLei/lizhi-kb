<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { History, RotateCcw } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import { listDocumentRevisions, readDocumentRevision, type RevisionMeta } from "../../services/revisionService";
import { useDocumentsStore } from "../../stores/documents";
import { useUiStore } from "../../stores/ui";

const props = defineProps<{
  docId: string | null;
}>();

const documents = useDocumentsStore();
const ui = useUiStore();
const open = ref(false);
const loading = ref(false);
const items = ref<RevisionMeta[]>([]);
const rootRef = ref<HTMLElement | null>(null);

async function load() {
  if (!props.docId) {
    items.value = [];
    return;
  }
  loading.value = true;
  try {
    items.value = await listDocumentRevisions(props.docId);
  } finally {
    loading.value = false;
  }
}

function close() {
  if (!open.value) return;
  open.value = false;
}

function toggle() {
  open.value = !open.value;
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return;
  const root = rootRef.value;
  if (root && !root.contains(e.target as Node)) close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) {
    e.preventDefault();
    close();
  }
}

watch(() => props.docId, () => void load(), { immediate: true });

onMounted(() => {
  void load();
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
});

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function restore(revision: RevisionMeta) {
  if (!props.docId) return;
  if (!window.confirm(`恢复为 ${formatTime(revision.createdAt)} 的版本？当前未保存内容将被覆盖。`)) return;
  try {
    const content = await readDocumentRevision(props.docId, revision.id);
    documents.content = content;
    await documents.saveContent(content);
    ui.showToast("success", "已恢复历史版本");
    close();
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "恢复失败");
  }
}
</script>

<template>
  <div ref="rootRef" class="relative" data-testid="revision-history">
    <button
      type="button"
      class="focus-ring flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
      :disabled="!docId"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click.stop="toggle"
    >
      <History class="h-3.5 w-3.5" />
      历史版本
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-surface-1 p-2 shadow-2xl"
    >
      <p class="mb-2 text-xs font-medium text-[var(--color-text)]">历史版本</p>
      <div v-if="loading" class="py-4 text-center text-xs text-muted">加载中…</div>
      <p v-else-if="!items.length" class="py-4 text-center text-xs text-muted">暂无历史版本（保存后自动生成）</p>
      <ul v-else class="max-h-56 space-y-1 overflow-y-auto">
        <li
          v-for="item in items"
          :key="item.id"
          class="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-surface-2"
        >
          <span class="text-[var(--color-text)]">{{ formatTime(item.createdAt) }}</span>
          <Btn size="sm" variant="ghost" @click="restore(item)">
            <RotateCcw class="mr-1 h-3 w-3" />
            恢复
          </Btn>
        </li>
      </ul>
    </div>
  </div>
</template>
