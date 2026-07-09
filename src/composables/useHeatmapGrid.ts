import { computed, type Ref } from "vue";
import type { EditActivityDay } from "../types/document";

export const HEATMAP_TOTAL_DAYS = 365;
export const HEATMAP_CELL_SIZE = 11;
export const HEATMAP_CELL_GAP = 3;
export const HEATMAP_CELL_STEP = HEATMAP_CELL_SIZE + HEATMAP_CELL_GAP;

export interface HeatmapCell {
  date: string;
  count: number;
  empty: boolean;
}

export function useHeatmapGrid(activity: Ref<EditActivityDay[]>) {
  const maxCount = computed(() =>
    Math.max(1, ...activity.value.map((d) => d.editCount)),
  );

  const weeks = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (HEATMAP_TOTAL_DAYS - 1));

    const activityMap = new Map(activity.value.map((d) => [d.date, d.editCount]));
    const columns: HeatmapCell[][] = [];

    const cursor = new Date(start);
    while (cursor <= today) {
      const dayOfWeek = cursor.getDay();
      const weekIndex = Math.floor(
        (cursor.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );

      if (!columns[weekIndex]) {
        columns[weekIndex] = Array.from({ length: 7 }, () => ({
          date: "",
          count: 0,
          empty: true,
        }));
      }

      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      const date = `${y}-${m}-${day}`;
      columns[weekIndex][dayOfWeek] = {
        date,
        count: activityMap.get(date) ?? 0,
        empty: false,
      };

      cursor.setDate(cursor.getDate() + 1);
    }

    return columns;
  });

  const monthLabels = computed(() => {
    const labels: { week: number; label: string }[] = [];
    let lastMonth = -1;

    weeks.value.forEach((col, weekIdx) => {
      const firstDay = col.find((c) => !c.empty);
      if (!firstDay) return;
      const month = new Date(firstDay.date).getMonth();
      if (month !== lastMonth) {
        labels.push({ week: weekIdx, label: `${month + 1}月` });
        lastMonth = month;
      }
    });

    return labels;
  });

  const hasActivity = computed(() =>
    activity.value.some((d) => d.editCount > 0),
  );

  function cellLevel(count: number): number {
    if (count === 0) return 0;
    const ratio = count / maxCount.value;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }

  function cellFill(count: number, eaten: boolean): string {
    if (eaten) return "var(--color-surface-1)";
    if (count === 0) return "var(--color-surface-1)";
    const ratio = count / maxCount.value;
    if (ratio <= 0.25) return "color-mix(in srgb, var(--color-paw) 25%, transparent)";
    if (ratio <= 0.5) return "color-mix(in srgb, var(--color-paw) 45%, transparent)";
    if (ratio <= 0.75) return "color-mix(in srgb, var(--color-paw) 70%, transparent)";
    return "var(--color-paw)";
  }

  function formatTooltip(cell: HeatmapCell): string {
    if (cell.empty) return "";
    return `${cell.date}：${cell.count} 次编辑`;
  }

  return {
    weeks,
    monthLabels,
    maxCount,
    hasActivity,
    cellLevel,
    cellFill,
    formatTooltip,
  };
}
