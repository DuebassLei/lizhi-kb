import { WA_STEP_ORDER, type WaStepId } from "../../types/writingAssistant";

/**
 * 修改某个已采用的上游步骤后，标记其下游步骤为 stale。
 * 不自动清空下游内容（spec §3.2）。
 *
 * 顺序：topic → outline → body → humanize → illustrations → cover → finalize
 * 关闭的 illustrations / cover 步骤跳过，但仍标记其后可达步骤。
 */
export function markStaleAfter(upstream: WaStepId): WaStepId[] {
  const idx = WA_STEP_ORDER.indexOf(upstream);
  if (idx === -1) return [];
  return WA_STEP_ORDER.slice(idx + 1);
}

/** 是否所有 stale 步骤都已处理（重新生成或重新采用） */
export function hasStaleFlags(flags: Record<WaStepId, boolean>): boolean {
  return WA_STEP_ORDER.some((id) => Boolean(flags[id]));
}
