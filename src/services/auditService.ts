import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";

export interface AuditEvent {
  id: string;
  eventType: string;
  detail?: string | null;
  createdAt: number;
}

const EVENT_LABELS: Record<string, string> = {
  unlock: "解锁知识库",
  unlock_fail: "解锁失败",
  lock: "锁定知识库",
  export: "导出文档",
  export_batch: "批量导出",
  export_obsidian: "Obsidian 导出",
};

export function auditEventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}

export async function listAuditEvents(limit = 50): Promise<AuditEvent[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<AuditEvent[]>("list_audit_events", { limit });
}

export async function logAuditEvent(eventType: string, detail?: string): Promise<void> {
  if (!isTauriRuntime()) return;
  // 审计写入由 Rust 侧在关键命令中完成；此函数供前端导出等场景补充埋点
  void eventType;
  void detail;
}
