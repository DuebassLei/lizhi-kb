import type { JournalDayGroup, JournalEntry } from "../types/journal";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function todayDayDate(): string {
  return formatDayDate(new Date());
}

export function formatDayDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatEntryTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

export function formatDayLabel(dayDate: string, now = new Date()): string {
  const today = formatDayDate(now);
  const yesterday = formatDayDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  const [y, m, d] = dayDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = WEEKDAYS[date.getDay()];
  const datePart =
    now.getFullYear() === y ? `${m}月${d}日` : `${y}年${m}月${d}日`;

  if (dayDate === today) return `今天 · ${datePart} ${weekday}`;
  if (dayDate === yesterday) return `昨天 · ${datePart} ${weekday}`;
  return `${datePart} ${weekday}`;
}

/** 日期分组标题：主标题 + 副标题 */
export function formatDayHeading(dayDate: string, now = new Date()): { title: string; subtitle: string } {
  const today = formatDayDate(now);
  const yesterday = formatDayDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const [y, m, d] = dayDate.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const datePart = now.getFullYear() === y ? `${m}月${d}日` : `${y}年${m}月${d}日`;

  if (dayDate === today) return { title: "今天", subtitle: `${datePart} · ${weekday}` };
  if (dayDate === yesterday) return { title: "昨天", subtitle: `${datePart} · ${weekday}` };
  return { title: datePart, subtitle: weekday };
}

export function isTodayDayDate(dayDate: string, now = new Date()): boolean {
  return dayDate === formatDayDate(now);
}

export function formatEntryDateTime(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = WEEKDAYS[d.getDay()];
  return `${y}年${m}月${day}日 ${weekday} ${formatEntryTime(ts)}`;
}

export function groupEntriesByDay(entries: JournalEntry[], now = new Date()): JournalDayGroup[] {
  const map = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.dayDate) ?? [];
    list.push(entry);
    map.set(entry.dayDate, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dayDate, dayEntries]) => ({
      dayDate,
      label: formatDayLabel(dayDate, now),
      entries: dayEntries.sort((a, b) => b.createdAt - a.createdAt),
    }));
}
