<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowDown, ArrowUp, ArrowUpDown } from "@lucide/vue";
import type { LaunchRecord, LaunchStatus } from "../../types/launchRecord";
import {
  ENVIRONMENT_LABELS,
  formatLaunchCompactDate,
  previewLaunchPlainText,
  RISK_LABELS,
  RISK_THEME,
  STATUS_LABELS,
  STATUS_THEME,
} from "../../types/launchRecord";

const props = defineProps<{
  items: LaunchRecord[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

type SortKey = "recordNumber" | "title" | "status" | "launchedAt" | "updatedAt";

const sortKey = ref<SortKey>("launchedAt");
const sortAsc = ref(false);

const sortedItems = computed(() => {
  const list = [...props.items];
  list.sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    switch (sortKey.value) {
      case "recordNumber":
        av = a.recordNumber;
        bv = b.recordNumber;
        break;
      case "title":
        av = a.title;
        bv = b.title;
        break;
      case "status":
        av = a.status;
        bv = b.status;
        break;
      case "launchedAt":
        av = a.launchedAt ?? a.scheduledAt ?? a.createdAt;
        bv = b.launchedAt ?? b.scheduledAt ?? b.createdAt;
        break;
      case "updatedAt":
        av = a.updatedAt;
        bv = b.updatedAt;
        break;
    }
    if (av < bv) return sortAsc.value ? -1 : 1;
    if (av > bv) return sortAsc.value ? 1 : -1;
    return 0;
  });
  return list;
});

function toggleSort(key: SortKey) {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value;
  else {
    sortKey.value = key;
    sortAsc.value = key === "title" || key === "recordNumber";
  }
}

function notesCell(text?: string): string {
  const raw = text?.trim();
  if (!raw) return "—";
  return previewLaunchPlainText(raw, 80).replace(/\n+/g, " ");
}
</script>

<template>
  <div class="launches-table overflow-x-auto p-4">
    <table class="w-full min-w-[960px] border-collapse text-left text-xs">
      <thead>
        <tr class="launches-table__head">
          <th class="launches-table__th launches-table__th--sort" @click="toggleSort('recordNumber')">
            <span>单号</span>
            <ArrowUp v-if="sortKey === 'recordNumber' && sortAsc" class="h-3 w-3" />
            <ArrowDown v-else-if="sortKey === 'recordNumber'" class="h-3 w-3" />
            <ArrowUpDown v-else class="h-3 w-3 opacity-35" />
          </th>
          <th class="launches-table__th launches-table__th--sort" @click="toggleSort('title')">
            <span>标题</span>
            <ArrowUp v-if="sortKey === 'title' && sortAsc" class="h-3 w-3" />
            <ArrowDown v-else-if="sortKey === 'title'" class="h-3 w-3" />
            <ArrowUpDown v-else class="h-3 w-3 opacity-35" />
          </th>
          <th class="launches-table__th">环境</th>
          <th class="launches-table__th launches-table__th--sort" @click="toggleSort('status')">
            <span>状态</span>
            <ArrowUp v-if="sortKey === 'status' && sortAsc" class="h-3 w-3" />
            <ArrowDown v-else-if="sortKey === 'status'" class="h-3 w-3" />
            <ArrowUpDown v-else class="h-3 w-3 opacity-35" />
          </th>
          <th class="launches-table__th">风险</th>
          <th class="launches-table__th">客户</th>
          <th class="launches-table__th launches-table__th--sort" @click="toggleSort('launchedAt')">
            <span>上线时间</span>
            <ArrowUp v-if="sortKey === 'launchedAt' && sortAsc" class="h-3 w-3" />
            <ArrowDown v-else-if="sortKey === 'launchedAt'" class="h-3 w-3" />
            <ArrowUpDown v-else class="h-3 w-3 opacity-35" />
          </th>
          <th class="launches-table__th">变更摘要</th>
          <th class="launches-table__th">发布说明</th>
          <th class="launches-table__th">操作人</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="record in sortedItems"
          :key="record.id"
          class="launches-table__row focus-ring"
          :class="[
            STATUS_THEME[record.status].rowAccent,
            record.id === selectedId ? 'launches-table__row--selected' : '',
          ]"
          tabindex="0"
          @click="emit('select', record.id)"
          @keydown.enter="emit('select', record.id)"
        >
          <td class="launches-table__td font-mono text-[10px] tracking-wide text-muted">
            {{ record.recordNumber }}
          </td>
          <td class="launches-table__td max-w-[220px]">
            <div class="truncate font-medium text-[var(--color-text)]">{{ record.title }}</div>
            <div v-if="record.version" class="mt-0.5 truncate font-mono text-[10px] text-muted">
              {{ record.version }}
            </div>
          </td>
          <td class="launches-table__td">
            <span class="rounded-full border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
              {{ ENVIRONMENT_LABELS[record.environment] }}
            </span>
          </td>
          <td class="launches-table__td">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              :class="STATUS_THEME[record.status].pill"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="STATUS_THEME[record.status].dot"
                aria-hidden="true"
              />
              {{ STATUS_LABELS[record.status as LaunchStatus] }}
            </span>
          </td>
          <td class="launches-table__td">
            <span
              v-if="record.riskLevel"
              class="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              :class="RISK_THEME[record.riskLevel].pill"
            >
              {{ RISK_LABELS[record.riskLevel] }}
            </span>
            <span v-else class="text-muted">—</span>
          </td>
          <td class="launches-table__td max-w-[120px] truncate text-muted">
            {{ record.clientName ?? "—" }}
          </td>
          <td class="launches-table__td tabular-nums text-muted">
            {{ formatLaunchCompactDate(record.launchedAt ?? record.scheduledAt) }}
          </td>
          <td class="launches-table__td max-w-[140px] truncate text-muted">
            {{ record.changeSummary?.trim() || "—" }}
          </td>
          <td class="launches-table__td max-w-[180px] truncate text-muted">
            {{ notesCell(record.releaseNotes) }}
          </td>
          <td class="launches-table__td text-muted">{{ record.operator ?? "—" }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.launches-table__head {
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 88%, transparent);
  background: color-mix(in srgb, var(--color-surface-1) 55%, transparent);
}

.launches-table__th {
  padding: 0.55rem 0.65rem;
  font-weight: 500;
  color: var(--color-muted);
  white-space: nowrap;
}

.launches-table__th--sort {
  cursor: pointer;
  user-select: none;
}

.launches-table__th--sort > span,
.launches-table__th--sort {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.launches-table__th--sort:hover {
  color: var(--color-text);
}

.launches-table__row {
  cursor: pointer;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 45%, transparent);
  border-left-width: 3px;
  border-left-style: solid;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.launches-table__row:hover {
  background: color-mix(in srgb, var(--color-surface-1) 72%, transparent);
}

.launches-table__row--selected {
  background: color-mix(in srgb, var(--color-paw) 8%, var(--color-surface-1));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-paw) 18%, transparent);
}

.launches-table__td {
  padding: 0.7rem 0.65rem;
  vertical-align: middle;
}
</style>
