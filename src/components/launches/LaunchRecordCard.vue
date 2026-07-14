<script setup lang="ts">
import { computed } from "vue";
import { Building2, CalendarClock, FileText, UserRound } from "@lucide/vue";
import type { LaunchRecord } from "../../types/launchRecord";
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
  record: LaunchRecord;
  selected?: boolean;
}>();

defineEmits<{
  click: [];
}>();

const theme = computed(() => STATUS_THEME[props.record.status]);

const displayTime = computed(() => {
  const ts = props.record.launchedAt ?? props.record.scheduledAt;
  return ts ? formatLaunchCompactDate(ts) : null;
});

const notesPreview = computed(() => {
  const raw = props.record.releaseNotes?.trim();
  if (!raw) return "";
  return previewLaunchPlainText(raw);
});

const summaryText = computed(() => props.record.changeSummary?.trim() || "");

const tagList = computed(() => (props.record.tags ?? []).filter(Boolean).slice(0, 3));
</script>

<template>
  <article
    data-testid="launch-record-card"
    class="launch-card focus-ring group cursor-pointer text-left"
    :class="[
      theme.rowAccent,
      selected ? 'launch-card--selected' : 'launch-card--idle',
    ]"
    tabindex="0"
    role="button"
    :aria-label="`${record.recordNumber} ${record.title}`"
    @click="$emit('click')"
    @keydown.enter="$emit('click')"
  >
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="font-mono text-[10px] tracking-wide text-muted">
            {{ record.recordNumber }}
          </span>
          <span
            v-if="record.version"
            class="rounded border border-border/80 bg-surface-2/80 px-1.5 py-px font-mono text-[10px] text-muted"
          >
            {{ record.version }}
          </span>
        </div>
        <h3 class="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-text)]">
          {{ record.title }}
        </h3>
      </div>
      <span
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium leading-none"
        :class="theme.pill"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="theme.dot" aria-hidden="true" />
        {{ STATUS_LABELS[record.status] }}
      </span>
    </header>

    <div class="mt-2.5 flex flex-wrap gap-1.5">
      <span
        class="rounded-full border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted"
      >
        {{ ENVIRONMENT_LABELS[record.environment] }}
      </span>
      <span
        v-if="record.riskLevel"
        class="rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
        :class="RISK_THEME[record.riskLevel].pill"
      >
        风险 {{ RISK_LABELS[record.riskLevel] }}
      </span>
      <span
        v-for="tag in tagList"
        :key="tag"
        class="rounded-full border border-paw/20 bg-paw/8 px-1.5 py-0.5 text-[10px] text-paw"
      >
        {{ tag }}
      </span>
    </div>

    <p v-if="summaryText" class="mt-3 line-clamp-2 text-xs leading-relaxed text-muted/95">
      {{ summaryText }}
    </p>

    <div v-if="notesPreview" class="launch-card__notes mt-3">
      <div class="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted">
        <FileText class="h-3 w-3 shrink-0 opacity-80" aria-hidden="true" />
        发布说明
      </div>
      <p class="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted/90">
        {{ notesPreview }}
      </p>
    </div>

    <footer
      v-if="displayTime || record.operator || record.clientName"
      class="launch-card__footer mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted"
    >
      <span v-if="displayTime" class="inline-flex items-center gap-1 tabular-nums">
        <CalendarClock class="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
        {{ displayTime }}
      </span>
      <span v-if="record.operator" class="inline-flex items-center gap-1">
        <UserRound class="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
        {{ record.operator }}
      </span>
      <span v-if="record.clientName" class="inline-flex min-w-0 items-center gap-1">
        <Building2 class="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
        <span class="truncate">{{ record.clientName }}</span>
      </span>
    </footer>
  </article>
</template>

<style scoped>
.launch-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--color-border) 92%, transparent);
  border-left-width: 3px;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--color-surface-1) 96%, var(--color-canvas)),
    color-mix(in srgb, var(--color-surface-0) 90%, var(--color-canvas))
  );
  padding: 0.875rem 1rem;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease,
    background 0.18s ease;
}

.launch-card--idle:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-border-strong) 70%, var(--color-border));
  box-shadow:
    0 1px 0 color-mix(in srgb, var(--color-text) 4%, transparent),
    0 6px 18px color-mix(in srgb, var(--color-base) 32%, transparent);
}

.launch-card--selected {
  border-color: color-mix(in srgb, var(--color-paw) 32%, var(--color-border));
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--color-paw) 9%, var(--color-surface-1)),
    color-mix(in srgb, var(--color-surface-1) 94%, var(--color-canvas))
  );
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--color-paw) 22%, transparent),
    0 6px 18px color-mix(in srgb, var(--color-base) 28%, transparent);
}

.launch-card__notes {
  border-radius: calc(var(--radius-lg) - 2px);
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  background: color-mix(in srgb, var(--color-surface-2) 55%, transparent);
  padding: 0.55rem 0.7rem;
}

.launch-card__footer {
  padding-top: 0.65rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
}
</style>
