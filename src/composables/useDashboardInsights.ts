import { computed } from "vue";
import { useDocumentsStore } from "../stores/documents";

export function useDashboardInsights() {
  const documents = useDocumentsStore();

  const activity = computed(() => documents.editActivity);

  const todayKey = computed(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const todayEdits = computed(() => {
    const row = activity.value.find((d) => d.date === todayKey.value);
    return row?.editCount ?? 0;
  });

  const last7Days = computed(() => {
    const days = activity.value;
    return days.slice(-7);
  });

  const prev7Days = computed(() => {
    const days = activity.value;
    if (days.length < 14) return days.slice(0, Math.max(0, days.length - 7));
    return days.slice(-14, -7);
  });

  const weekTotal = computed(() =>
    last7Days.value.reduce((n, d) => n + d.editCount, 0),
  );

  const prevWeekTotal = computed(() =>
    prev7Days.value.reduce((n, d) => n + d.editCount, 0),
  );

  const weekTrend = computed(() => {
    if (prevWeekTotal.value === 0) {
      return weekTotal.value > 0 ? 100 : 0;
    }
    return Math.round(((weekTotal.value - prevWeekTotal.value) / prevWeekTotal.value) * 100);
  });

  const streak = computed(() => {
    const map = new Map(activity.value.map((d) => [d.date, d.editCount]));
    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (true) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const edits = map.get(key) ?? 0;
      if (edits <= 0) break;
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  });

  const maxDayInWeek = computed(() =>
    Math.max(1, ...last7Days.value.map((d) => d.editCount)),
  );

  const avgWordsPerDoc = computed(() => {
    const s = documents.stats;
    if (!s || s.totalDocs === 0) return 0;
    return Math.round(s.totalWords / s.totalDocs);
  });

  return {
    todayEdits,
    last7Days,
    weekTotal,
    weekTrend,
    streak,
    maxDayInWeek,
    avgWordsPerDoc,
  };
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function weekdayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const labels = ["日", "一", "二", "三", "四", "五", "六"];
  return labels[d.getDay()];
}
