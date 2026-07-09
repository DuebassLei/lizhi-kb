import type { LaunchRecord } from "../types/launchRecord";
import { matchesLaunchRecordKeyword } from "./launchRecordSearch";

export type LaunchTimeRange = "all" | "month" | "3months";

export interface LaunchRecordFilters {
  statuses: Set<string>;
  environments: Set<string>;
  riskLevels: Set<string>;
  clientName: string;
  tags: Set<string>;
  rolledBackOnly: boolean;
  timeRange: LaunchTimeRange;
}

export function defaultLaunchFilters(): LaunchRecordFilters {
  return {
    statuses: new Set(),
    environments: new Set(),
    riskLevels: new Set(),
    clientName: "",
    tags: new Set(),
    rolledBackOnly: false,
    timeRange: "all",
  };
}

function inTimeRange(record: LaunchRecord, range: LaunchTimeRange): boolean {
  if (range === "all") return true;
  const ts = record.launchedAt ?? record.scheduledAt ?? record.createdAt;
  const now = Date.now();
  const monthMs = 30 * 86_400_000;
  if (range === "month") return now - ts <= monthMs;
  return now - ts <= 3 * monthMs;
}

export function applyLaunchFilters(
  items: LaunchRecord[],
  filters: LaunchRecordFilters,
  searchQuery: string,
): LaunchRecord[] {
  return items.filter((record) => {
    if (!matchesLaunchRecordKeyword(record, searchQuery)) return false;
    if (filters.statuses.size > 0 && !filters.statuses.has(record.status)) return false;
    if (filters.environments.size > 0 && !filters.environments.has(record.environment)) return false;
    if (filters.riskLevels.size > 0) {
      if (!record.riskLevel || !filters.riskLevels.has(record.riskLevel)) return false;
    }
    if (filters.clientName.trim()) {
      const q = filters.clientName.trim().toLowerCase();
      if (!record.clientName?.toLowerCase().includes(q)) return false;
    }
    if (filters.tags.size > 0) {
      const tags = record.tags ?? [];
      if (![...filters.tags].every((t) => tags.includes(t))) return false;
    }
    if (filters.rolledBackOnly && record.status !== "rolled_back") return false;
    if (!inTimeRange(record, filters.timeRange)) return false;
    return true;
  });
}

export function collectLaunchTags(items: LaunchRecord[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      if (tag.trim()) set.add(tag.trim());
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function collectClientNames(items: LaunchRecord[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    if (item.clientName?.trim()) set.add(item.clientName.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
}
