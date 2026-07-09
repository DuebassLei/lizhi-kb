<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { BookOpen, Download, PenLine, Plus, Search, Sparkles, X } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import EmptyState from "../ui/EmptyState.vue";
import JournalDayGroup from "./JournalDayGroup.vue";
import JournalEntryDrawer from "./JournalEntryDrawer.vue";
import JournalQuickCapture from "./JournalQuickCapture.vue";
import { useJournalStore } from "../../stores/journal";
import { useUiStore } from "../../stores/ui";
import { exportJournalMarkdown } from "../../utils/exportJournal";
import { formatDayLabel, todayDayDate } from "../../utils/journalDates";
import type { JournalDayGroup as DayGroup } from "../../types/journal";

const store = useJournalStore();
const ui = useUiStore();
const route = useRoute();
const router = useRouter();
const searchFocused = ref(false);

const groupsToShow = computed((): DayGroup[] => {
  if (store.isSearching) return store.dayGroups;

  const groups = store.dayGroups;
  const today = todayDayDate();
  if (groups.some((g) => g.dayDate === today)) return groups;
  return [
    {
      dayDate: today,
      label: formatDayLabel(today),
      entries: [],
    },
    ...groups,
  ];
});

const totalCount = computed(() => store.entries.length);
const todayCount = computed(() => store.todayEntries.length);

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return "夜深了，留一句给今天";
  if (h < 12) return "早上好，从一条小记开始";
  if (h < 18) return "下午好，记录此刻";
  return "晚上好，整理今日思绪";
});

onMounted(() => {
  void store.fetchAll();
  void handleComposeQuery();
});

watch(
  () => route.query.compose,
  () => {
    void handleComposeQuery();
  },
);

async function handleComposeQuery() {
  if (route.query.compose !== "1") return;
  await nextTick();
  focusQuickCapture();
  const nextQuery = { ...route.query };
  delete nextQuery.compose;
  await router.replace({ query: nextQuery });
}

async function onSubmit(content: string) {
  await store.add(content);
}

function onEdit(id: string) {
  store.select(id);
}

async function onDelete(id: string) {
  if (!window.confirm("确定删除这条小记？")) return;
  await store.remove(id);
}

async function onDrawerSave(content: string) {
  if (!store.selected) return;
  await store.save(store.selected.id, content);
  store.closeDrawer();
}

async function onDrawerDelete() {
  if (!store.selected) return;
  if (!window.confirm("确定删除这条小记？")) return;
  await store.remove(store.selected.id);
}

function focusQuickCapture() {
  document.querySelector<HTMLTextAreaElement>('[data-testid="journal-quick-capture"] textarea')?.focus();
}

