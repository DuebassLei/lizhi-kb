import type { AssetEntry } from "../services/assetService";

export type AssetDateGroupId = "today" | "week" | "older" | "unknown";

export interface AssetDateGroup {
  id: AssetDateGroupId;
  label: string;
  items: AssetEntry[];
}

export function shortAssetId(id: string): string {
  const dot = id.lastIndexOf(".");
  const base = dot >= 0 ? id.slice(0, dot) : id;
  const ext = dot >= 0 ? id.slice(dot) : "";
  if (base.length <= 8) return id;
  return `${base.slice(0, 8)}…${ext}`;
}

export function formatAssetSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function assetTimestampMs(ts: number): number | null {
  if (!ts || !Number.isFinite(ts)) return null;
  return ts < 1e12 ? ts * 1000 : ts;
}

export function formatAssetWhen(ts: number, now = Date.now()): string {
  const ms = assetTimestampMs(ts);
  if (ms == null) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const diff = now - d.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function assetDateGroupId(ts: number, now = Date.now()): AssetDateGroupId {
  const ms = assetTimestampMs(ts);
  if (ms == null) return "unknown";
  const today0 = startOfLocalDay(now);
  if (ms >= today0) return "today";
  if (ms >= today0 - 6 * 86_400_000) return "week";
  return "older";
}

const GROUP_LABEL: Record<AssetDateGroupId, string> = {
  today: "今天",
  week: "近 7 天",
  older: "更早",
  unknown: "未知时间",
};

const GROUP_ORDER: AssetDateGroupId[] = ["today", "week", "older", "unknown"];

export function groupAssetsByDate(items: AssetEntry[], now = Date.now()): AssetDateGroup[] {
  const buckets = new Map<AssetDateGroupId, AssetEntry[]>();
  for (const id of GROUP_ORDER) buckets.set(id, []);
  for (const item of items) {
    const gid = assetDateGroupId(item.createdAt, now);
    buckets.get(gid)!.push(item);
  }
  return GROUP_ORDER.filter((id) => (buckets.get(id)?.length ?? 0) > 0).map((id) => ({
    id,
    label: GROUP_LABEL[id],
    items: buckets.get(id)!,
  }));
}

export const ASSET_LIB_DENSITY_KEY = "lizhi-kb-asset-lib-density";

export type AssetLibDensity = "list" | "grid";

export function loadAssetLibDensity(): AssetLibDensity {
  try {
    const raw = localStorage.getItem(ASSET_LIB_DENSITY_KEY);
    return raw === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export function saveAssetLibDensity(density: AssetLibDensity): void {
  try {
    localStorage.setItem(ASSET_LIB_DENSITY_KEY, density);
  } catch {
    /* ignore */
  }
}
