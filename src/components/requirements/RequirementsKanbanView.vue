<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { Columns3, Plus } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import EmptyState from "../ui/EmptyState.vue";
import KanbanColumn from "./KanbanColumn.vue";
import RequirementDetailDrawer from "./RequirementDetailDrawer.vue";
import RequirementsBottomPanel from "./RequirementsBottomPanel.vue";
import { useRequirementsStore } from "../../stores/requirements";
import { useUiStore } from "../../stores/ui";
import type { RequirementStatus } from "../../types/requirement";
import {
  REQUIREMENT_STATUSES,
  STATUS_LABELS,
  STATUS_THEME,
} from "../../types/requirement";

const store = useRequirementsStore();
const ui = useUiStore();
const route = useRoute();
const draggingId = ref<string | null>(null);

const statusStats = computed(() =>
  REQUIREMENT_STATUSES.map((status) => ({
    status,
    count: store.filteredByStatus[status].length,
  })),
);

const highPriorityCount = computed(
  () =>
    store.filteredItems.filter((r) => r.priority === "high" && r.status !== "done").length,
);

onMounted(() => {
  void store.fetchAll().then(() => {
    const id = route.query.id;
    if (typeof id === "string" && store.items.some((r) => r.id === id)) {
      store.select(id);
    }
  });
});

function startCreate() {
  void store.add({
    title: "新需求",
    content: "在此填写详细描述…",
  });
}

function onDragStart(id: string) {
  draggingId.value = id;
}

function onDragEnd() {
  draggingId.value = null;
}

async function onDrop(status: RequirementStatus) {
  if (!draggingId.value) return;
  await store.moveToColumn(draggingId.value, status);
  draggingId.value = null;
}

async function onSave(patch: Parameters<typeof store.save>[1]) {
  if (!store.selected) return;
  await store.save(store.selected.id, patch);
  store.closeDrawer();
}

async function onDelete() {
  if (!store.selected) return;
  if (!window.confirm("确定删除此需求？")) return;
  await store.remove(store.selected.id);
}

async function onImport() {
  const result = await store.importFromCsv();
  if (!result) return;
  const parts = [`已导入 ${result.imported} 条`];
  if (result.skipped > 0) parts.push(`跳过重复 ${result.skipped} 条`);
  if (result.failed > 0) parts.push(`失败 ${result.failed} 条`);
  ui.showToast(result.imported > 0 ? "success" : "error", parts.join("，"));
}
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto bg-canvas">
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-0/40 px-4 py-3 backdrop-blur-sm">
      <div>
        <h1 class="text-sm font-medium">需求看板</h1>
        <p class="text-xs text-muted">
          共 {{ store.isSearching ? store.filteredItems.length : store.totalCount }} 条需求
          <span v-if="store.isSearching" class="text-muted">（已筛选）</span>
          <span v-if="highPriorityCount > 0" class="text-danger">
            · {{ highPriorityCount }} 条高优先级进行中
          </span>
        </p>
      </div>
      <Btn variant="primary" data-testid="new-requirement-btn" @click="startCreate">
        <Plus class="mr-1 inline h-3.5 w-3.5" />
        新建需求
      </Btn>
    </header>

    <div
      v-if="!store.loading && !store.error && store.totalCount > 0"
      class="flex shrink-0 flex-wrap gap-2 border-b border-border/60 px-4 py-2.5"
      role="status"
      aria-label="状态分布"
    >
      <span
        v-for="{ status, count } in statusStats"
        :key="status"
        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums transition-opacity"
        :class="[STATUS_THEME[status].pill, count === 0 ? 'opacity-45' : '']"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="STATUS_THEME[status].dot" aria-hidden="true" />
        {{ STATUS_LABELS[status] }}
        <span class="opacity-80">{{ count }}</span>
      </span>
    </div>

    <div v-if="store.loading" class="flex shrink-0 gap-3 overflow-x-auto p-4">
      <div
        v-for="status in REQUIREMENT_STATUSES"
        :key="status"
        class="min-w-[220px] flex-1 animate-pulse rounded-lg border border-border/60 p-4"
        :class="[STATUS_THEME[status].bg, STATUS_THEME[status].accent]"
      >
        <div
          class="mb-4 h-4 w-24 rounded"
          :class="STATUS_THEME[status].countBadge"
        />
        <div class="space-y-2">
          <div class="h-20 rounded bg-surface-2/60" />
          <div class="h-20 rounded bg-surface-2/60" />
        </div>
      </div>
    </div>

    <div
      v-else-if="store.error"
      class="flex flex-1 flex-col items-center justify-center gap-3 p-6"
    >
      <p class="text-sm text-danger">{{ store.error }}</p>
      <Btn variant="secondary" @click="store.fetchAll()">重试</Btn>
    </div>

    <EmptyState
      v-else-if="store.totalCount === 0"
      class="flex-1 py-16"
      title="暂无需求"
      description="创建第一条需求，或导入 CSV 清单开始管理"
    >
      <template #icon>
        <Columns3 class="h-8 w-8" />
      </template>
      <template #action>
        <div class="flex flex-wrap justify-center gap-2">
          <Btn variant="primary" @click="startCreate">创建第一条需求</Btn>
          <Btn variant="secondary" data-testid="import-requirements-empty-btn" @click="onImport">
            导入 CSV
          </Btn>
        </div>
      </template>
    </EmptyState>

    <template v-else>
      <div
        class="flex min-h-[min(480px,55vh)] shrink-0 gap-3 overflow-x-auto p-4 pb-5"
        data-testid="requirements-kanban"
      >
        <KanbanColumn
          v-for="status in REQUIREMENT_STATUSES"
          :key="status"
          :status="status"
          :items="store.filteredByStatus[status]"
          :selected-id="store.selectedId"
          :dragging-id="draggingId"
          @select="store.select"
          @drop="onDrop"
          @dragstart="onDragStart"
          @dragend="onDragEnd"
        />
      </div>

      <RequirementsBottomPanel
        :items="store.filteredItems"
        :selected-id="store.selectedId"
        @select="store.select"
      />
    </template>

    <RequirementDetailDrawer
      :requirement="store.selected"
      :open="store.drawerOpen"
      @close="store.closeDrawer()"
      @save="onSave"
      @delete="onDelete"
    />

    <p
      v-if="ui.toast"
      role="status"
      data-testid="requirements-toast"
      class="fixed bottom-4 left-1/2 z-[120] -translate-x-1/2 rounded-md border border-border bg-surface-1 px-4 py-2 text-sm shadow-lg"
      :class="ui.toast.type === 'success' ? 'text-secure' : 'text-danger'"
    >
      {{ ui.toast.message }}
    </p>
  </div>
</template>
