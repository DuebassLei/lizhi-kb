<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  ChevronDown,
  Download,
  LayoutList,
  List,
  Plus,
  Search,
  Upload,
  X,
} from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import EmptyState from "../ui/EmptyState.vue";
import LaunchRecordDrawer from "./LaunchRecordDrawer.vue";
import LaunchTimeline from "./LaunchTimeline.vue";
import LaunchesTable from "./LaunchesTable.vue";
import { useLaunchRecordsStore } from "../../stores/launchRecords";
import { useUiStore } from "../../stores/ui";
import {
  ENVIRONMENT_LABELS,
  LAUNCH_ENVIRONMENTS,
  LAUNCH_STATUSES,
  STATUS_LABELS,
  STATUS_THEME,
} from "../../types/launchRecord";
import type { LaunchTimeRange } from "../../utils/launchRecordFilters";
import { collectClientNames, collectLaunchTags } from "../../utils/launchRecordFilters";
import {
  downloadLaunchRecordsCsvTemplate,
  exportLaunchRecordsCsv,
  exportLaunchRecordsMarkdown,
} from "../../utils/exportLaunchRecords";
import type { LaunchRecordPatch } from "../../services/launchRecordService";

const store = useLaunchRecordsStore();
const ui = useUiStore();
const route = useRoute();

const exportOpen = ref(false);
const filterOpen = ref(false);
const importing = ref(false);

const subtitle = computed(() => {
  const total = store.isSearching ? store.filteredCount : store.totalCount;
  return `共 ${total} 条 · 本月上线 ${store.liveThisMonthCount} 次`;
});

const allTags = computed(() => collectLaunchTags(store.items));
const allClients = computed(() => collectClientNames(store.items));

onMounted(async () => {
  await store.fetchAll();
  if (store.pendingCreate || route.query.fromRequirement) {
    await store.consumePendingCreate();
  }
});

function toggleStatus(status: string) {
  const set = new Set(store.filters.statuses);
  if (set.has(status)) set.delete(status);
  else set.add(status);
  store.filters = { ...store.filters, statuses: set };
}

function toggleEnvironment(env: string) {
  const set = new Set(store.filters.environments);
  if (set.has(env)) set.delete(env);
  else set.add(env);
  store.filters = { ...store.filters, environments: set };
}

function toggleTag(tag: string) {
  const set = new Set(store.filters.tags);
  if (set.has(tag)) set.delete(tag);
  else set.add(tag);
  store.filters = { ...store.filters, tags: set };
}

function setTimeRange(range: LaunchTimeRange) {
  store.filters = { ...store.filters, timeRange: range };
}

async function startCreate() {
  await store.add({ title: "新上线记录" });
}

async function onSave(patch: LaunchRecordPatch) {
  if (!store.selected) return;
  await store.save(store.selected.id, patch);
  store.closeDrawer();
  ui.showToast("success", "已保存");
}

async function onDelete() {
  if (!store.selected) return;
  await store.remove(store.selected.id);
}

async function onImport() {
  if (importing.value) return;
  importing.value = true;
  try {
    const result = await store.importFromCsv();
    if (!result) return;
    const parts = [`已导入 ${result.imported} 条`];
    if (result.skipped > 0) parts.push(`跳过重复 ${result.skipped} 条`);
    if (result.failed > 0) parts.push(`失败 ${result.failed} 条`);
    ui.showToast(result.imported > 0 ? "success" : "error", parts.join("，"));
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "导入失败");
  } finally {
    importing.value = false;
  }
}

async function onExportCsv(all: boolean) {
  exportOpen.value = false;
  const items = all ? store.items : store.filteredItems;
  if (items.length === 0) {
    ui.showToast("error", "暂无记录可导出");
    return;
  }
  try {
    const ok = await exportLaunchRecordsCsv(items, store.requirementNumberById);
    if (ok) ui.showToast("success", "CSV 已导出");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "导出失败");
  }
}

