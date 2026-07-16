<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { Library, Plus, Upload, Download, BookOpen, GraduationCap } from "@lucide/vue";
import AppShell from "../components/layout/AppShell.vue";
import EmptyState from "../components/ui/EmptyState.vue";
import ConfirmDialog from "../components/common/ConfirmDialog.vue";
import QuestionSearchBar from "../components/questionBank/QuestionSearchBar.vue";
import QuestionCard from "../components/questionBank/QuestionCard.vue";
import QuestionEditor from "../components/questionBank/QuestionEditor.vue";
import QuestionImportDialog from "../components/questionBank/QuestionImportDialog.vue";
import QuestionExportDialog from "../components/questionBank/QuestionExportDialog.vue";
import PracticeConfigDialog from "../components/questionBank/PracticeConfigDialog.vue";
import PracticeExam from "../components/questionBank/PracticeExam.vue";
import { useQuestionBankStore } from "../stores/questionBank";
import { useQuestionPracticeStore } from "../stores/questionPractice";
import type { Question } from "../types/questionBank";

const store = useQuestionBankStore();
const practiceStore = useQuestionPracticeStore();

const showImport = ref(false);
const showExport = ref(false);
const showPracticeConfig = ref(false);
const showPracticeExam = ref(false);

const showDeleteConfirm = ref(false);
const pendingDeleteId = ref<string | null>(null);
const pendingDeleteTitle = ref("");

const hasActivePractice = computed(
  () => !!practiceStore.session && practiceStore.session.status === "answering",
);

const practiceLabel = computed(() =>
  practiceStore.session ? "继续练习" : "模拟练习",
);

function handlePracticeClick() {
  if (practiceStore.session) {
    showPracticeExam.value = true;
    return;
  }
  showPracticeConfig.value = true;
}

function handlePracticeConfigClose() {
  showPracticeConfig.value = false;
  if (practiceStore.session) {
    showPracticeExam.value = true;
  }
}

function handlePracticeExit() {
  showPracticeExam.value = false;
  practiceStore.exitPractice();
}

onBeforeRouteLeave(() => {
  if (
    showPracticeExam.value
    && practiceStore.session
    && practiceStore.session.status === "answering"
  ) {
    if (!confirm("正在练习中，离开将丢失进度，确定离开吗？")) {
      return false;
    }
    practiceStore.exitPractice();
  }
});

onMounted(async () => {
  await store.search({ page: 1 });
  await store.fetchStats();
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => window.removeEventListener("keydown", onKeydown));

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    const input = document.querySelector<HTMLInputElement>(".search-input");
    input?.focus();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "n" && !store.showEditor) {
    e.preventDefault();
    store.openEditor();
  }
}

function handleCreate() {
  store.openEditor();
}

function handleEdit(q: Question) {
  store.openEditor(q);
}

function handleDelete(id: string) {
  const q = store.questions.find((item) => item.id === id);
  const raw = q?.title?.trim() || "未命名题目";
  pendingDeleteId.value = id;
  pendingDeleteTitle.value = raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  const id = pendingDeleteId.value;
  showDeleteConfirm.value = false;
  pendingDeleteId.value = null;
  pendingDeleteTitle.value = "";
  if (!id) return;
  await store.remove(id);
}

function cancelDelete() {
  showDeleteConfirm.value = false;
  pendingDeleteId.value = null;
  pendingDeleteTitle.value = "";
}

function handleScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (!el) return;
  const { scrollTop, scrollHeight, clientHeight } = el;
  if (scrollHeight - scrollTop - clientHeight < 200) {
    store.loadMore();
  }
}
</script>

