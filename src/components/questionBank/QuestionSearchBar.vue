<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Search, X, ChevronDown, ArrowUpDown } from "@lucide/vue";
import { useQuestionBankStore } from "../../stores/questionBank";
import type { QuestionSortBy, QuestionType } from "../../types/questionBank";
import { DIFFICULTY_LABELS, QUESTION_SORT_LABELS } from "../../types/questionBank";

const store = useQuestionBankStore();
const keyword = ref("");
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const showDifficulty = ref(false);
const showSort = ref(false);
const difficultyRoot = ref<HTMLElement | null>(null);
const sortRoot = ref<HTMLElement | null>(null);

function onDocClick(e: MouseEvent) {
  const target = e.target as Node;
  if (showDifficulty.value && difficultyRoot.value && !difficultyRoot.value.contains(target)) {
    showDifficulty.value = false;
  }
  if (showSort.value && sortRoot.value && !sortRoot.value.contains(target)) {
    showSort.value = false;
  }
}

onMounted(() => document.addEventListener("click", onDocClick));
onUnmounted(() => document.removeEventListener("click", onDocClick));

const types: Array<{ value: QuestionType | null; label: string }> = [
  { value: null, label: "全部" },
  { value: "single", label: "单选" },
  { value: "multi", label: "多选" },
  { value: "truefalse", label: "判断" },
];

const difficulties = [
  { value: 0, label: "全部难度" },
  { value: 1, label: "容易" },
  { value: 2, label: "中等" },
  { value: 3, label: "困难" },
];

const sortOptions: QuestionSortBy[] = [
  "created_desc",
  "created_asc",
  "updated_desc",
  "default",
];

const typeCount = computed(() => {
  const map: Record<string, number> = {};
  for (const t of store.stats?.byType ?? []) {
    map[t.type] = t.count;
  }
  return map;
});

const hasActiveFilters = computed(
  () =>
    store.activeType !== null
    || store.activeDifficulty > 0
    || !!keyword.value.trim()
    || store.activeSortBy !== "created_desc",
);

const difficultyLabel = computed(() => {
  const d = store.activeDifficulty;
  return d > 0 ? DIFFICULTY_LABELS[d as 1 | 2 | 3] : "难度";
});

const sortLabel = computed(() => QUESTION_SORT_LABELS[store.activeSortBy]);

function onKeywordInput() {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(() => {
    store.search({
      keyword: keyword.value.trim() || undefined,
      page: 1,
    });
  }, 300);
}

function clearKeyword() {
  keyword.value = "";
  store.search({ keyword: undefined, page: 1 });
}

function selectType(type: QuestionType | null) {
  store.setTypeFilter(type);
}

function selectDifficulty(diff: number) {
  store.setDifficultyFilter(diff);
  showDifficulty.value = false;
}

function selectSort(sortBy: QuestionSortBy) {
  store.setSortBy(sortBy);
  showSort.value = false;
}

function clearFilters() {
  keyword.value = "";
  showDifficulty.value = false;
  showSort.value = false;
  store.setTypeFilter(null);
  store.setDifficultyFilter(0);
  store.setSortBy("created_desc");
  if (store.searchParams.keyword) {
    store.search({ keyword: undefined, page: 1 });
  }
}

function typeCountLabel(type: QuestionType | null): string {
  if (!store.stats) return "";
  if (type === null) return String(store.stats.total);
  return String(typeCount.value[type] ?? 0);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Search bar -->
    <div class="relative">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--qb-ink-faint,#9a958c)]" />
      <input
        v-model="keyword"
        type="text"
        placeholder="搜索题目…（题干 / 选项 / 标签）"
        class="search-input qb-search w-full py-2.5 pl-10 pr-20 text-sm transition-colors"
        @input="onKeywordInput"
      />
      <button
        v-if="keyword"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--qb-ink-faint)] transition-colors hover:text-[var(--qb-ink-soft)]"
        title="清除"
        @click="clearKeyword"
      >
        <X class="h-4 w-4" />
      </button>
      <kbd
        v-else
        class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)]
               bg-[color-mix(in_srgb,var(--color-surface-0)_70%,transparent)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--qb-ink-faint)]"
      >
        Ctrl+K
      </kbd>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-x-2 gap-y-2">
      <!-- Type segmented -->
      <div class="flex overflow-hidden rounded-lg border border-border">
        <button
          v-for="t in types"
          :key="t.value ?? 'all'"
          class="px-2.5 py-1 text-xs font-medium transition-colors"
          :class="
            store.activeType === t.value
              ? 'bg-link/15 text-link'
              : 'bg-base text-text-secondary hover:bg-surface-0 hover:text-text'
          "
          @click="selectType(t.value)"
        >
          {{ t.label }}
          <span
            v-if="store.stats && store.activeType === t.value"
            class="ml-1 tabular-nums opacity-70"
          >{{ typeCountLabel(t.value) }}</span>
        </button>
      </div>

      <span class="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />

      <!-- Difficulty dropdown -->
      <div ref="difficultyRoot" class="relative">
        <button
          class="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
          :class="
            store.activeDifficulty > 0
              ? 'border-link/25 bg-link/15 text-link'
              : 'border-border bg-base text-text-secondary hover:border-border-strong'
          "
          @click.stop="showDifficulty = !showDifficulty; showSort = false"
        >
          {{ difficultyLabel }}
          <ChevronDown class="h-3 w-3 opacity-60" />
        </button>
        <div
          v-if="showDifficulty"
          class="absolute left-0 top-full z-20 mt-1 min-w-[7rem] overflow-hidden rounded-lg
                 border border-border bg-surface-0 py-1 shadow-float"
        >
          <button
            v-for="d in difficulties"
            :key="d.value"
            class="block w-full px-3 py-1.5 text-left text-xs transition-colors"
            :class="
              store.activeDifficulty === d.value
                ? 'bg-link/10 text-link'
                : 'text-text-secondary hover:bg-surface-1 hover:text-text'
            "
            @click="selectDifficulty(d.value)"
          >
            {{ d.label }}
          </button>
        </div>
      </div>

      <!-- Sort dropdown -->
      <div ref="sortRoot" class="relative">
        <button
          class="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
          :class="
            store.activeSortBy !== 'created_desc'
              ? 'border-link/25 bg-link/15 text-link'
              : 'border-border bg-base text-text-secondary hover:border-border-strong'
          "
          @click.stop="showSort = !showSort; showDifficulty = false"
        >
          <ArrowUpDown class="h-3 w-3 opacity-70" />
          {{ sortLabel }}
          <ChevronDown class="h-3 w-3 opacity-60" />
        </button>
        <div
          v-if="showSort"
          class="absolute left-0 top-full z-20 mt-1 min-w-[8.5rem] overflow-hidden rounded-lg
                 border border-border bg-surface-0 py-1 shadow-float"
        >
          <button
            v-for="s in sortOptions"
            :key="s"
            class="block w-full px-3 py-1.5 text-left text-xs transition-colors"
            :class="
              store.activeSortBy === s
                ? 'bg-link/10 text-link'
                : 'text-text-secondary hover:bg-surface-1 hover:text-text'
            "
            @click="selectSort(s)"
          >
            {{ QUESTION_SORT_LABELS[s] }}
          </button>
        </div>
      </div>

      <button
        v-if="hasActiveFilters"
        class="btn-ghost px-2 py-1 text-xs"
        @click="clearFilters"
      >
        清除筛选
      </button>
    </div>
  </div>
</template>
