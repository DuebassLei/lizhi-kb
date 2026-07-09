<script setup lang="ts">
import { computed } from "vue";
import LaunchRecordCard from "./LaunchRecordCard.vue";
import type { LaunchRecord } from "../../types/launchRecord";
import {
  formatLaunchMonthLabel,
  launchRecordMonthKey,
  launchRecordSortTime,
} from "../../types/launchRecord";

const props = defineProps<{
  items: LaunchRecord[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const groups = computed(() => {
  const map = new Map<string, LaunchRecord[]>();
  const sorted = [...props.items].sort(
    (a, b) => launchRecordSortTime(b) - launchRecordSortTime(a),
  );
  for (const record of sorted) {
    const key = launchRecordMonthKey(launchRecordSortTime(record));
    const list = map.get(key) ?? [];
    list.push(record);
    map.set(key, list);
  }
  return [...map.entries()].map(([key, records]) => ({
    key,
    label: formatLaunchMonthLabel(key),
    records,
  }));
});
</script>

<template>
  <div class="space-y-6 p-4">
    <section v-for="group in groups" :key="group.key">
      <h2 class="mb-3 text-xs font-medium text-muted">{{ group.label }}</h2>
      <div class="space-y-2">
        <LaunchRecordCard
          v-for="record in group.records"
          :key="record.id"
          :record="record"
          :selected="record.id === selectedId"
          @click="emit('select', record.id)"
        />
      </div>
    </section>
  </div>
</template>
