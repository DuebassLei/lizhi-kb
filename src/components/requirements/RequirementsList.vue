<script setup lang="ts">
import { computed, ref } from "vue";
import { ListFilter } from "@lucide/vue";
import type { Requirement, RequirementStatus } from "../../types/requirement";
import {
  formatRequirementCompactDate,
  getRequirementDisplayTitle,
  getRequirementListContent,
  getRequirementListTitle,
  PRIORITY_LABELS,
  PRIORITY_THEME,
  REQUIREMENT_STATUSES,
  STATUS_LABELS,
  STATUS_THEME,
} from "../../types/requirement";

const props = defineProps<{
  items: Requirement[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

type SortKey =
  | "number"
  | "title"
  | "content"
  | "progressDescription"
  | "remarks"
  | "proposedAt"
  | "expectedLaunchAt"
  | "actualLaunchAt"
  | "status"
  | "priority"
  | "owner"
  | "requester"
  | "source";

const statusFilter = ref<RequirementStatus | "all">("all");
const sortKey = ref<SortKey>("proposedAt");
const sortAsc = ref(false);

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortKey.value = key;
    sortAsc.value = true;
  }
}

function sortIndicator(key: SortKey): string {
  if (sortKey.value !== key) return "";
  return sortAsc.value ? " ↑" : " ↓";
}

function compareNullable(a?: number, b?: number): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

const filteredItems = computed(() => {
  let list = [...props.items];
  if (statusFilter.value !== "all") {
    list = list.filter((r) => r.status === statusFilter.value);
  }

  const dir = sortAsc.value ? 1 : -1;
  list.sort((a, b) => {
    switch (sortKey.value) {
      case "number":
        return a.number.localeCompare(b.number) * dir;
      case "title":
        return getRequirementListTitle(a).localeCompare(getRequirementListTitle(b)) * dir;
      case "content":
        return getRequirementListContent(a).localeCompare(getRequirementListContent(b)) * dir;
      case "progressDescription":
        return (a.progressDescription ?? "").localeCompare(b.progressDescription ?? "", "zh-CN") * dir;
      case "remarks":
        return (a.remarks ?? "").localeCompare(b.remarks ?? "", "zh-CN") * dir;
      case "proposedAt":
        return compareNullable(a.proposedAt, b.proposedAt) * dir;
      case "expectedLaunchAt":
        return compareNullable(a.expectedLaunchAt, b.expectedLaunchAt) * dir;
      case "actualLaunchAt":
        return compareNullable(a.actualLaunchAt, b.actualLaunchAt) * dir;
      case "status":
        return a.status.localeCompare(b.status) * dir;
      case "priority": {
        const order = { high: 0, medium: 1, low: 2 } as const;
        const pa = a.priority ? order[a.priority] : 3;
        const pb = b.priority ? order[b.priority] : 3;
        return (pa - pb) * dir;
      }
      case "owner":
        return (a.owner ?? "").localeCompare(b.owner ?? "", "zh-CN") * dir;
      case "requester":
        return (a.requester ?? "").localeCompare(b.requester ?? "", "zh-CN") * dir;
      case "source":
        return (a.source ?? "").localeCompare(b.source ?? "", "zh-CN") * dir;
      default:
        return 0;
    }
  });

  return list;
});

const columns: Array<{ key: SortKey; label: string; width: string }> = [
  { key: "number", label: "需求单号", width: "10%" },
  { key: "title", label: "需求标题", width: "11%" },
  { key: "content", label: "需求内容", width: "13%" },
  { key: "owner", label: "负责人", width: "4%" },
  { key: "requester", label: "提出人", width: "4%" },
  { key: "proposedAt", label: "提出时间", width: "7%" },
  { key: "status", label: "状态", width: "5%" },
  { key: "priority", label: "优先级", width: "4%" },
  { key: "source", label: "需求来源", width: "5%" },
  { key: "progressDescription", label: "进度说明", width: "11%" },
  { key: "expectedLaunchAt", label: "预计上线", width: "7%" },
  { key: "actualLaunchAt", label: "实际上线", width: "7%" },
  { key: "remarks", label: "备注", width: "12%" },
];

function cellText(item: Requirement, key: SortKey): string {
  switch (key) {
    case "number":
      return item.number;
    case "title":
      return getRequirementListTitle(item);
    case "content": {
      const text = getRequirementListContent(item);
      return text || "—";
    }
    case "owner":
      return item.owner || "—";
    case "requester":
      return item.requester || "—";
    case "source":
      return item.source || "—";
    case "proposedAt":
      return formatRequirementCompactDate(item.proposedAt);
    case "expectedLaunchAt":
      return formatRequirementCompactDate(item.expectedLaunchAt);
    case "actualLaunchAt":
      return formatRequirementCompactDate(item.actualLaunchAt);
    case "progressDescription":
      return item.progressDescription || "—";
    case "remarks":
      return item.remarks || "—";
    default:
      return "";
  }
}

function cellTitle(item: Requirement, key: SortKey): string | undefined {
  switch (key) {
    case "number":
      return item.number;
    case "title":
      return getRequirementListTitle(item);
    case "content": {
      const text = getRequirementListContent(item);
      return text || undefined;
    }
    case "owner":
      return item.owner || undefined;
    case "requester":
      return item.requester || undefined;
    case "source":
      return item.source || undefined;
    case "progressDescription":
      return item.progressDescription || undefined;
    case "remarks":
      return item.remarks || undefined;
    default:
      return undefined;
  }
}

