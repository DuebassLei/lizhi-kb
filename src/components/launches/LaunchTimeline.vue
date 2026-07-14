<script setup lang="ts">
import { computed } from "vue";
import LaunchRecordCard from "./LaunchRecordCard.vue";
import type { LaunchRecord } from "../../types/launchRecord";
import {
  formatLaunchMonthLabel,
  launchRecordMonthKey,
  launchRecordSortTime,
  STATUS_THEME,
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
  <div class="launch-timeline p-4 pl-5">
    <section
      v-for="(group, groupIndex) in groups"
      :key="group.key"
      class="launch-timeline__group"
      :class="{ 'launch-timeline__group--last': groupIndex === groups.length - 1 }"
    >
      <h2 class="launch-timeline__month">
        <span class="launch-timeline__month-dot" aria-hidden="true" />
        {{ group.label }}
        <span class="launch-timeline__month-count">{{ group.records.length }}</span>
      </h2>

      <ul class="launch-timeline__list">
        <li
          v-for="record in group.records"
          :key="record.id"
          class="launch-timeline__item"
        >
          <span
            class="launch-timeline__node"
            :class="STATUS_THEME[record.status].dot"
            aria-hidden="true"
          />
          <LaunchRecordCard
            :record="record"
            :selected="record.id === selectedId"
            @click="emit('select', record.id)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.launch-timeline {
  position: relative;
}

.launch-timeline::before {
  content: "";
  position: absolute;
  top: 1.25rem;
  bottom: 1.25rem;
  left: 1.35rem;
  width: 1px;
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--color-border) 90%, transparent) 8%,
    color-mix(in srgb, var(--color-border) 90%, transparent) 92%,
    transparent
  );
}

.launch-timeline__group + .launch-timeline__group {
  margin-top: 1.5rem;
}

.launch-timeline__month {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
  padding-left: 1.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-muted);
}

.launch-timeline__month-dot {
  position: absolute;
  left: 0;
  top: 50%;
  z-index: 1;
  width: 0.55rem;
  height: 0.55rem;
  margin-top: -0.275rem;
  border-radius: 9999px;
  background: var(--color-surface-2);
  box-shadow:
    0 0 0 2px var(--color-canvas),
    0 0 0 3px color-mix(in srgb, var(--color-border) 85%, transparent);
}

.launch-timeline__month-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.15rem;
  padding: 0 0.35rem;
  border-radius: 9999px;
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
  font-size: 0.625rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--color-muted);
}

.launch-timeline__list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.launch-timeline__item {
  position: relative;
  padding-left: 1.35rem;
}

.launch-timeline__node {
  position: absolute;
  left: 0.05rem;
  top: 1.2rem;
  z-index: 1;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  box-shadow:
    0 0 0 2px var(--color-canvas),
    0 0 0 3px color-mix(in srgb, var(--color-border) 55%, transparent);
}
</style>
