<script setup lang="ts">
import { computed } from "vue";
import { Flame, TrendingDown, TrendingUp } from "@lucide/vue";
import { useDashboardInsights, weekdayLabel } from "../../composables/useDashboardInsights";

const { todayEdits, last7Days, weekTotal, weekTrend, streak, maxDayInWeek } =
  useDashboardInsights();

const todayKey = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});

function isToday(date: string): boolean {
  return date === todayKey.value;
}
</script>

<template>
  <div class="space-y-5 lg:flex lg:h-full lg:flex-col lg:justify-between" data-testid="writing-rhythm">
    <div class="flex flex-wrap gap-4">
      <div class="flex items-center gap-2 rounded-lg bg-surface-1/60 px-4 py-3">
        <Flame v-if="streak > 0" :size="16" class="text-paw" aria-hidden="true" />
        <div>
          <p class="text-[11px] text-muted">连续写作</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-paw">
            {{ streak }}<span class="text-sm font-normal text-muted"> 天</span>
          </p>
        </div>
      </div>
      <div class="rounded-lg bg-surface-1/60 px-4 py-3">
        <p class="text-[11px] text-muted">今日编辑</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-[var(--color-text)]">
          {{ todayEdits }}<span class="text-sm font-normal text-muted"> 次</span>
        </p>
      </div>
      <div class="rounded-lg bg-surface-1/60 px-4 py-3">
        <p class="text-[11px] text-muted">本周累计</p>
        <p class="mt-1 flex items-baseline gap-2">
          <span class="text-xl font-semibold tabular-nums text-[var(--color-text)]">
            {{ weekTotal }}
          </span>
          <span
            v-if="weekTrend !== 0"
            class="insights-trend-bounce inline-flex items-center gap-0.5 text-xs"
            :class="weekTrend > 0 ? 'text-secure' : 'text-red-400/80'"
          >
            <TrendingUp v-if="weekTrend > 0" :size="12" aria-hidden="true" />
            <TrendingDown v-else :size="12" aria-hidden="true" />
            {{ Math.abs(weekTrend) }}%
          </span>
          <span v-else class="text-xs text-muted">—</span>
        </p>
      </div>
    </div>

    <div>
      <p class="mb-2 text-[11px] text-muted">近 7 日节奏</p>
      <div class="flex items-end gap-2" style="height: 72px">
        <div
          v-for="(day, idx) in last7Days"
          :key="day.date"
          class="flex flex-1 flex-col items-center gap-1"
        >
          <div class="relative w-full max-w-[32px]">
            <div
              class="insights-rhythm-bar w-full rounded-t-sm bg-link/80"
              :class="[`insights-rhythm-bar--${idx}`, isToday(day.date) ? 'ring-1 ring-paw/60 ring-offset-1 ring-offset-surface-0' : '']"
              :style="{
                height: `${Math.max(4, (day.editCount / maxDayInWeek) * 56)}px`,
                opacity: day.editCount === 0 ? 0.2 : 0.4 + (day.editCount / maxDayInWeek) * 0.6,
              }"
              :title="`${day.date}：${day.editCount} 次`"
            />
          </div>
          <span
            class="text-[9px]"
            :class="isToday(day.date) ? 'font-medium text-paw' : 'text-muted'"
          >
            {{ weekdayLabel(day.date) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
