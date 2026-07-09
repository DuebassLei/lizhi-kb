<script setup lang="ts">
import { computed } from "vue";
import type { JournalDayGroup } from "../../types/journal";
import { formatDayHeading, isTodayDayDate, todayDayDate } from "../../utils/journalDates";
import JournalEntryCard from "./JournalEntryCard.vue";
import JournalQuickCapture from "./JournalQuickCapture.vue";

const props = defineProps<{
  group: JournalDayGroup;
  showQuickCapture?: boolean;
}>();

const emit = defineEmits<{
  submit: [content: string];
  edit: [id: string];
  delete: [id: string];
}>();

const heading = computed(() => formatDayHeading(props.group.dayDate));
const isToday = computed(() => isTodayDayDate(props.group.dayDate));
const showCapture = computed(
  () => props.showQuickCapture !== false && props.group.dayDate === todayDayDate(),
);
</script>

<template>
  <section
    class="journal-day-group"
    :class="{ 'journal-day-group--today': isToday }"
    :data-testid="`journal-day-${group.dayDate}`"
  >
    <header class="journal-day-header">
      <div
        class="journal-day-badge"
        :class="isToday ? 'journal-day-badge--today' : 'journal-day-badge--default'"
        aria-hidden="true"
      >
        <span class="journal-day-badge__dot" />
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold tracking-tight text-[var(--color-text)]">
          {{ heading.title }}
        </h2>
        <p class="mt-0.5 text-[11px] text-muted">
          {{ heading.subtitle }}
          <span v-if="group.entries.length" class="text-text-secondary">
            · {{ group.entries.length }} 条
          </span>
        </p>
      </div>
    </header>

    <JournalQuickCapture
      v-if="showCapture"
      class="journal-day-capture"
      @submit="emit('submit', $event)"
    />

    <div v-if="group.entries.length" class="journal-day-entries">
      <JournalEntryCard
        v-for="(entry, index) in group.entries"
        :key="entry.id"
        :entry="entry"
        :is-first="index === 0"
        :is-last="index === group.entries.length - 1"
        :highlight="isToday && index === 0"
        @edit="emit('edit', entry.id)"
        @delete="emit('delete', entry.id)"
      />
    </div>

    <p
      v-else-if="!showCapture"
      class="journal-day-empty"
    >
      这一天还没有小记
    </p>
  </section>
</template>

<style scoped>
.journal-day-group {
  position: relative;
}

.journal-day-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 0.5rem 0;
  background: linear-gradient(
    to bottom,
    var(--color-canvas) 70%,
    transparent
  );
  backdrop-filter: blur(6px);
}

.journal-day-badge {
  display: flex;
  height: 1.75rem;
  width: 1.75rem;
  shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface-1);
}

.journal-day-badge--today {
  border-color: color-mix(in srgb, var(--color-paw) 35%, transparent);
  background: var(--color-paw-muted);
}

.journal-day-badge__dot {
  height: 0.5rem;
  width: 0.5rem;
  border-radius: 9999px;
  background: var(--color-muted);
}

.journal-day-badge--today .journal-day-badge__dot {
  background: var(--color-paw);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-paw) 22%, transparent);
}

.journal-day-capture {
  margin: 0 0 1rem 2.5rem;
}

.journal-day-entries {
  position: relative;
  width: 100%;
  margin-left: 0.875rem;
  padding-left: 1.625rem;
  box-sizing: border-box;
}

.journal-day-entries::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.75rem;
  bottom: 0.75rem;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--color-paw) 55%, transparent),
    color-mix(in srgb, var(--color-link) 30%, var(--color-border)),
    color-mix(in srgb, var(--color-border) 60%, transparent)
  );
}

.journal-day-group--today .journal-day-entries::before {
  background: linear-gradient(
    to bottom,
    var(--color-paw),
    color-mix(in srgb, var(--color-paw) 45%, var(--color-link)),
    color-mix(in srgb, var(--color-link) 25%, var(--color-border))
  );
}

.journal-day-empty {
  margin-left: 2.5rem;
  padding: 1rem 0;
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-muted);
}
</style>