async function onExport() {
  if (store.entries.length === 0) {
    ui.showToast("error", "暂无小记可导出");
    return;
  }
  try {
    const ok = await exportJournalMarkdown(store.entries);
    if (ok) ui.showToast("success", "小记已导出为 Markdown");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "导出失败";
    ui.showToast("error", msg);
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-canvas" data-testid="journal-timeline">
    <header class="shrink-0 border-b border-border bg-surface-0/50 backdrop-blur-sm">
      <div class="mx-auto max-w-2xl px-5 py-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-lg border border-paw/20 bg-paw-muted text-paw"
                aria-hidden="true"
              >
                <PenLine class="h-4 w-4" />
              </span>
              <div>
                <h1 class="text-sm font-semibold tracking-tight text-[var(--color-text)]">
                  每日小记
                </h1>
                <p class="text-[11px] text-muted">{{ greeting }}</p>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Btn
              variant="ghost"
              size="sm"
              aria-label="导出小记"
              data-testid="journal-export-btn"
              :disabled="store.entries.length === 0"
              title="导出 Markdown"
              @click="onExport"
            >
              <Download class="h-3.5 w-3.5" />
            </Btn>
            <Btn variant="primary" size="sm" data-testid="journal-add-btn" @click="focusQuickCapture">
              <Plus class="mr-1 h-3.5 w-3.5" />
              写一条
            </Btn>
          </div>
        </div>

        <div
          v-if="!store.loading && totalCount > 0"
          class="mt-3 flex flex-wrap gap-2"
          role="status"
          aria-label="小记统计"
        >
          <span class="journal-stat-chip">
            共 <strong class="font-medium text-[var(--color-text)]">{{ totalCount }}</strong> 条
          </span>
          <span class="journal-stat-chip journal-stat-chip--accent">
            今日 <strong class="font-medium text-paw">{{ todayCount }}</strong> 条
          </span>
          <span v-if="store.isSearching" class="journal-stat-chip">
            匹配 <strong class="font-medium text-link">{{ store.filteredEntries.length }}</strong> 条
          </span>
        </div>

        <div
          class="journal-search mt-3"
          :class="{ 'journal-search--focused': searchFocused }"
        >
          <label class="journal-search__inner">
            <Search class="journal-search__icon" aria-hidden="true" />
            <input
              v-model="store.searchQuery"
              type="text"
              inputmode="search"
              enterkeyhint="search"
              autocomplete="off"
              placeholder="搜索小记内容…"
              class="journal-search__input focus-ring"
              data-testid="journal-search-input"
              @focus="searchFocused = true"
              @blur="searchFocused = false"
            />
            <button
              v-if="store.searchQuery"
              type="button"
              class="journal-search__clear focus-ring"
              aria-label="清除搜索"
              @click="store.clearSearch()"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </label>
        </div>
      </div>
    </header>

    <div v-if="store.loading" class="flex flex-1 flex-col items-center justify-center gap-3">
      <div class="h-8 w-8 animate-pulse rounded-full bg-paw-muted" aria-hidden="true" />
      <p class="text-sm text-muted">加载小记…</p>
    </div>

    <div
      v-else-if="store.entries.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-8 px-5 py-16"
    >
      <EmptyState title="还没有小记" description="像日记一样随手记录，支持 Markdown 格式">
        <template #icon>
          <BookOpen class="h-8 w-8" />
        </template>
      </EmptyState>
      <div class="w-full max-w-2xl">
        <div class="mb-3 flex items-center gap-2 text-[11px] text-muted">
          <Sparkles class="h-3.5 w-3.5 text-paw" />
          <span>写下第一条，它会出现在时间线顶部</span>
        </div>
        <JournalQuickCapture prominent @submit="onSubmit" />
      </div>
    </div>

    <div
      v-else-if="store.isSearching && store.filteredEntries.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center"
      data-testid="journal-search-empty"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-1 text-muted"
        aria-hidden="true"
      >
        <Search class="h-5 w-5" />
      </div>
      <div class="space-y-1">
        <p class="text-sm text-[var(--color-text)]">没有匹配结果</p>
        <p class="text-xs text-muted">关键词「{{ store.searchQuery }}」未出现在任何小记中</p>
      </div>
      <Btn variant="secondary" size="sm" @click="store.clearSearch()">清除搜索</Btn>
    </div>

    <div v-else class="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-2xl px-5 py-6">
        <div class="space-y-10">
          <JournalDayGroup
            v-for="group in groupsToShow"
            :key="group.dayDate"
            :group="group"
            :show-quick-capture="!store.isSearching"
            @submit="onSubmit"
            @edit="onEdit"
            @delete="onDelete"
          />
        </div>
      </div>
    </div>

    <JournalEntryDrawer
      :entry="store.selected"
      :open="store.drawerOpen"
      @close="store.closeDrawer()"
      @save="onDrawerSave"
      @delete="onDrawerDelete"
    />
  </div>
</template>

<style scoped>
.journal-stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 55%, transparent);
  padding: 0.25rem 0.625rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.journal-stat-chip--accent {
  border-color: color-mix(in srgb, var(--color-paw) 28%, transparent);
  background: color-mix(in srgb, var(--color-paw) 8%, transparent);
}

.journal-search {
  border-radius: var(--radius-lg);
  transition: box-shadow 0.15s ease;
}

.journal-search--focused {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-paw) 35%, transparent);
}

.journal-search__inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.25rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 65%, transparent);
  padding: 0 0.625rem 0 0.75rem;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.journal-search--focused .journal-search__inner {
  border-color: color-mix(in srgb, var(--color-paw) 40%, transparent);
  background: color-mix(in srgb, var(--color-surface-1) 85%, transparent);
}

.journal-search__icon {
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
  color: var(--color-muted);
}

.journal-search__input {
  min-width: 0;
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.5rem 0;
  font-size: var(--text-sm);
  color: var(--color-text);
  outline: none;
}

.journal-search__input::placeholder {
  color: var(--color-muted);
}

.journal-search__clear {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  padding: 0.25rem;
  color: var(--color-muted);
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.journal-search__clear:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}
</style>
