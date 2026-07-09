<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ListTree } from "@lucide/vue";
import type { HeadingItem } from "../../utils/headings";

const props = defineProps<{
  headings: HeadingItem[];
}>();

const emit = defineEmits<{
  select: [text: string];
}>();

const activeKey = ref<string | null>(null);

const headingCount = computed(() => props.headings.length);

function itemKey(h: HeadingItem, index: number) {
  return `${h.slug}-${index}`;
}

function levelIndent(level: number) {
  return `${(level - 1) * 0.75}rem`;
}

function onSelect(h: HeadingItem, index: number) {
  activeKey.value = itemKey(h, index);
  emit("select", h.text);
}

watch(
  () => props.headings,
  () => {
    activeKey.value = null;
  },
  { deep: true },
);
</script>

<template>
  <aside
    class="toc-panel hidden w-60 shrink-0 self-stretch overflow-hidden border-l border-border bg-surface-0 lg:flex lg:flex-col"
    data-testid="document-toc"
  >
    <div class="toc-panel__header">
      <div class="flex min-w-0 items-center gap-1.5">
        <ListTree class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        <h3 class="text-[11px] font-semibold tracking-wide text-text-secondary">大纲</h3>
      </div>
      <span v-if="headingCount" class="tree-count-badge">{{ headingCount }}</span>
    </div>

    <nav class="toc-panel__body scrollbar-thin" aria-label="文档大纲">
      <ul v-if="headingCount" class="toc-list">
        <li
          v-for="(h, i) in headings"
          :key="itemKey(h, i)"
          class="toc-list__item"
          :style="{ '--toc-indent': levelIndent(h.level) }"
        >
          <button
            type="button"
            class="toc-item focus-ring"
            :class="{
              'toc-item--active': activeKey === itemKey(h, i),
              [`toc-item--h${h.level}`]: true,
            }"
            :title="h.text"
            @click="onSelect(h, i)"
          >
            <span class="toc-item__rail" aria-hidden="true" />
            <span class="toc-item__dot" aria-hidden="true" />
            <span class="toc-item__label">{{ h.text }}</span>
          </button>
        </li>
      </ul>

      <div v-else class="toc-empty">
        <p class="text-xs leading-relaxed text-muted">本文暂无标题</p>
        <p class="mt-1.5 text-[11px] leading-relaxed text-muted/80">
          使用
          <code class="toc-empty__hint"># 标题</code>
          生成大纲导航
        </p>
      </div>
    </nav>
  </aside>
</template>
