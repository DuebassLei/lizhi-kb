<script setup lang="ts">

import { computed, nextTick, onMounted, ref, watch } from "vue";

import { useRoute, useRouter } from "vue-router";

import { BookOpen, Download, Plus } from "@lucide/vue";

import Btn from "../ui/Btn.vue";

import ConfirmDialog from "../common/ConfirmDialog.vue";

import ModuleSearch from "../common/ModuleSearch.vue";

import PageHeader from "../common/PageHeader.vue";

import PageLoading from "../common/PageLoading.vue";

import StatChip from "../common/StatChip.vue";

import EmptyState from "../ui/EmptyState.vue";

import JournalDayGroup from "./JournalDayGroup.vue";

import JournalEntryDrawer from "./JournalEntryDrawer.vue";

import JournalQuickCapture from "./JournalQuickCapture.vue";

import { useJournalStore } from "../../stores/journal";

import { useUiStore } from "../../stores/ui";

import { exportJournalMarkdown } from "../../utils/exportJournal";

import { formatDayLabel, todayDayDate } from "../../utils/journalDates";

import { journalEntryTitle } from "../../utils/journalSearch";

import type { JournalDayGroup as DayGroup } from "../../types/journal";



const store = useJournalStore();

const ui = useUiStore();

const route = useRoute();

const router = useRouter();

const quickCaptureRef = ref<InstanceType<typeof JournalQuickCapture> | null>(null);

const deletePending = ref<{ id: string; title: string } | null>(null);



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



function onDelete(id: string) {

  const entry = store.entries.find((e) => e.id === id);

  if (!entry) return;

  deletePending.value = { id, title: journalEntryTitle(entry) || "小记" };

}



async function confirmDeleteJournal() {

  if (!deletePending.value) return;

  const { id } = deletePending.value;

  deletePending.value = null;

  await store.remove(id);

}



async function onDrawerSave(content: string) {

  if (!store.selected) return;

  await store.save(store.selected.id, content);

  store.closeDrawer();

}



function onDrawerDelete() {

  if (!store.selected) return;

  onDelete(store.selected.id);

}



function focusQuickCapture() {

  quickCaptureRef.value?.focus();

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

  <div class="module-page" data-testid="journal-timeline">

    <PageHeader

      title="每日小记"

      subtitle="按日时间线记录，支持 Markdown"

      :icon="BookOpen"

      icon-accent="paw"

      test-id="journal-page-header"

    >

      <template #actions>

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

      </template>

      <template v-if="!store.loading && totalCount > 0" #stats>

        <StatChip>

          共 <strong class="font-medium text-[var(--color-text)]">{{ totalCount }}</strong> 条

        </StatChip>

        <StatChip accent>

          今日 <strong class="font-medium text-paw">{{ todayCount }}</strong> 条

        </StatChip>

        <StatChip v-if="store.isSearching">

          匹配 <strong class="font-medium text-link">{{ store.filteredEntries.length }}</strong> 条

        </StatChip>

      </template>

      <template v-if="totalCount > 0" #toolbar>

        <ModuleSearch

          v-model="store.searchQuery"

          placeholder="搜索小记内容…"

          test-id="journal-search-input"

          aria-label="搜索小记"

        />

      </template>

    </PageHeader>



    <div

      v-if="store.error"

      class="module-error-banner mx-5 mt-3"

      role="alert"

    >

      <span>{{ store.error }}</span>

      <Btn variant="ghost" size="sm" @click="store.fetchAll()">重试</Btn>

    </div>



    <PageLoading v-if="store.loading" message="加载小记…" size="md" />



    <div

      v-else-if="store.entries.length === 0"

      class="module-page__body flex flex-col items-center justify-center gap-8 px-5 py-16"

    >

      <EmptyState title="还没有小记" description="记录想法、待办与片段笔记，支持 Markdown 格式">

        <template #icon>

          <BookOpen class="h-8 w-8" />

        </template>

        <template #action>

          <Btn variant="primary" size="sm" @click="focusQuickCapture">写下第一条</Btn>

        </template>

      </EmptyState>

      <div class="w-full max-w-2xl">

        <JournalQuickCapture ref="quickCaptureRef" prominent @submit="onSubmit" />

      </div>

    </div>



    <EmptyState

      v-else-if="store.isSearching && store.filteredEntries.length === 0"

      class="module-page__body py-16"

      title="没有匹配结果"

      :description="`关键词「${store.searchQuery}」未出现在任何小记中`"

      test-id="journal-search-empty"

    >

      <template #icon>

        <BookOpen class="h-8 w-8" />

      </template>

      <template #action>

        <Btn variant="secondary" size="sm" @click="store.clearSearch()">清除搜索</Btn>

      </template>

    </EmptyState>



    <div v-else class="module-page__body scrollbar-thin">

      <div class="module-page__content py-6">

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



    <ConfirmDialog

      :open="!!deletePending"

      title="删除小记"

      :item-name="deletePending?.title"

      description="删除后无法恢复，请确认是否继续。"

      confirm-label="删除"

      destructive

      test-id="delete-journal-dialog"

      @confirm="confirmDeleteJournal"

      @cancel="deletePending = null"

    />

  </div>

</template>


