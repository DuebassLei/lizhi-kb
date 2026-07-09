<script setup lang="ts">
import { PenLine } from "@lucide/vue";
import { RouterLink, useRouter } from "vue-router";
import { computed } from "vue";
import EmptyState from "../ui/EmptyState.vue";
import { formatRelativeTime } from "../../composables/useDashboardInsights";
import { useDocumentsStore } from "../../stores/documents";

const documents = useDocumentsStore();
const router = useRouter();
const recent = computed(() => documents.tree.slice(0, 6));

async function open(id: string) {
  await router.push("/workspace");
  await documents.openDocument(id);
}
</script>

<template>
  <div data-testid="recent-documents">
    <ul v-if="recent.length" class="divide-y divide-divider">
      <li
        v-for="doc in recent"
        :key="doc.id"
        class="group flex cursor-pointer items-center gap-3 py-3 first:pt-0 last:pb-0"
        @click="open(doc.id)"
      >
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-1 text-paw"
        >
          <PenLine :size="14" aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-[var(--color-text)] group-hover:text-link">
            {{ doc.title }}
          </p>
          <p class="text-[10px] text-muted">{{ formatRelativeTime(doc.updatedAt) }}</p>
        </div>
      </li>
    </ul>
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
