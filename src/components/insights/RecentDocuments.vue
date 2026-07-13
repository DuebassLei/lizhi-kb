<script setup lang="ts">
import { PenLine } from "@lucide/vue";
import { RouterLink, useRouter } from "vue-router";
import { computed, onMounted, ref } from "vue";
import EmptyState from "../ui/EmptyState.vue";
import { formatRelativeTime } from "../../composables/useDashboardInsights";
import { useDocumentsStore } from "../../stores/documents";
import { hasInsightsMotionPlayed, markInsightsMotionPlayed } from "../../utils/insightsMotionSession";

const documents = useDocumentsStore();
const router = useRouter();
const recent = computed(() => documents.tree);
const motionEnabled = ref(!hasInsightsMotionPlayed());

onMounted(() => {
  if (motionEnabled.value) {
    markInsightsMotionPlayed();
  }
});

async function open(id: string) {
  await router.push("/workspace");
  await documents.openDocument(id);
}
</script>

<template>
  <div
    class="insights-recent-scroll scrollbar-thin overflow-y-auto lg:min-h-0 lg:flex-1"
    data-testid="recent-documents"
  >
    <TransitionGroup
      v-if="recent.length"
      name="insights-recent"
      tag="ul"
      class="divide-y divide-divider"
      :css="motionEnabled"
    >
      <li
        v-for="(doc, idx) in recent"
        :key="doc.id"
        class="insights-recent-item group flex cursor-pointer items-center gap-3 py-3"
        :style="motionEnabled ? { transitionDelay: `${idx * 50}ms` } : undefined"
        @click="open(doc.id)"
      >
        <span
          class="insights-recent-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-1 text-paw"
        >
          <PenLine :size="14" aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1 pl-1">
          <p class="truncate text-sm text-[var(--color-text)] group-hover:text-link">
            {{ doc.title }}
          </p>
          <p class="text-[10px] text-muted">{{ formatRelativeTime(doc.updatedAt) }}</p>
        </div>
      </li>
    </TransitionGroup>
    <EmptyState v-else title="还没有文档" description="创建第一篇，开始记录知识">
      <template #icon>
        <PenLine :size="24" aria-hidden="true" />
      </template>
      <template #action>
        <RouterLink to="/workspace" class="text-xs text-link hover:underline">
          去创建第一篇
        </RouterLink>
      </template>
    </EmptyState>
  </div>
</template>
