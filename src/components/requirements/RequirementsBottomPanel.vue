<script setup lang="ts">
import { ref } from "vue";
import { BarChart3, Download, List } from "@lucide/vue";
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
</script>

<template>
  <section
    class="shrink-0 border-t border-border bg-surface-0/40"
    data-testid="requirements-bottom-panel"
  >
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
      <div class="module-tab-bar" role="tablist" aria-label="底部视图">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="module-tab-bar__btn focus-ring"
          :class="{ 'module-tab-bar__btn--active': view === tab.id }"
          :aria-selected="view === tab.id"
          :data-testid="`requirements-tab-${tab.id}`"
          @click="view = tab.id"
        >
          <component :is="tab.icon" class="h-3.5 w-3.5" aria-hidden="true" />
          {{ tab.label }}
        </button>
      </div>

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
