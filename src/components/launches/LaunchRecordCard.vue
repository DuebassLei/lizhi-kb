<script setup lang="ts">
import { computed } from "vue";
import type { LaunchRecord } from "../../types/launchRecord";
import {
  ENVIRONMENT_LABELS,
  formatLaunchCompactDate,
  RISK_LABELS,
  STATUS_LABELS,
  STATUS_THEME,
} from "../../types/launchRecord";

const props = defineProps<{
  record: LaunchRecord;
  selected?: boolean;
}>();

defineEmits<{
  click: [];
}>();

const displayTime = computed(() => {
  const ts = props.record.launchedAt ?? props.record.scheduledAt;
  return ts ? formatLaunchCompactDate(ts) : null;
});

const metaLine = computed(() => {
  const parts: string[] = [];
  if (props.record.clientName) parts.push(`客户：${props.record.clientName}`);
  if (displayTime.value) parts.push(displayTime.value);
  if (props.record.operator) parts.push(props.record.operator);
  return parts.join(" · ");
});
</script>

<template>
  <article
    data-testid="launch-record-card"
    class="focus-ring cursor-pointer rounded-lg border border-border bg-surface-1 p-3 text-left transition-[box-shadow,transform] duration-200 border-l-[3px]"
    :class="[
      STATUS_THEME[record.status].rowAccent,
      selected ? 'ring-2 ring-paw/50 shadow-md' : 'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',
    ]"
    tabindex="0"
    role="button"
    :aria-label="`${record.recordNumber} ${record.title}`"
    @click="$emit('click')"
    @keydown.enter="$emit('click')"
  >
    <div class="mb-1.5 flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <span class="font-mono text-[10px] text-muted">{{ record.recordNumber }}</span>
        <h3 class="mt-0.5 line-clamp-1 text-sm font-medium leading-snug">
          <span v-if="record.version" class="mr-1.5 text-muted">{{ record.version }}</span>
          {{ record.title }}
        </h3>
      </div>
    </div>

    <div class="flex flex-wrap gap-1.5">
      <span
        class="rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
        :class="STATUS_THEME[record.status].pill"
      >
        {{ STATUS_LABELS[record.status] }}
      </span>
      <span class="rounded-full border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
        {{ ENVIRONMENT_LABELS[record.environment] }}
      </span>
      <span
        v-if="record.riskLevel"
        class="rounded-full border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted"
      >
        {{ RISK_LABELS[record.riskLevel] }}
      </span>
    </div>

    <p v-if="record.changeSummary" class="mt-2 line-clamp-1 text-xs text-muted">
      <span class="text-[10px] opacity-70">摘要 · </span>{{ record.changeSummary }}
    </p>

    <div v-if="record.releaseNotes?.trim()" class="mt-2">
      <p class="text-[10px] text-muted opacity-80">发布说明</p>
      <p class="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted">
        {{ record.releaseNotes.trim() }}
      </p>
    </div>

    <p v-if="metaLine" class="mt-2 text-[10px] text-muted">{{ metaLine }}</p>
  </article>
</template>
