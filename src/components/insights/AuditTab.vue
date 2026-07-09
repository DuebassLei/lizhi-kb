<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getEditActivity } from "../../services/documentService";
import type { EditActivityDay } from "../../types/document";

const entries = ref<EditActivityDay[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const activity = await getEditActivity(30);
    entries.value = activity.filter((d) => d.editCount > 0).reverse();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="space-y-3">
    <div v-if="loading" class="py-6 text-center text-sm text-muted">加载中…</div>

    <div
      v-else-if="!entries.length"
      class="flex flex-col items-center gap-3 py-12 text-center"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-1 text-lg text-muted">
        ◷
      </div>
      <p class="text-sm text-muted">暂无编辑记录</p>
      <p class="text-xs text-muted">开始写作后，活动将在此显示</p>
    </div>

    <ul v-else class="divide-y divide-divider rounded-xl border border-border bg-surface-1">
      <li
        v-for="entry in entries"
        :key="entry.date"
        class="flex items-center justify-between px-4 py-3 text-sm"
      >
        <span class="text-[var(--color-text)]">{{ entry.date }}</span>
        <span class="text-muted">编辑 {{ entry.editCount }} 次</span>
      </li>
    </ul>
  </div>
</template>
