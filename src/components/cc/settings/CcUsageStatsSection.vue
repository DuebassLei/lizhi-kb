<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Loader2, RefreshCw } from "@lucide/vue";

import { useUiStore } from "../../../stores/ui";
import { getCcUsageStats, type CcUsageEntry } from "../../../services/ccWorkbenchService";
import { loadExtendedChatPrefs } from "../../../composables/cc/useCcModelCatalog";

const ui = useUiStore();
const loading = ref(true);
const entries = ref<CcUsageEntry[]>([]);

const customModelPricing = computed(() => {
  const prefs = loadExtendedChatPrefs();
  const map = new Map<string, { inputPrice?: number; outputPrice?: number }>();
  for (const models of Object.values(prefs.customModels)) {
    for (const m of models) {
      if (m.inputPrice != null || m.outputPrice != null) {
        map.set(m.id, { inputPrice: m.inputPrice, outputPrice: m.outputPrice });
      }
    }
  }
  return map;
});

const rows = computed(() =>
  [...entries.value]
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((e) => {
      const pricing = customModelPricing.value.get(e.model);
      let cost = e.estimatedCost;
      if (cost == null && pricing) {
        const inP = pricing.inputPrice ?? 0;
        const outP = pricing.outputPrice ?? 0;
        cost = (e.inputTokens * inP + e.outputTokens * outP) / 1_000_000;
      }
      return { ...e, displayCost: cost };
    }),
);

const totals = computed(() => {
  let input = 0;
  let output = 0;
  let cost = 0;
  for (const row of rows.value) {
    input += row.inputTokens;
    output += row.outputTokens;
    if (row.displayCost != null) cost += row.displayCost;
  }
  return { input, output, cost, sessions: rows.value.length };
});

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCost(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(4)}`;
}

async function load(showToast = false) {
  loading.value = true;
  try {
    entries.value = await getCcUsageStats();
    if (showToast) ui.showToast("success", "用量统计已刷新");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "加载用量失败");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="cc-usage-section" data-testid="cc-usage-stats-section">
    <header class="cc-usage-section__header">
      <div>
        <h3 class="cc-usage-section__title">用量统计</h3>
        <p class="cc-usage-section__subtitle">
          会话 token 记录保存在 <code>~/.lizhi-kb/cc-usage.json</code>；自定义模型定价用于估算费用
        </p>
      </div>
      <button
        type="button"
        class="cc-usage-section__refresh"
        title="刷新"
        :disabled="loading"
        @click="load(true)"
      >
        <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
      </button>
    </header>

    <div class="cc-usage-section__summary">
      <span>{{ totals.sessions }} 次会话</span>
      <span>输入 {{ totals.input.toLocaleString() }} tok</span>
      <span>输出 {{ totals.output.toLocaleString() }} tok</span>
      <span v-if="totals.cost > 0">估算 ${{ totals.cost.toFixed(4) }}</span>
    </div>

    <div v-if="loading" class="cc-usage-section__loading">
      <Loader2 class="h-4 w-4 animate-spin" />
      加载中…
    </div>

    <div v-else-if="!rows.length" class="cc-usage-section__empty">暂无用量记录，完成对话后会自动记录</div>

    <div v-else class="cc-usage-section__table-wrap">
      <table class="cc-usage-section__table">
        <thead>
          <tr>
            <th>时间</th>
            <th>模型</th>
            <th>输入</th>
            <th>输出</th>
            <th>耗时</th>
            <th>费用</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="`${row.timestamp}-${i}`">
            <td>{{ formatTime(row.timestamp) }}</td>
            <td class="font-mono text-[0.625rem]">{{ row.model }}</td>
            <td>{{ row.inputTokens.toLocaleString() }}</td>
            <td>{{ row.outputTokens.toLocaleString() }}</td>
            <td>{{ row.durationMs ? `${Math.round(row.durationMs / 1000)}s` : "—" }}</td>
            <td>{{ formatCost(row.displayCost) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.cc-usage-section {
  padding: 0.75rem 1.125rem 1.25rem;
}

.cc-usage-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.cc-usage-section__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-usage-section__subtitle {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-usage-section__refresh {
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  padding: 0.375rem;
  color: var(--color-muted);
}

.cc-usage-section__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.75rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-usage-section__loading,
.cc-usage-section__empty {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-usage-section__table-wrap {
  margin-top: 0.75rem;
  overflow-x: auto;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
}

.cc-usage-section__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.6875rem;
}

.cc-usage-section__table th,
.cc-usage-section__table td {
  padding: 0.5rem 0.625rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.cc-usage-section__table th {
  background: color-mix(in srgb, var(--color-surface-1) 60%, transparent);
  font-weight: 500;
  color: var(--color-muted);
}

.cc-usage-section__table tr:last-child td {
  border-bottom: none;
}
</style>