function cellClass(key: SortKey): string {
  const base = "max-w-0 overflow-hidden px-2 py-1.5 align-top";
  switch (key) {
    case "number":
      return `${base} font-mono text-[11px] text-muted`;
    case "title":
    case "content":
      return base;
    case "proposedAt":
    case "expectedLaunchAt":
    case "actualLaunchAt":
      return `${base} whitespace-nowrap text-[11px] text-muted`;
    case "status":
    case "priority":
      return `${base} whitespace-nowrap`;
    default:
      return `${base} text-xs text-muted`;
  }
}

function cellInnerClass(key: SortKey): string | null {
  switch (key) {
    case "number":
      return "truncate font-mono text-[11px] text-muted";
    case "title":
      return "line-clamp-2 break-words text-xs leading-snug";
    case "content":
      return "line-clamp-2 break-words text-[11px] leading-snug text-muted";
    case "owner":
    case "requester":
    case "source":
      return "truncate text-xs text-muted";
    case "progressDescription":
    case "remarks":
      return "line-clamp-2 break-words text-[11px] text-muted";
    default:
      return null;
  }
}
</script>

<template>
  <div data-testid="requirements-list" aria-label="需求清单">
    <div class="flex flex-wrap items-center gap-3 border-b border-border/40 px-4 py-2.5">
      <ListFilter class="h-4 w-4 text-muted" aria-hidden="true" />
      <span class="text-xs text-muted">筛选</span>
      <div class="flex flex-wrap gap-1" role="group" aria-label="筛选状态">
        <button
          type="button"
          class="focus-ring rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-150"
          :class="
            statusFilter === 'all'
              ? 'bg-surface-2 text-[var(--color-text)] ring-1 ring-border-strong'
              : 'text-muted hover:bg-surface-2/70 hover:text-[var(--color-text)]'
          "
          :aria-pressed="statusFilter === 'all'"
          @click="statusFilter = 'all'"
        >
          全部
        </button>
        <button
          v-for="s in REQUIREMENT_STATUSES"
          :key="s"
          type="button"
          class="focus-ring rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-150"
          :class="
            statusFilter === s
              ? STATUS_THEME[s].pill
              : `${STATUS_THEME[s].pill} opacity-50 hover:opacity-90`
          "
          :aria-pressed="statusFilter === s"
          @click="statusFilter = s"
        >
          {{ STATUS_LABELS[s] }}
        </button>
      </div>
      <span class="ml-auto text-xs text-muted">（{{ filteredItems.length }} 条）</span>
    </div>

    <div class="overflow-x-auto px-3 pb-3">
      <table class="min-w-[960px] w-full border-collapse text-left text-sm">
        <colgroup>
          <col v-for="col in columns" :key="col.key" :style="{ width: col.width }" />
        </colgroup>
        <thead>
          <tr class="border-b border-border text-[11px] text-muted">
            <th
              v-for="col in columns"
              :key="col.key"
              class="cursor-pointer select-none overflow-hidden px-2 py-1.5 font-medium hover:text-[var(--color-text)]"
              scope="col"
              @click="toggleSort(col.key)"
            >
              {{ col.label }}{{ sortIndicator(col.key) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in filteredItems"
            :key="item.id"
            class="cursor-pointer border-b border-border/60 border-l-2 transition-colors hover:bg-surface-1/50"
            :class="[
              STATUS_THEME[item.status].rowAccent,
              selectedId === item.id ? 'bg-surface-1/80' : '',
              item.status === 'done' ? 'opacity-75' : '',
            ]"
            tabindex="0"
            role="button"
            :aria-label="`${item.number} ${getRequirementDisplayTitle(item)}`"
            @click="emit('select', item.id)"
            @keydown.enter="emit('select', item.id)"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              :class="cellClass(col.key)"
              :title="cellTitle(item, col.key)"
            >
              <template v-if="col.key === 'status'">
                <span
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  :class="STATUS_THEME[item.status].pill"
                >
                  <span
                    class="h-1 w-1 shrink-0 rounded-full"
                    :class="STATUS_THEME[item.status].dot"
                    aria-hidden="true"
                  />
                  {{ STATUS_LABELS[item.status] }}
                </span>
              </template>
              <template v-else-if="col.key === 'priority'">
                <span
                  v-if="item.priority"
                  class="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                  :class="PRIORITY_THEME[item.priority].pill"
                >
                  {{ PRIORITY_LABELS[item.priority] }}
                </span>
                <span v-else class="text-xs text-muted">—</span>
              </template>
              <template v-else-if="cellInnerClass(col.key)">
                <div :class="cellInnerClass(col.key)!">
                  {{ cellText(item, col.key) }}
                </div>
              </template>
              <template v-else>
                {{ cellText(item, col.key) }}
              </template>
            </td>
          </tr>
          <tr v-if="filteredItems.length === 0">
            <td :colspan="columns.length" class="px-3 py-8 text-center text-xs text-muted">
              无匹配需求
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
