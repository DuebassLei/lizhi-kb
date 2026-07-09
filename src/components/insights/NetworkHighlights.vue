<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDashboardInsights } from "../../composables/useDashboardInsights";
import { useDocumentsStore } from "../../stores/documents";
import { useLinksStore } from "../../stores/links";

const links = useLinksStore();
const documents = useDocumentsStore();
const router = useRouter();
const { avgWordsPerDoc } = useDashboardInsights();

onMounted(() => {
  void links.ensureIndex(documents.tree);
});

const linkDensity = computed(() => {
  const docs = documents.stats?.totalDocs ?? 0;
  if (docs === 0) return 0;
  return Math.round((links.stats.totalLinks / docs) * 10) / 10;
});

async function openDoc(id: string) {
  await router.push("/workspace");
  await documents.openDocument(id);
}
</script>

<template>
  <div class="space-y-5" data-testid="network-highlights">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-lg border border-border bg-surface-0 px-3 py-2.5">
        <p class="text-[10px] text-muted">双链总数</p>
        <p class="text-lg font-semibold tabular-nums text-link">{{ links.stats.totalLinks }}</p>
      </div>
      <div class="rounded-lg border border-border bg-surface-0 px-3 py-2.5">
        <p class="text-[10px] text-muted">孤立文档</p>
        <p class="text-lg font-semibold tabular-nums text-paw">{{ links.stats.orphanCount }}</p>
      </div>
      <div class="rounded-lg border border-border bg-surface-0 px-3 py-2.5">
        <p class="text-[10px] text-muted">篇均字数</p>
        <p class="text-lg font-semibold tabular-nums text-[var(--color-text)]">{{ avgWordsPerDoc }}</p>
      </div>
      <div class="rounded-lg border border-border bg-surface-0 px-3 py-2.5">
        <p class="text-[10px] text-muted">链密度</p>
        <p class="text-lg font-semibold tabular-nums text-[var(--color-text)]">{{ linkDensity }}</p>
      </div>
    </div>

    <div v-if="links.topHubs.length">
      <p class="mb-2 text-[11px] text-muted">引用枢纽 Top {{ links.topHubs.length }}</p>
      <ul class="space-y-2">
        <li
          v-for="(hub, i) in links.topHubs"
          :key="hub.id"
          class="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-1/40 px-3 py-2 hover:bg-surface-1/70"
          @click="openDoc(hub.id)"
        >
          <span class="w-4 text-[10px] tabular-nums text-muted">{{ i + 1 }}</span>
          <span class="min-w-0 flex-1 truncate text-sm text-[var(--color-text)]">{{ hub.title }}</span>
          <span class="shrink-0 text-[10px] text-muted">
            ↓{{ hub.inbound }} · ↑{{ hub.outbound }}
          </span>
        </li>
      </ul>
    </div>

    <ul v-else-if="links.orphanIds.length" class="max-h-36 space-y-1 overflow-y-auto text-sm">
      <p class="mb-1 text-[11px] text-muted">待联结的孤立文档</p>
      <li
        v-for="id in links.orphanIds.slice(0, 6)"
        :key="id"
        class="cursor-pointer truncate text-link hover:underline"
        @click="openDoc(id)"
      >
        {{ documents.tree.find((d) => d.id === id)?.title ?? id }}
      </li>
    </ul>

    <p v-else class="text-center text-xs leading-relaxed text-muted">
      用 <code class="text-link">[[文档标题]]</code> 把知识点织成网
    </p>
  </div>
</template>
