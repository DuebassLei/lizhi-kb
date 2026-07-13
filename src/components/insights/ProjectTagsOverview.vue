<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { listAllTags, filterDocsByTag } from "../../utils/documentTags";
import { useDocumentsStore } from "../../stores/documents";
import { useInViewMotion } from "../../composables/useInViewMotion";

const documents = useDocumentsStore();
const router = useRouter();
const selectedTag = ref<string | null>(null);
const root = ref<HTMLElement | null>(null);
const inView = useInViewMotion(root, { threshold: 0.2, once: true });

const tagCounts = computed(() => {
  const tags = listAllTags();
  const ids = documents.tree.map((d) => d.id);
  return tags
    .map((tag) => ({
      tag,
      count: filterDocsByTag(ids, tag).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
});

const maxCount = computed(() => (tagCounts.value[0]?.count ?? 1));

onMounted(async () => {
  if (!documents.tree.length) await documents.fetchTree();
});

async function openTag(tag: string) {
  selectedTag.value = tag;
  await router.push({ path: "/workspace", query: { tag } });
}

function tagAccentClass(count: number): string {
  const ratio = count / maxCount.value;
  return ratio >= 0.6 ? "border-paw/50" : "border-link/40";
}
</script>

<template>
  <div ref="root" class="space-y-3" data-testid="project-tags-overview">
    <p class="text-xs text-muted">按标签聚合文档，点击可进入筛选列表（项目维度 MVP）</p>
    <div v-if="!tagCounts.length" class="py-6 text-center text-sm text-muted">暂无标签，可在文档属性面板添加</div>
    <div v-else class="flex flex-wrap gap-2">
      <button
        v-for="(item, idx) in tagCounts"
        :key="item.tag"
        type="button"
        class="insights-tag-pill focus-ring rounded-full border border-border bg-surface-1 px-3 py-1 text-xs"
        :class="[
          selectedTag === item.tag ? 'border-link text-link' : ['text-[var(--color-text)]', tagAccentClass(item.count)],
          inView ? 'insights-tag-pop' : 'opacity-0',
        ]"
        :style="{ animationDelay: inView ? `${idx * 30}ms` : undefined }"
        :data-testid="`project-tag-${item.tag}`"
        @click="openTag(item.tag)"
      >
        {{ item.tag }}
        <span class="insights-tag-count ml-1 text-muted">({{ item.count }})</span>
      </button>
    </div>
  </div>
</template>
