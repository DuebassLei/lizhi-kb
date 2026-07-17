<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Plus, Trash2 } from "@lucide/vue";
import { useMubuStore } from "../../stores/mubu";
import { countMubuStats } from "../../services/mubuService";
import { findMubuNode } from "../../utils/mubuTree";
import ConfirmDialog from "../common/ConfirmDialog.vue";
import MubuEditor from "./MubuEditor.vue";
import MubuMap from "./MubuMap.vue";
import "../../styles/mubu.css";
import "../../styles/mindmap.css";

const store = useMubuStore();

const deletePending = ref<{ id: string; title: string } | null>(null);

const saveLabel = computed(() => {
  if (store.saving) return "保存中…";
  if (store.dirty) return "未保存";
  return "已保存";
});

const stats = computed(() => countMubuStats(store.tree));

onMounted(async () => {
  await store.ensureLoaded();
  if (!store.activeId && store.docs.length) {
    await store.openDoc(store.docs[0].id);
  }
});

watch(
  () => store.activeId,
  (id) => {
    if (!id) return;
  },
);

async function onCreate() {
  await store.addDoc();
}

function onDelete(id: string, e: Event) {
  e.stopPropagation();
  const doc = store.docs.find((d) => d.id === id);
  deletePending.value = { id, title: doc?.title?.trim() || "未命名织念" };
}

async function confirmDeleteDoc() {
  if (!deletePending.value) return;
  const { id } = deletePending.value;
  deletePending.value = null;
  await store.removeDoc(id);
}

function onTreeChange(root: NonNullable<typeof store.tree>) {
  store.setTree(root);
}

function onToggleCollapse(id: string) {
  if (!store.tree) return;
  const next = structuredClone(store.tree);
  const node = findMubuNode(next, id);
  if (!node) return;
  node.collapsed = !node.collapsed;
  store.setTree(next);
}

function onUpdateText(id: string, text: string) {
  if (!store.tree) return;
  const next = structuredClone(store.tree);
  const node = findMubuNode(next, id);
  if (!node) return;
  node.text = text;
  store.setTree(next);
}

function formatTime(ms: number) {
  try {
    return new Date(ms).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
</script>

<template>
  <div class="mubu-panel" data-testid="mubu-panel">
    <aside class="mubu-sidebar">
      <div class="mubu-sidebar__head">
        <h1 class="mubu-sidebar__title">织念</h1>
        <button
          type="button"
          class="mm-btn mm-btn--primary"
          title="新建"
          data-testid="mubu-create"
          @click="onCreate"
        >
          <Plus class="size-3.5" aria-hidden="true" />
          新建
        </button>
      </div>
      <div class="mubu-sidebar__list">
        <div v-if="store.loading" class="px-3 py-4 text-xs text-muted">加载中…</div>
        <button
          v-for="doc in store.docs"
          :key="doc.id"
          type="button"
          class="mubu-doc-item"
          :class="{ 'mubu-doc-item--active': store.activeId === doc.id }"
          @click="store.openDoc(doc.id)"
        >
          <span class="min-w-0 flex-1">
            <span class="mubu-doc-item__title">{{ doc.title }}</span>
            <span class="mubu-doc-item__meta">{{ formatTime(doc.updatedAt) }}</span>
          </span>
          <button
            type="button"
            class="mm-btn shrink-0"
            title="删除"
            @click="onDelete(doc.id, $event)"
          >
            <Trash2 class="size-3.5" aria-hidden="true" />
          </button>
        </button>
        <p v-if="!store.loading && !store.docs.length" class="px-3 py-6 text-center text-xs text-muted">
          还没有织念，点击「新建」开始
        </p>
      </div>
    </aside>

    <section class="mubu-main">
      <template v-if="store.activeDoc && store.tree">
        <div class="mubu-main__bar">
          <div class="flex min-w-0 items-center gap-2">
            <div class="mm-pane-switch" role="tablist" aria-label="视图">
              <button
                type="button"
                role="tab"
                class="mm-pane-switch__btn"
                :class="{ 'mm-pane-switch__btn--active': store.paneMode === 'notes' }"
                @click="store.paneMode = 'notes'"
              >
                笔记
              </button>
              <button
                type="button"
                role="tab"
                class="mm-pane-switch__btn"
                :class="{ 'mm-pane-switch__btn--active': store.paneMode === 'map' }"
                @click="store.paneMode = 'map'"
              >
                导图
              </button>
            </div>
            <span class="truncate text-sm font-medium text-[var(--color-text)]">
              {{ store.activeDoc.title }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted">{{ saveLabel }}</span>
            <button
              type="button"
              class="mm-btn"
              :disabled="!store.dirty || store.saving"
              @click="store.flushSave()"
            >
              保存
            </button>
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div class="min-h-0 flex-1 overflow-auto">
            <MubuEditor
              v-if="store.paneMode === 'notes'"
              :root="store.tree"
              :selected-id="store.selectedNodeId"
              @change="onTreeChange"
              @select="store.selectedNodeId = $event"
            />
            <MubuMap
              v-else
              :root="store.tree"
              :selected-id="store.selectedNodeId"
              :title="store.activeDoc.title"
              @select="store.selectedNodeId = $event"
              @toggle-collapse="onToggleCollapse"
              @update-text="onUpdateText"
            />
          </div>
          <div class="mubu-statusbar" data-testid="mubu-statusbar">
            当前文档 {{ stats.topics }} 条主题 · 共 {{ stats.chars }} 字
          </div>
        </div>
      </template>

      <div v-else class="mubu-empty">
        <p>选择或新建一篇织念</p>
        <button type="button" class="mm-btn mm-btn--primary" @click="onCreate">新建织念</button>
      </div>
    </section>

    <ConfirmDialog
      :open="!!deletePending"
      title="删除织念"
      :item-name="deletePending?.title"
      description="删除后无法恢复，请确认是否继续。"
      confirm-label="删除"
      destructive
      test-id="delete-mubu-doc-dialog"
      @confirm="confirmDeleteDoc"
      @cancel="deletePending = null"
    />
  </div>
</template>
