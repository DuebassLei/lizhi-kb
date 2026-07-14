<script setup lang="ts">
import { onMounted, ref } from "vue";
import { auditEventLabel, listAuditEvents, type AuditEvent } from "../../services/auditService";
import { getEditActivity } from "../../services/documentService";
import type { EditActivityDay } from "../../types/document";

const auditEvents = ref<AuditEvent[]>([]);
const editEntries = ref<EditActivityDay[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const [events, activity] = await Promise.all([
      listAuditEvents(30),
      getEditActivity(30),
    ]);
    auditEvents.value = events;
    editEntries.value = activity.filter((d) => d.editCount > 0).reverse();
  } finally {
    loading.value = false;
  }
});

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="py-6 text-center text-sm text-muted">加载中…</div>

    <template v-else>
      <div>
        <h4 class="mb-2 text-xs font-medium text-muted">安全与导出审计</h4>
        <ul
          v-if="auditEvents.length"
          class="divide-y divide-divider rounded-xl border border-border bg-surface-1"
        >
          <li
            v-for="(event, idx) in auditEvents"
            :key="event.id"
            class="flex items-center gap-3 px-4 py-2.5 text-sm"
          >
            <span
              class="insights-audit-timeline-dot"
              :style="{ animationDelay: `${idx * 40}ms` }"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <span class="text-[var(--color-text)]">{{ auditEventLabel(event.eventType) }}</span>
              <p
                v-if="event.detail"
                class="mt-0.5 truncate text-xs text-muted"
                :title="event.detail"
              >
                {{ event.detail }}
              </p>
            </div>
            <span class="shrink-0 text-xs text-muted">{{ formatTime(event.createdAt) }}</span>
          </li>
        </ul>
        <p v-else class="rounded-xl border border-border bg-surface-1 px-4 py-6 text-center text-xs text-muted">
          暂无审计记录（解锁/锁定/导出后将自动记录）
        </p>
      </div>

      <div>
        <h4 class="mb-2 text-xs font-medium text-muted">编辑活动</h4>
        <ul
          v-if="editEntries.length"
          class="divide-y divide-divider rounded-xl border border-border bg-surface-1"
        >
          <li
            v-for="entry in editEntries"
            :key="entry.date"
            class="insights-audit-row flex items-center justify-between px-4 py-2.5 text-sm"
          >
            <span class="text-[var(--color-text)]">{{ entry.date }}</span>
            <span class="text-muted">编辑 {{ entry.editCount }} 次</span>
          </li>
        </ul>
        <p v-else class="text-xs text-muted">暂无编辑记录</p>
      </div>
    </template>
  </div>
</template>
