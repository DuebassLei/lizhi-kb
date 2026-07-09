<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDocumentsStore } from "../../stores/documents";
import { useLinksStore } from "../../stores/links";

const links = useLinksStore();
const documents = useDocumentsStore();
const router = useRouter();

onMounted(() => {
  void links.ensureIndex(documents.tree);
});

const hasLinks = computed(() => links.stats.totalLinks > 0);

async function openDoc(id: string) {
  await router.push("/workspace");
  await documents.openDocument(id);
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="links.indexing" class="text-xs text-muted">正在分析链接…</div>

    <div class="grid gap-3 sm:grid-cols-3">
      <article class="rounded-lg bg-surface-1/60 px-4 py-3">
        <p class="text-[11px] text-muted">双链总数</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-link">
          {{ links.stats.totalLinks }}
        </p>
      </article>
      <article class="rounded-lg bg-surface-1/60 px-4 py-3">
        <p class="text-[11px] text-muted">孤立文档</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-paw">
          {{ links.stats.orphanCount }}
        </p>
      </article>
      <article class="rounded-lg bg-surface-1/60 px-4 py-3">
        <p class="text-[11px] text-muted">知识枢纽</p>
        <p class="mt-1 truncate text-sm font-medium text-[var(--color-text)]">
          {{ links.stats.hubDoc?.title ?? "—" }}
        </p>
        <p v-if="links.stats.hubDoc" class="text-[10px] text-muted">
          {{ links.stats.hubDoc.inbound }} 篇引用
        </p>
      </article>
    </div>

    <ul
      v-if="links.orphanIds.length"
      class="max-h-40 space-y-1 overflow-y-auto text-sm"
    >
      <li
        v-for="id in links.orphanIds.slice(0, 8)"
        :key="id"
        class="cursor-pointer truncate text-link hover:underline"
        @click="openDoc(id)"
      >
        {{ documents.tree.find((d) => d.id === id)?.title ?? id }}
      </li>
      <li v-if="links.orphanIds.length > 8" class="text-xs text-muted">
        还有 {{ links.orphanIds.length - 8 }} 篇…
      </li>
    </ul>

    <p
      v-else-if="documents.tree.length && !hasLinks"
      class="text-center text-xs leading-relaxed text-muted"
    >
      使用 <code class="text-link">[[文档标题]]</code> 连接你的知识
    </p>
  </div>
</template>
