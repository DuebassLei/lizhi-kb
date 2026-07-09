import type { LaunchRecord } from "../types/launchRecord";

export function matchesLaunchRecordKeyword(record: LaunchRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    record.recordNumber,
    record.title,
    record.version,
    record.clientName,
    record.projectName,
    record.changeSummary,
    record.releaseNotes,
    record.operator,
    record.owner,
    record.approver,
    ...(record.tags ?? []),
  ]
    .filter((v): v is string => Boolean(v?.trim()))
    .join("\n")
    .toLowerCase();

  return haystack.includes(q);
}