async function onExportMarkdown() {
  exportOpen.value = false;
  const items = store.filteredItems;
  if (items.length === 0) {
    ui.showToast("error", "暂无记录可导出");
    return;
  }
  try {
    const ok = await exportLaunchRecordsMarkdown(items);
    if (ok) ui.showToast("success", "Markdown 已导出");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "导出失败");
  }
}

async function onDownloadTemplate() {
  exportOpen.value = false;
  try {
    const ok = await downloadLaunchRecordsCsvTemplate();
    if (ok) ui.showToast("success", "模板已下载");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "下载失败");
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-canvas">
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-0/40 px-4 py-3 backdrop-blur-sm">
      <div>
        <h1 class="text-sm font-medium">上线记录</h1>
        <p class="text-xs text-muted">{{ subtitle }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div
          class="inline-flex rounded-lg border border-border bg-surface-1/50 p-0.5"
          role="tablist"
          aria-label="视图模式"
        >
          <button
            type="button"
            role="tab"
            class="focus-ring inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium"
            :class="store.viewMode === 'timeline' ? 'bg-surface-2 shadow-sm' : 'text-muted'"
            :aria-selected="store.viewMode === 'timeline'"
            @click="store.viewMode = 'timeline'"
          >
            <LayoutList class="h-3.5 w-3.5" />
            时间线
          </button>
          <button
            type="button"
            role="tab"
            class="focus-ring inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium"
            :class="store.viewMode === 'table' ? 'bg-surface-2 shadow-sm' : 'text-muted'"
            :aria-selected="store.viewMode === 'table'"
            @click="store.viewMode = 'table'"
          >
            <List class="h-3.5 w-3.5" />
            表格
          </button>
        </div>

        <Btn variant="secondary" @click="filterOpen = !filterOpen">
          筛选
        </Btn>

        <div class="relative">
          <Btn variant="secondary" @click="exportOpen = !exportOpen">
            <Download class="mr-1 inline h-3.5 w-3.5" />
            导出
            <ChevronDown class="ml-0.5 inline h-3 w-3" />
          </Btn>
          <div
            v-if="exportOpen"
            class="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-border bg-surface-0 py-1 shadow-lg"
          >
            <button type="button" class="block w-full px-3 py-2 text-left text-xs hover:bg-surface-1" @click="onExportCsv(false)">
              导出当前筛选 (CSV)
            </button>
            <button type="button" class="block w-full px-3 py-2 text-left text-xs hover:bg-surface-1" @click="onExportMarkdown">
              导出当前筛选 (Markdown)
            </button>
            <button type="button" class="block w-full px-3 py-2 text-left text-xs hover:bg-surface-1" @click="onExportCsv(true)">
              导出全部 (CSV)
            </button>
            <button type="button" class="block w-full px-3 py-2 text-left text-xs hover:bg-surface-1" @click="onDownloadTemplate">
              下载导入模板
            </button>
          </div>
        </div>

        <Btn variant="secondary" :disabled="importing" @click="onImport">
          <Upload class="mr-1 inline h-3.5 w-3.5" />
          {{ importing ? "导入中…" : "导入" }}
        </Btn>

        <Btn variant="primary" data-testid="new-launch-record-btn" @click="startCreate">
          <Plus class="mr-1 inline h-3.5 w-3.5" />
          新建上线记录
        </Btn>
      </div>
    </header>

    <div
      v-if="!store.loading && store.totalCount > 0"
      class="flex shrink-0 flex-wrap gap-2 border-b border-border/60 px-4 py-2.5"
    >
      <span
        v-for="{ status, count } in store.statusStats"
        :key="status"
        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums"
        :class="[STATUS_THEME[status].pill, count === 0 ? 'opacity-45' : '']"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="STATUS_THEME[status].dot" />
        {{ STATUS_LABELS[status] }}
        <span class="opacity-80">{{ count }}</span>
      </span>
    </div>

    <div class="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-2">
      <Search class="h-3.5 w-3.5 shrink-0 text-muted" />
      <input
        v-model="store.searchQuery"
        type="search"
        placeholder="搜索标题/版本/单号/客户名/操作人/标签…"
        class="focus-ring min-w-0 flex-1 bg-transparent text-xs outline-none"
        aria-label="搜索上线记录"
      />
      <button
        v-if="store.isSearching"
        type="button"
        class="focus-ring rounded p-1 text-muted"
        aria-label="清除筛选"
        @click="store.resetFilters()"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <div
      v-if="filterOpen"
      class="shrink-0 space-y-3 border-b border-border/60 bg-surface-0/30 px-4 py-3 text-xs"
    >
      <div>
        <p class="mb-1.5 text-muted">状态</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="s in LAUNCH_STATUSES"
            :key="s"
            type="button"
            class="focus-ring rounded-full px-2 py-1"
            :class="store.filters.statuses.has(s) ? STATUS_THEME[s].pill : 'border border-border text-muted'"
            @click="toggleStatus(s)"
          >
            {{ STATUS_LABELS[s] }}
          </button>
        </div>
      </div>
      <div>
        <p class="mb-1.5 text-muted">环境</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="e in LAUNCH_ENVIRONMENTS"
            :key="e"
            type="button"
            class="focus-ring rounded-full border px-2 py-1"
            :class="store.filters.environments.has(e) ? 'border-link bg-link/10 text-link' : 'border-border text-muted'"
            @click="toggleEnvironment(e)"
          >
            {{ ENVIRONMENT_LABELS[e] }}
          </button>
        </div>
      </div>
      <div class="flex flex-wrap gap-3">
        <div>
          <p class="mb-1 text-muted">时间范围</p>
          <select
            :value="store.filters.timeRange"
            class="focus-ring rounded border border-border bg-surface-1 px-2 py-1"
            @change="setTimeRange(($event.target as HTMLSelectElement).value as LaunchTimeRange)"
          >
            <option value="all">全部</option>
            <option value="month">近 1 月</option>
            <option value="3months">近 3 月</option>
          </select>
        </div>
        <div>
          <p class="mb-1 text-muted">客户</p>
          <select
            v-model="store.filters.clientName"
            class="focus-ring max-w-[160px] rounded border border-border bg-surface-1 px-2 py-1"
          >
            <option value="">全部</option>
            <option v-for="c in allClients" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <label class="flex items-center gap-1.5 self-end pb-1">
          <input v-model="store.filters.rolledBackOnly" type="checkbox" />
          仅含回滚
        </label>
      </div>
      <div v-if="allTags.length > 0">
        <p class="mb-1.5 text-muted">标签</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="tag in allTags"
            :key="tag"
            type="button"
            class="focus-ring rounded-full border px-2 py-1"
            :class="store.filters.tags.has(tag) ? 'border-paw bg-paw/10 text-paw' : 'border-border text-muted'"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div v-if="store.loading" class="p-4 text-xs text-muted">加载中…</div>
      <div v-else-if="store.error" class="p-4 text-xs text-danger">{{ store.error }}</div>
      <EmptyState
        v-else-if="store.totalCount === 0"
        title="暂无上线记录"
        description="创建第一条上线记录，或导入 CSV 清单"
      >
        <template #action>
          <Btn variant="primary" class="mt-3" @click="startCreate">新建上线记录</Btn>
        </template>
      </EmptyState>
      <EmptyState
        v-else-if="store.filteredItems.length === 0"
        title="无匹配记录"
        description="尝试调整搜索或筛选条件"
      />
      <LaunchTimeline
        v-else-if="store.viewMode === 'timeline'"
        :items="store.filteredItems"
        :selected-id="store.selectedId"
        @select="store.select"
      />
      <LaunchesTable
        v-else
        :items="store.filteredItems"
        :selected-id="store.selectedId"
        @select="store.select"
      />
    </div>

    <LaunchRecordDrawer
      :record="store.selected"
      :open="store.drawerOpen"
      :requirements="store.requirements"
      @close="store.closeDrawer()"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>
