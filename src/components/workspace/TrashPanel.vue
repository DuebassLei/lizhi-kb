<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RotateCcw, Trash2, XCircle } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import ConfirmDialog from "../common/ConfirmDialog.vue";
import { useDocumentsStore } from "../../stores/documents";
import { useDocumentDelete } from "../../composables/useDocumentDelete";
import type { TrashedDocumentMeta } from "../../types/document";
import {
  getTrashRetentionDays,
  listTrashedDocuments,
  purgeExpiredDocuments,
} from "../../services/documentService";

const documents = useDocumentsStore();
const { requestPurgeTrashed } = useDocumentDelete();

const items = ref<TrashedDocumentMeta[]>([]);
const retentionDays = ref(30);
const loading = ref(true);
const emptyConfirmOpen = ref(false);
const busy = ref(false);
const error = ref("");
let openedOnce = false;

function formatDeletedAt(ms: number): string {
  try {
    return new Date(ms).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ms);
  }
}

function remainingDays(deletedAt: number): number {
  const expireAt = deletedAt + retentionDays.value * 24 * 60 * 60 * 1000;
  const left = Math.ceil((expireAt - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, left);
}

async function refresh(runExpired = false) {
  loading.value = true;
  error.value = "";
  try {
    if (runExpired) await purgeExpiredDocuments();
    retentionDays.value = await getTrashRetentionDays();
    items.value = await listTrashedDocuments();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载回收站失败";
  } finally {
    loading.value = false;
  }
}

async function onRestore(id: string) {
  busy.value = true;
  error.value = "";
  try {
    await documents.restore(id);
    items.value = items.value.filter((d) => d.id !== id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "恢复失败";
  } finally {
    busy.value = false;
  }
}

async function confirmEmpty() {
  emptyConfirmOpen.value = false;
  busy.value = true;
  error.value = "";
  try {
    await documents.emptyTrash();
    items.value = [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : "清空失败";
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  openedOnce = true;
  void refresh(true);
});

watch(
  () => documents.trashTick,
  () => {
    if (!openedOnce) return;
    void refresh(false);
  },
);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col" data-testid="trash-panel">
    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div>
        <h2 class="text-sm font-semibold text-[var(--color-text)]">回收站</h2>
        <p class="mt-0.5 text-xs text-muted">
          保留 {{ retentionDays }} 天；到期自动清理。软删文档可在此恢复。
        </p>
      </div>
      <Btn
        variant="ghost"
        size="sm"
        class="text-danger"
        :disabled="busy || items.length === 0"
        data-testid="trash-empty-btn"
        @click="emptyConfirmOpen = true"
      >
        清空回收站
      </Btn>
    </div>

    <p v-if="error" class="px-4 py-2 text-xs text-danger" role="alert">{{ error }}</p>

    <div v-if="loading" class="flex flex-1 items-center justify-center text-sm text-muted">
      加载中…
    </div>

    <div
      v-else-if="items.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-2 text-muted"
      data-testid="trash-empty"
    >
      <Trash2 :size="28" class="opacity-40" aria-hidden="true" />
      <p class="text-sm">回收站为空</p>
    </div>

    <ul v-else class="min-h-0 flex-1 overflow-y-auto p-2" data-testid="trash-list">
      <li
        v-for="doc in items"
        :key="doc.id"
        class="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-surface-2"
        :data-testid="`trash-item-${doc.id}`"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-[var(--color-text)]">{{ doc.title || "无标题" }}</p>
          <p class="mt-0.5 truncate text-[11px] text-muted">
            {{ doc.folder || "收件箱" }} · 删除于 {{ formatDeletedAt(doc.deletedAt) }} · 剩余
            {{ remainingDays(doc.deletedAt) }} 天
          </p>
        </div>
        <button
          type="button"
          class="focus-ring inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-link hover:bg-surface-1"
          :disabled="busy"
          data-testid="trash-restore-btn"
          @click="onRestore(doc.id)"
        >
          <RotateCcw :size="12" aria-hidden="true" />
          恢复
        </button>
        <button
          type="button"
          class="focus-ring inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-danger hover:bg-surface-1"
          :disabled="busy"
          data-testid="trash-purge-btn"
          @click="requestPurgeTrashed(doc.id, doc.title || '无标题')"
        >
          <XCircle :size="12" aria-hidden="true" />
          永久删除
        </button>
      </li>
    </ul>

    <ConfirmDialog
      :open="emptyConfirmOpen"
      title="清空回收站"
      description="将永久删除回收站中的全部文档，此操作无法恢复。"
      confirm-label="清空"
      destructive
      test-id="empty-trash-dialog"
      @confirm="confirmEmpty"
      @cancel="emptyConfirmOpen = false"
    />
  </div>
</template>
