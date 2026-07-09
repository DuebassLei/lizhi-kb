<script setup lang="ts">

import { computed, onMounted, ref } from "vue";

import { LayoutDashboard, Lock, PenLine } from "@lucide/vue";

import { RouterLink, useRouter } from "vue-router";

import AppShell from "../components/layout/AppShell.vue";

import DashboardSection from "../components/insights/DashboardSection.vue";

import OverviewTab from "../components/insights/OverviewTab.vue";

import WritingRhythm from "../components/insights/WritingRhythm.vue";

import RecentDocuments from "../components/insights/RecentDocuments.vue";

import HeatmapCalendar from "../components/insights/HeatmapCalendar.vue";

import NetworkHighlights from "../components/insights/NetworkHighlights.vue";

import AuditTab from "../components/insights/AuditTab.vue";

import { useDashboardInsights } from "../composables/useDashboardInsights";

import { useDocumentsStore } from "../stores/documents";

import { useUiStore } from "../stores/ui";



const documents = useDocumentsStore();

const ui = useUiStore();

const router = useRouter();

const booting = ref(true);

const { streak, todayEdits } = useDashboardInsights();

const heroStyle = computed(() =>
  ui.insightsHeroBackground
    ? { backgroundImage: `url(${ui.insightsHeroBackground})` }
    : undefined,
);



const greeting = computed(() => {

  const h = new Date().getHours();

  if (h < 6) return "夜深了";

  if (h < 12) return "早上好";

  if (h < 18) return "下午好";

  return "晚上好";

});



onMounted(async () => {

  try {

    await Promise.all([documents.fetchDashboard(), documents.fetchTree()]);

  } finally {

    booting.value = false;

  }

});



async function quickCreate() {

  await documents.create();

  await router.push("/workspace");

}

</script>



<template>

  <AppShell>

    <template #sidebar>

      <div class="flex flex-col gap-3 p-3">

        <p class="px-1 text-[10px] font-medium uppercase tracking-wide text-text-secondary">

          快捷入口

        </p>

        <RouterLink

          to="/workspace"

          class="btn-primary flex w-full items-center justify-center gap-1.5"

          data-testid="sidebar-go-write"

          aria-label="进入工作区"

        >

          <PenLine :size="14" aria-hidden="true" />

          <span aria-hidden="true">去写作</span>

        </RouterLink>

      </div>

    </template>



    <main class="flex-1 overflow-y-auto" data-testid="dashboard-home">

      <div class="mx-auto max-w-6xl px-6 py-8 pb-16">

        <!-- Hero -->

        <header

          class="insights-hero mb-10 overflow-hidden rounded-lg border border-border px-6 py-8 sm:px-8"

          :class="ui.insightsHeroBackground ? 'insights-hero--custom' : 'insights-hero--default'"

          :style="heroStyle"

          data-testid="insights-hero"

        >

          <div class="insights-hero__scrim" aria-hidden="true" />

          <div class="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <p class="inline-flex items-center gap-1.5 text-xs text-text-secondary">

                <LayoutDashboard :size="12" aria-hidden="true" />

                {{ greeting }} · 守夜在看

              </p>

              <h1 class="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-text)]">

                写作看板

              </h1>

              <p class="mt-2 max-w-lg text-sm leading-relaxed text-muted">

                <template v-if="documents.stats && documents.stats.totalDocs > 0">

                  知识库中有

                  <span class="text-paw">{{ documents.stats.totalDocs }}</span>

                  篇文档、

                  <span class="text-paw">{{ documents.stats.totalWords.toLocaleString() }}</span>

                  字。

                  <span v-if="streak > 0">已连续写作 {{ streak }} 天。</span>

                  <span v-else-if="todayEdits > 0">今日已编辑 {{ todayEdits }} 次。</span>

                </template>

                <template v-else>

                  本地加密、猫一样安静。写下第一篇，热力图会在这里生长。

                </template>

              </p>

            </div>

            <div class="flex shrink-0 flex-wrap gap-2">

              <RouterLink to="/workspace" class="btn-primary">

                去写作

              </RouterLink>

              <button type="button" class="btn-secondary" @click="quickCreate">

                新建文档

              </button>

            </div>

          </div>

        </header>



        <div v-if="booting" class="flex flex-col items-center gap-2 py-20 text-sm text-muted" role="status">

          <span class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-link" aria-hidden="true" />

          加载看板…

        </div>



        <div v-else class="space-y-10">

          <section aria-labelledby="stats-heading">

            <h2 id="stats-heading" class="sr-only">核心指标</h2>

            <OverviewTab />

          </section>



          <div class="grid gap-8 lg:grid-cols-5">

            <div class="lg:col-span-3">

              <DashboardSection title="写作节奏" subtitle="连续天数 · 近 7 日柱状图">

                <WritingRhythm />

              </DashboardSection>

            </div>

            <div class="lg:col-span-2">

              <DashboardSection title="最近文档" subtitle="按更新时间排序">

                <RecentDocuments />

              </DashboardSection>

            </div>

          </div>



          <DashboardSection title="写作热力图" subtitle="近一年 · 贪吃蛇热力图">

            <HeatmapCalendar />

          </DashboardSection>



          <div class="grid gap-8 lg:grid-cols-2">

            <DashboardSection title="知识网络" subtitle="枢纽排名 · 链密度">

              <NetworkHighlights />

            </DashboardSection>



            <DashboardSection title="活动日志" subtitle="近 30 天编辑记录">

              <AuditTab />

            </DashboardSection>

          </div>



          <footer

            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-0 px-4 py-3 text-[10px] text-muted"

          >

            <span class="inline-flex items-center gap-1">

              <Lock :size="10" aria-hidden="true" />

              本地加密 · 零网络请求

            </span>

            <span>数据目录 ~/.lizhi-kb/</span>

          </footer>

        </div>

      </div>

    </main>

  </AppShell>

</template>


