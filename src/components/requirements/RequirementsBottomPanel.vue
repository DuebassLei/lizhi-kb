<script setup lang="ts">
import { ref } from "vue";
import { BarChart3, Download, List, Upload } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import type { Requirement } from "../../types/requirement";
import { useRequirementsStore } from "../../stores/requirements";
import { useUiStore } from "../../stores/ui";
import { exportRequirementsCsv } from "../../utils/exportRequirements";
import RequirementsList from "./RequirementsList.vue";
import RequirementsStats from "./RequirementsStats.vue";

defineProps<{
  items: Requirement[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

type BottomView = "list" | "stats";

const view = ref<BottomView>("list");
const importing = ref(false);

const store = useRequirementsStore();
const ui = useUiStore();

const tabs: Array<{ id: BottomView; label: string; icon: typeof List }> = [
  { id: "list", label: "需求清单", icon: List },
  { id: "stats", label: "统计图表", icon: BarChart3 },
];

async function onExport() {
  if (store.items.length === 0) {
    ui.showToast("error", "暂无需求可导出");
    return;
  }
  try {
    const ok = await exportRequirementsCsv(store.items);
    if (ok) ui.showToast("success", "清单已导出");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "导出失败";
    ui.showToast("error", msg);
  }
}

async function onImport() {
  if (importing.value) return;
  importing.value = true;
  try {
    const result = await store.importFromCsv();
    if (!result) return;
    const parts = [`已导入 ${result.imported} 条`];
    if (result.skipped > 0) parts.push(`跳过重复 ${result.skipped} 条`);
    if (result.failed > 0) parts.push(`失败 ${result.failed} 条`);
    ui.showToast(result.imported > 0 ? "success" : "error", parts.join("，"));
    if (result.errors.length > 0 && result.errors.length <= 3) {
      result.errors.forEach((msg) => ui.showToast("error", msg));
    } else if (result.errors.length > 3) {
      ui.showToast("error", `${result.errors.length} 行解析有误，请检查 CSV 格式`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "导入失败";
    ui.showToast("error", msg);
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <section
    class="shrink-0 border-t border-border bg-surface-0/30"
    data-testid="requirements-bottom-panel"
  >
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
      <div
        class="inline-flex rounded-lg border border-border bg-surface-1/50 p-0.5"
        role="tablist"
        aria-label="底部视图"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="focus-ring inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150"
          :class="
            view === tab.id
              ? 'bg-surface-2 text-[var(--color-text)] shadow-sm'
              : 'text-muted hover:text-[var(--color-text)]'
          "
          :aria-selected="view === tab.id"
          :data-testid="`requirements-tab-${tab.id}`"
          @click="view = tab.id"
        >
          <component :is="tab.icon" class="h-3.5 w-3.5" aria-hidden="true" />
          {{ tab.label }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Btn
          variant="secondary"
          :disabled="importing"
          data-testid="import-requirements-btn"
          aria-label="导入 CSV"
          @click="onImport"
        >
          <Upload class="mr-1 inline h-3.5 w-3.5" />
          {{ importing ? "导入中…" : "导入 CSV" }}
        </Btn>
        <Btn
          variant="secondary"
          :disabled="items.length === 0"
          data-testid="export-requirements-btn"
          aria-label="导出 CSV"
          @click="onExport"
        >
          <Download class="mr-1 inline h-3.5 w-3.5" />
          导出 CSV
        </Btn>
      </div>
    </header>

    <RequirementsList
      v-show="view === 'list'"
      :items="items"
      :selected-id="selectedId"
      @select="emit('select', $event)"
    />

    <RequirementsStats v-if="view === 'stats'" :items="items" />
  </section>
</template>
