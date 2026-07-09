<script setup lang="ts">
import { toRef } from "vue";
import { useRequirementStats } from "../../composables/useRequirementStats";
import type { Requirement } from "../../types/requirement";
import {
  PRIORITY_CHART_COLORS,
  STATUS_CHART_COLORS,
  STATUS_THEME,
} from "../../types/requirement";

const props = defineProps<{
  items: Requirement[];
}>();

const {
  statusSlices,
  prioritySlices,
  completionRate,
  overdueCount,
  inProgressCount,
  doneCount,
  total,
  monthlyTrend,
  trendMax,
} = useRequirementStats(toRef(props, "items"));

const chartW = 320;
const chartH = 140;
const barGap = 12;
const barWidth = 22;

function trendBarHeight(value: number): number {
  return Math.round((value / trendMax.value) * (chartH - 28));
}
</script>

<template>
  <div class="space-y-4 px-4 pb-5" data-testid="requirements-stats" aria-label="需求统计">
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-border bg-surface-0/60 p-4">
        <p class="text-xs text-muted">完成率</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-secure">{{ completionRate }}%</p>
        <p class="mt-1 text-[11px] text-muted">{{ doneCount }} / {{ total }} 已完成</p>
      </div>
      <div class="rounded-lg border border-border bg-surface-0/60 p-4">
        <p class="text-xs text-muted">进行中</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-paw">{{ inProgressCount }}</p>
        <p class="mt-1 text-[11px] text-muted">活跃需求</p>
      </div>
      <div class="rounded-lg border border-border bg-surface-0/60 p-4">
        <p class="text-xs text-muted">逾期</p>
        <p
          class="mt-1 text-2xl font-semibold tabular-nums"
          :class="overdueCount > 0 ? 'text-danger' : 'text-muted'"
        >
          {{ overdueCount }}
        </p>
        <p class="mt-1 text-[11px] text-muted">未完成且已过截止</p>
      </div>
      <div class="rounded-lg border border-border bg-surface-0/60 p-4">
        <p class="text-xs text-muted">需求总量</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-link">{{ total }}</p>
        <p class="mt-1 text-[11px] text-muted">含全部状态</p>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <article class="rounded-lg border border-border bg-surface-0/60 p-4">
        <h3 class="mb-3 text-xs font-medium text-text-secondary">状态分布</h3>
        <div
          v-if="total > 0"
          class="mb-3 flex h-3 overflow-hidden rounded-full bg-surface-2"
          role="img"
          :aria-label="`状态分布：${statusSlices.map((s) => `${s.label} ${s.count}`).join('，')}`"
        >
          <div
            v-for="slice in statusSlices.filter((s) => s.count > 0)"
            :key="slice.status"
            class="h-full transition-all duration-300"
            :style="{
              width: `${(slice.count / total) * 100}%`,
              backgroundColor: STATUS_CHART_COLORS[slice.status],
            }"
            :title="`${slice.label} ${slice.count}`"
          />
        </div>
        <ul class="space-y-2">
          <li
            v-for="slice in statusSlices"
            :key="slice.status"
            class="flex items-center gap-2 text-xs"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="STATUS_THEME[slice.status].dot"
              aria-hidden="true"
            />
            <span class="w-12 shrink-0" :class="STATUS_THEME[slice.status].header">
              {{ slice.label }}
            </span>
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                class="h-full rounded-full transition-all duration-300"
                :style="{
                  width: `${slice.ratio * 100}%`,
                  backgroundColor: STATUS_CHART_COLORS[slice.status],
                }"
              />
            </div>
            <span class="w-6 shrink-0 text-right tabular-nums text-muted">{{ slice.count }}</span>
          </li>
        </ul>
      </article>

      <article class="rounded-lg border border-border bg-surface-0/60 p-4">
        <h3 class="mb-3 text-xs font-medium text-text-secondary">优先级分布</h3>
        <svg
          :viewBox="`0 0 ${chartW} ${chartH}`"
          class="mx-auto h-36 w-full max-w-md"
          role="img"
          aria-label="优先级柱状图"
        >
          <g v-for="(slice, i) in prioritySlices" :key="slice.key">
            <rect
              :x="24 + i * (barWidth + barGap)"
              :y="chartH - 22 - Math.round(slice.ratio * (chartH - 28))"
              :width="barWidth"
              :height="Math.max(slice.count > 0 ? 4 : 0, Math.round(slice.ratio * (chartH - 28)))"
              :fill="PRIORITY_CHART_COLORS[slice.key]"
              rx="3"
            />
            <text
              :x="24 + i * (barWidth + barGap) + barWidth / 2"
              :y="chartH - 6"
              text-anchor="middle"
              class="fill-[var(--color-muted)] text-[10px]"
            >
              {{ slice.label }}
            </text>
            <text
              v-if="slice.count > 0"
              :x="24 + i * (barWidth + barGap) + barWidth / 2"
              :y="chartH - 28 - Math.round(slice.ratio * (chartH - 28))"
              text-anchor="middle"
              class="fill-[var(--color-text-secondary)] text-[10px]"
            >
              {{ slice.count }}
            </text>
          </g>
        </svg>
      </article>

      <article class="rounded-lg border border-border bg-surface-0/60 p-4 lg:col-span-2">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-xs font-medium text-text-secondary">近 6 月趋势</h3>
          <div class="flex items-center gap-3 text-[10px] text-muted">
            <span class="inline-flex items-center gap-1">
              <span class="h-2 w-2 rounded-sm bg-link" aria-hidden="true" />
              新增
            </span>
            <span class="inline-flex items-center gap-1">
              <span class="h-2 w-2 rounded-sm bg-secure" aria-hidden="true" />
              完成
            </span>
          </div>
        </div>
        <svg
          :viewBox="`0 0 ${chartW} ${chartH}`"
          class="mx-auto h-40 w-full"
          role="img"
          aria-label="近六月新增与完成趋势"
        >
          <g v-for="(point, i) in monthlyTrend" :key="point.key">
            <rect
              :x="20 + i * 50"
              :y="chartH - 24 - trendBarHeight(point.created)"
              width="18"
              :height="Math.max(point.created > 0 ? 4 : 0, trendBarHeight(point.created))"
              fill="#6b9fd8"
              rx="2"
            />
            <rect
              :x="40 + i * 50"
              :y="chartH - 24 - trendBarHeight(point.completed)"
              width="18"
              :height="Math.max(point.completed > 0 ? 4 : 0, trendBarHeight(point.completed))"
              fill="#4ade9a"
              rx="2"
            />
            <text
              :x="38 + i * 50"
              :y="chartH - 6"
              text-anchor="middle"
              class="fill-[var(--color-muted)] text-[10px]"
            >
              {{ point.label }}
            </text>
          </g>
        </svg>
      </article>
    </div>
  </div>
</template>