<template>
  <AppShell sidebar-mode="compact">
    <template #sidebar>
      <!-- Sidebar placeholder -->
    </template>

    <div class="qb-page flex h-full flex-col">
      <!-- Header -->
      <header class="shrink-0 border-b border-border px-5 py-4">
        <div class="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-link/10 text-link"
            >
              <Library class="h-4 w-4" />
            </span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h1 class="text-base font-semibold text-text">题库</h1>
                <span
                  class="rounded-md border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-surface-0)_80%,#c8b8a0_8%)] px-2 py-0.5 text-xs tabular-nums text-[var(--qb-ink-faint,#9a958c)]"
                >
                  {{ store.total }} 题
                </span>
              </div>
              <p v-if="store.stats" class="mt-0.5 truncate text-xs text-[var(--qb-ink-faint,#9a958c)]">
                {{ store.stats.byType.find(t => t.type === 'single')?.count ?? 0 }} 单选 ·
                {{ store.stats.byType.find(t => t.type === 'multi')?.count ?? 0 }} 多选 ·
                {{ store.stats.byType.find(t => t.type === 'truefalse')?.count ?? 0 }} 判断
              </p>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1.5">
            <button
              class="btn-ghost h-8 w-8 items-center justify-center p-0"
              title="导入"
              @click="showImport = true"
            >
              <Upload class="h-3.5 w-3.5" />
            </button>
            <button
              class="btn-ghost h-8 w-8 items-center justify-center p-0"
              title="导出"
              @click="showExport = true"
            >
              <Download class="h-3.5 w-3.5" />
            </button>
            <button
              class="btn-secondary relative h-8 gap-1.5 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="store.total === 0 && !practiceStore.session"
              @click="handlePracticeClick"
            >
              <span
                v-if="hasActivePractice"
                class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-paw"
                aria-hidden="true"
              />
              <GraduationCap class="h-3.5 w-3.5" />
              <span class="hidden sm:inline">{{ practiceLabel }}</span>
            </button>
            <button
              class="btn-primary h-8 gap-1.5 px-3 text-sm"
              @click="handleCreate"
            >
              <Plus class="h-3.5 w-3.5" />
              <span class="hidden sm:inline">新建</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Content -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <div class="mx-auto w-full max-w-3xl shrink-0 px-5 py-3">
          <QuestionSearchBar />
        </div>

        <!-- Empty state -->
        <div
          v-if="store.isEmpty"
          class="flex flex-1 items-center justify-center px-5"
        >
          <EmptyState
            title="题库还是空的"
            description="点击「新建」手动添加题目，或「导入」从文档解析"
            size="lg"
          >
            <template #icon>
              <BookOpen class="h-7 w-7 text-muted" />
            </template>
            <template #action>
              <div class="flex items-center justify-center gap-3">
                <button class="btn-primary" @click="handleCreate">
                  新建题目
                </button>
                <button class="btn-secondary" @click="showImport = true">
                  导入题目
                </button>
              </div>
            </template>
            <template #hint>
              快捷键: Ctrl+N 新建 · Ctrl+K 搜索
            </template>
          </EmptyState>
        </div>

        <!-- Search no results -->
        <div
          v-else-if="store.noResults"
          class="flex flex-1 items-center justify-center px-5"
        >
          <EmptyState
            title="未找到匹配题目"
            description="试试其他关键词，或清除筛选后浏览全部题目"
            size="md"
          >
            <template #icon>
              <BookOpen class="h-7 w-7 text-muted" />
            </template>
          </EmptyState>
        </div>

        <!-- Question list -->
        <div
          v-else
          class="flex-1 overflow-y-auto px-5 pb-6"
          @scroll="handleScroll"
        >
          <div class="mx-auto max-w-3xl space-y-3">
            <QuestionCard
              v-for="q in store.questions"
              :key="q.id"
              :question="q"
              @edit="handleEdit"
              @delete="handleDelete"
            />
          </div>

          <div
            v-if="store.loading"
            class="flex items-center justify-center py-6"
          >
            <div
              class="h-5 w-5 animate-spin rounded-full border-2 border-link/30 border-t-link"
            />
          </div>

          <div
            v-if="!store.hasMore && store.total > 0"
            class="py-6 text-center text-xs text-muted"
          >
            共 {{ store.total }} 道题目 · 已全部加载
          </div>
        </div>
      </div>

      <QuestionEditor
        v-if="store.showEditor"
        :question="store.editingQuestion"
        @close="store.closeEditor()"
      />

      <QuestionImportDialog
        v-if="showImport"
        @close="showImport = false"
      />

      <QuestionExportDialog
        v-if="showExport"
        @close="showExport = false"
      />

      <PracticeConfigDialog
        v-if="showPracticeConfig"
        @close="handlePracticeConfigClose"
      />

      <PracticeExam
        v-if="showPracticeExam"
        @exit="handlePracticeExit"
      />

      <ConfirmDialog
        :open="showDeleteConfirm"
        title="删除这道题目？"
        :item-name="pendingDeleteTitle"
        description="删除后不可恢复。"
        confirm-label="确认删除"
        destructive
        test-id="qb-delete-confirm"
        @confirm="confirmDelete"
        @cancel="cancelDelete"
      />
    </div>
  </AppShell>
</template>
