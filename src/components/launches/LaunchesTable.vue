<script setup lang="ts">
import { computed, ref } from "vue";
import type { LaunchRecord, LaunchStatus } from "../../types/launchRecord";
import {
  ENVIRONMENT_LABELS,
  formatLaunchCompactDate,
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

function sortIndicator(key: SortKey): string {
  if (sortKey.value !== key) return "";
  return sortAsc.value ? " ↑" : " ↓";
}
</script>

<template>
  <div class="overflow-x-auto p-4">
    <table class="w-full min-w-[960px] border-collapse text-left text-xs">
      <thead>
        <tr class="border-b border-border text-muted">
          <th class="cursor-pointer px-2 py-2 font-medium" @click="toggleSort('recordNumber')">
            单号{{ sortIndicator("recordNumber") }}
          </th>
          <th class="cursor-pointer px-2 py-2 font-medium" @click="toggleSort('title')">
            标题{{ sortIndicator("title") }}
          </th>
          <th class="px-2 py-2 font-medium">环境</th>
          <th class="cursor-pointer px-2 py-2 font-medium" @click="toggleSort('status')">
            状态{{ sortIndicator("status") }}
          </th>
          <th class="px-2 py-2 font-medium">客户</th>
          <th class="cursor-pointer px-2 py-2 font-medium" @click="toggleSort('launchedAt')">
            上线时间{{ sortIndicator("launchedAt") }}
          </th>
          <th class="px-2 py-2 font-medium">变更摘要</th>
          <th class="px-2 py-2 font-medium">发布说明</th>
          <th class="px-2 py-2 font-medium">操作人</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="record in sortedItems"
          :key="record.id"
          class="focus-ring cursor-pointer border-b border-border/50 transition-colors hover:bg-surface-1/60"
          :class="[
            STATUS_THEME[record.status].rowAccent,
            'border-l-2',
            record.id === selectedId ? 'bg-surface-1' : '',
          ]"
          tabindex="0"
          @click="emit('select', record.id)"
          @keydown.enter="emit('select', record.id)"
        >
          <td class="px-2 py-2.5 font-mono text-[10px] text-muted">{{ record.recordNumber }}</td>
          <td class="max-w-[200px] truncate px-2 py-2.5">{{ record.title }}</td>
          <td class="px-2 py-2.5 text-muted">{{ ENVIRONMENT_LABELS[record.environment] }}</td>
          <td class="px-2 py-2.5">
            <span
              class="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              :class="STATUS_THEME[record.status].pill"
            >
              {{ STATUS_LABELS[record.status as LaunchStatus] }}
            </span>
          </td>
          <td class="max-w-[120px] truncate px-2 py-2.5 text-muted">
            {{ record.clientName ?? "—" }}
          </td>
          <td class="px-2 py-2.5 tabular-nums text-muted">
            {{ formatLaunchCompactDate(record.launchedAt ?? record.scheduledAt) }}
          </td>
          <td class="max-w-[140px] truncate px-2 py-2.5 text-muted">
            {{ record.changeSummary?.trim() || "—" }}
          </td>
          <td class="max-w-[180px] truncate px-2 py-2.5 text-muted">
            {{ record.releaseNotes?.trim() || "—" }}
          </td>
          <td class="px-2 py-2.5 text-muted">{{ record.operator ?? "—" }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
