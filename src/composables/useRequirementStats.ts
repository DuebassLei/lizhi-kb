import { computed, type MaybeRefOrGetter, toValue } from "vue";
import type { Requirement, RequirementPriority, RequirementStatus } from "../types/requirement";
import {
  isRequirementOverdue,
  PRIORITY_LABELS,
  REQUIREMENT_STATUSES,
  STATUS_LABELS,
} from "../types/requirement";

export interface StatusSlice {
  status: RequirementStatus;
  label: string;
  count: number;
  ratio: number;
}

export interface PrioritySlice {
  key: RequirementPriority | "none";
  label: string;
  count: number;
  ratio: number;
}

export interface MonthlyTrendPoint {
  key: string;
  label: string;
  created: number;
  completed: number;
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [, m] = key.split("-");
  return `${Number(m)}月`;
}

export function useRequirementStats(source: MaybeRefOrGetter<Requirement[]>) {
  const items = computed(() => toValue(source));

  const total = computed(() => items.value.length);

  const statusSlices = computed<StatusSlice[]>(() => {
    const counts = Object.fromEntries(REQUIREMENT_STATUSES.map((s) => [s, 0])) as Record<
      RequirementStatus,
      number
    >;
    for (const item of items.value) counts[item.status] += 1;
    const max = Math.max(1, total.value);
    return REQUIREMENT_STATUSES.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: counts[status],
      ratio: counts[status] / max,
    }));
  });

  const prioritySlices = computed<PrioritySlice[]>(() => {
    const keys: Array<RequirementPriority | "none"> = ["high", "medium", "low", "none"];
    const counts: Record<RequirementPriority | "none", number> = {
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };
    for (const item of items.value) {
      if (item.priority) counts[item.priority] += 1;
      else counts.none += 1;
    }
    const max = Math.max(1, ...Object.values(counts));
    return keys.map((key) => ({
      key,
      label: key === "none" ? "未设置" : PRIORITY_LABELS[key],
      count: counts[key],
      ratio: counts[key] / max,
    }));
  });

  const doneCount = computed(() => items.value.filter((r) => r.status === "done").length);

  const completionRate = computed(() =>
    total.value === 0 ? 0 : Math.round((doneCount.value / total.value) * 100),
  );

  const overdueCount = computed(() => items.value.filter(isRequirementOverdue).length);

  const inProgressCount = computed(
    () => items.value.filter((r) => r.status === "in_progress").length,
  );

  const monthlyTrend = computed<MonthlyTrendPoint[]>(() => {
    const now = new Date();
    const points: MonthlyTrendPoint[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d.getTime());
      points.push({ key, label: monthLabel(key), created: 0, completed: 0 });
    }

    const index = new Map(points.map((p, i) => [p.key, i]));
    for (const item of items.value) {
      const createdIdx = index.get(monthKey(item.createdAt));
      if (createdIdx !== undefined) points[createdIdx].created += 1;

      if (item.status === "done") {
        const doneTs = item.actualLaunchAt ?? item.updatedAt;
        const doneIdx = index.get(monthKey(doneTs));
        if (doneIdx !== undefined) points[doneIdx].completed += 1;
      }
    }

    return points;
  });

  const trendMax = computed(() =>
    Math.max(1, ...monthlyTrend.value.flatMap((p) => [p.created, p.completed])),
  );

  return {
    total,
    statusSlices,
    prioritySlices,
    completionRate,
    overdueCount,
    inProgressCount,
    doneCount,
    monthlyTrend,
    trendMax,
  };
}
