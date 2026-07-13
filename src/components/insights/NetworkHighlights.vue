<script setup lang="ts">
import { computed, onMounted, toRef } from "vue";
import { useRouter } from "vue-router";
import AnimatedMetric from "./AnimatedMetric.vue";
import { useDashboardInsights } from "../../composables/useDashboardInsights";
import { useDocumentsStore } from "../../stores/documents";
import { useLinksStore } from "../../stores/links";

const links = useLinksStore();
const documents = useDocumentsStore();
const router = useRouter();
const { avgWordsPerDoc } = useDashboardInsights();

onMounted(() => {
  void links.ensureLinkInsights();
});

const linkDensity = computed(() => {
  const docs = documents.stats?.totalDocs ?? 0;
  if (docs === 0) return 0;
  return Math.round((links.stats.totalLinks / docs) * 10) / 10;
});

const maxInbound = computed(() =>
  Math.max(1, ...links.topHubs.map((h) => h.inbound)),
);

const totalLinks = toRef(() => links.stats.totalLinks);
const orphanCount = toRef(() => links.stats.orphanCount);
const avgWords = toRef(() => avgWordsPerDoc.value);
const density = toRef(() => linkDensity.value);

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
        <p class="text-lg font-semibold text-link">
          <AnimatedMetric :value="totalLinks" />
        </p>
      </div>
      <div class="rounded-lg border border-border bg-surface-0 px-3 py-2.5">
        <p class="text-[10px] text-muted">孤立文档</p>
        <p class="text-lg font-semibold text-paw">
          <AnimatedMetric :value="orphanCount" />
        </p>
      </div>
      <div class="rounded-lg border border-border bg-surface-0 px-3 py-2.5">
        <p class="text-[10px] text-muted">篇均字数</p>
        <p class="text-lg font-semibold text-[var(--color-text)]">
          <AnimatedMetric :value="avgWords" />
        </p>
      </div>
      <div class="rounded-lg border border-border bg-surface-0 px-3 py-2.5">
        <p class="text-[10px] text-muted">链密度</p>
        <p class="text-lg font-semibold tabular-nums text-[var(--color-text)]">
          <AnimatedMetric :value="density" :decimals="1" />
        </p>
      </div>
    </div>

    <div v-if="links.topHubs.length">
      <p class="mb-2 text-[11px] text-muted">引用枢纽 Top {{ links.topHubs.length }}</p>
      <ul class="space-y-2">
        <li
          v-for="(hub, i) in links.topHubs"
          :key="hub.id"
          class="flex cursor-pointer flex-col gap-1 rounded-lg bg-surface-1/40 px-3 py-2 hover:bg-surface-1/70"
          @click="openDoc(hub.id)"
        >
          <div class="flex items-center gap-3">
            <span class="w-4 text-[10px] tabular-nums text-muted">{{ i + 1 }}</span>
            <span class="min-w-0 flex-1 truncate text-sm text-[var(--color-text)]">{{ hub.title }}</span>
            <span class="shrink-0 text-[10px] text-muted">
              ↓{{ hub.inbound }} · ↑{{ hub.outbound }}
            </span>
          </div>
          <div
            class="insights-hub-bar ml-7"
            :style="{ width: `${(hub.inbound / maxInbound) * 100}%`, animationDelay: `${i * 80}ms` }"
          />
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
