<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useDashboardInsights } from "../../composables/useDashboardInsights";
import { useDocumentsStore } from "../../stores/documents";
import type { DashboardStats } from "../../types/document";

const documents = useDocumentsStore();
const { streak, avgWordsPerDoc, weekTrend, weekTotal } = useDashboardInsights();
const loading = computed(() => documents.stats === null);

const cards = [
  { key: "totalDocs" as const, label: "文档数", suffix: "篇", accent: false },
  { key: "totalWords" as const, label: "总字数", suffix: "字", accent: false },
  { key: "editsThisWeek" as const, label: "本周编辑", suffix: "次", accent: true },
  { key: "lastEditDate" as const, label: "最近活跃", suffix: "", accent: false },
];

onMounted(async () => {
  if (!documents.stats) await documents.fetchDashboard();
});

function formatValue(key: keyof DashboardStats): string {
  if (!documents.stats) return "—";
  const val = documents.stats[key];
  if (key === "lastEditDate") return val ? String(val) : "暂无";
  return String(val);
}

function subline(key: keyof DashboardStats): string | null {
  if (key === "editsThisWeek") {
    if (weekTrend.value > 0) return `较上周 +${weekTrend.value}%`;
    if (weekTrend.value < 0) return `较上周 ${weekTrend.value}%`;
    return `本周共 ${weekTotal.value} 次`;
  }
  if (key === "totalDocs" && avgWordsPerDoc.value > 0) {
    return `篇均 ${avgWordsPerDoc.value} 字`;
  }
  if (key === "totalWords" && documents.stats && documents.stats.totalDocs > 0) {
    return `${documents.stats.totalDocs} 篇贡献`;
  }
  if (key === "lastEditDate" && streak.value > 0) {
    return `连续 ${streak.value} 天`;
  }
  return null;
}
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="overview-cards">
    <template v-if="loading">
      <article v-for="i in 4" :key="`sk-${i}`" class="h-[96px] animate-pulse rounded-lg bg-surface-1" />
    </template>
    <template v-else>
      <article
        v-for="card in cards"
        :key="card.key"
        class="rounded-lg border border-border bg-surface-0 px-5 py-4 transition-colors hover:border-border-strong"
      >
        <p class="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
          {{ card.label }}
        </p>
        <p class="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--color-text)]">
          {{ formatValue(card.key) }}
          <span
            v-if="card.suffix && documents.stats?.[card.key]"
            class="text-sm font-normal text-muted"
          >
            {{ card.suffix }}
          </span>
        </p>
        <p v-if="subline(card.key)" class="mt-1 text-[10px] text-paw/90">
          {{ subline(card.key) }}
        </p>
      </article>
    </template>
  </div>
</template>
