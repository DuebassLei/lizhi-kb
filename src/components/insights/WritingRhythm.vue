<script setup lang="ts">
import { useDashboardInsights, weekdayLabel } from "../../composables/useDashboardInsights";

const { todayEdits, last7Days, weekTotal, weekTrend, streak, maxDayInWeek } =
  useDashboardInsights();
</script>

<template>
  <div class="space-y-5" data-testid="writing-rhythm">
    <div class="flex flex-wrap gap-4">
      <div class="rounded-lg bg-surface-1/60 px-4 py-3">
        <p class="text-[11px] text-muted">连续写作</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-paw">
          {{ streak }}<span class="text-sm font-normal text-muted"> 天</span>
        </p>
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
            class="text-xs"
            :class="weekTrend > 0 ? 'text-secure' : 'text-red-400/80'"
          >
            {{ weekTrend > 0 ? "↑" : "↓" }}{{ Math.abs(weekTrend) }}%
          </span>
          <span v-else class="text-xs text-muted">—</span>
        </p>
      </div>
    </div>

    <div>
      <p class="mb-2 text-[11px] text-muted">近 7 日节奏</p>
      <div class="flex items-end gap-2" style="height: 72px">
        <div
          v-for="day in last7Days"
          :key="day.date"
          class="flex flex-1 flex-col items-center gap-1"
        >
          <div
            class="w-full max-w-[32px] rounded-t-sm bg-link/80 transition-all"
            :style="{
              height: `${Math.max(4, (day.editCount / maxDayInWeek) * 56)}px`,
              opacity: day.editCount === 0 ? 0.2 : 0.4 + (day.editCount / maxDayInWeek) * 0.6,
            }"
            :title="`${day.date}：${day.editCount} 次`"
          />
          <span class="text-[9px] text-muted">{{ weekdayLabel(day.date) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
