import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  createQuestion,
  deleteQuestion,
  searchQuestions,
  updateQuestion,
  batchImportQuestions,
  exportQuestionBank as exportQb,
  importQuestionBank as importQb,
  getQuestionBankStats,
  clearAllQuestions,
} from "../services/questionBankService";
import type {
  CreateQuestionInput,
  Question,
  QuestionBankStats,
  QuestionSearchParams,
  QuestionSortBy,
  QuestionType,
  UpdateQuestionPatch,
} from "../types/questionBank";
import { useUiStore } from "./ui";

export const useQuestionBankStore = defineStore("questionBank", () => {
  // State
  const questions = ref<Question[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const selectedQuestion = ref<Question | null>(null);
  const showEditor = ref(false);
  const editingQuestion = ref<Question | null>(null);
  const searchParams = ref<QuestionSearchParams>({
    page: 1,
    pageSize: 20,
    sortBy: "created_desc",
  });
  const stats = ref<QuestionBankStats | null>(null);

  // Getters
  const isEmpty = computed(
    () => total.value === 0 && !loading.value && !searchParams.value.keyword,
  );
  const noResults = computed(
    () =>
      total.value === 0
      && !loading.value
      && !!searchParams.value.keyword?.trim(),
  );
  const hasMore = computed(() => questions.value.length < total.value);
  const activeType = computed(() => searchParams.value.type ?? null);
  const activeDifficulty = computed(() => searchParams.value.difficulty ?? 0);
  const activeSortBy = computed(
    () => (searchParams.value.sortBy ?? "created_desc") as QuestionSortBy,
  );

  // Actions
  async function search(params?: Partial<QuestionSearchParams>) {
    if (params) {
      searchParams.value = { ...searchParams.value, ...params };
    }
    loading.value = true;
    try {
      const result = await searchQuestions(searchParams.value);
      questions.value = result.items;
      total.value = result.total;
      currentPage.value = result.page;
    } catch (e) {
      useUiStore().showToast("error", "搜索题目失败");
    } finally {
      loading.value = false;
    }
  }

  async function loadMore() {
    if (!hasMore.value || loading.value) return;
    const nextPage = currentPage.value + 1;
    loading.value = true;
    try {
      const result = await searchQuestions({
        ...searchParams.value,
        page: nextPage,
      });
      questions.value = [...questions.value, ...result.items];
      total.value = result.total;
      currentPage.value = nextPage;
    } catch {
      useUiStore().showToast("error", "加载更多失败");
    } finally {
      loading.value = false;
    }
  }

  async function add(input: CreateQuestionInput) {
    try {
      const q = await createQuestion(input);
      // Refresh search to maintain consistent sort order
      await search({ page: 1 });
      useUiStore().showToast("success", "题目已创建");
      return q;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "创建失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function save(id: string, patch: UpdateQuestionPatch) {
    try {
      const updated = await updateQuestion(id, patch);
      questions.value = questions.value.map((q) => (q.id === id ? updated : q));
      if (selectedQuestion.value?.id === id) {
        selectedQuestion.value = updated;
      }
      useUiStore().showToast("success", "题目已保存");
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function remove(id: string) {
    try {
      await deleteQuestion(id);
      questions.value = questions.value.filter((q) => q.id !== id);
      total.value = Math.max(0, total.value - 1);
      if (selectedQuestion.value?.id === id) {
        selectedQuestion.value = null;
      }
      if (editingQuestion.value?.id === id) {
        editingQuestion.value = null;
        showEditor.value = false;
      }
      useUiStore().showToast("success", "题目已删除");
      await fetchStats();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  function selectQuestion(q: Question | null) {
    selectedQuestion.value = q;
  }

  function openEditor(q?: Question) {
    editingQuestion.value = q ?? null;
    showEditor.value = true;
  }

  function closeEditor() {
    showEditor.value = false;
    editingQuestion.value = null;
  }

  function setTypeFilter(type: QuestionType | null) {
    searchParams.value = {
      ...searchParams.value,
      type: type ?? undefined,
      page: 1,
    };
    search();
  }

  function setDifficultyFilter(difficulty: number) {
    searchParams.value = {
      ...searchParams.value,
      difficulty: difficulty > 0 ? difficulty : undefined,
      page: 1,
    };
    search();
  }

  function setSortBy(sortBy: QuestionSortBy) {
    searchParams.value = {
      ...searchParams.value,
      sortBy,
      page: 1,
    };
    search();
  }

  async function batchImport(inputs: CreateQuestionInput[]) {
    loading.value = true;
    try {
      const result = await batchImportQuestions(inputs);
      if (result.imported > 0) {
        await search({ page: 1 });
      }
      await fetchStats();
      return result;
    } catch (e) {
      useUiStore().showToast("error", "批量导入失败");
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function exportAll(): Promise<string> {
    return exportQb();
  }

  async function importFromJson(jsonData: string, mode: "replace" | "merge") {
    loading.value = true;
    try {
      const result = await importQb(jsonData, mode);
      await search({ page: 1 });
      await fetchStats();
      useUiStore().showToast(
        "success",
        `导入完成: 新增 ${result.imported}, 更新 ${result.updated}`,
      );
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "导入失败";
      useUiStore().showToast("error", msg);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function clearAll() {
    loading.value = true;
    try {
      const deleted = await clearAllQuestions();
      await search({ page: 1 });
      await fetchStats();
      useUiStore().showToast("success", deleted > 0 ? `已清空题库（${deleted} 道）` : "题库已为空");
      return deleted;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "清空失败";
      useUiStore().showToast("error", msg);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchStats() {
    try {
      stats.value = await getQuestionBankStats();
    } catch {
      // non-critical
    }
  }

  return {
    // state
    questions,
    total,
    loading,
    currentPage,
    pageSize,
    selectedQuestion,
    showEditor,
    editingQuestion,
    searchParams,
    stats,
    // getters
    isEmpty,
    noResults,
    hasMore,
    activeType,
    activeDifficulty,
    activeSortBy,
    // actions
    search,
    loadMore,
    add,
    save,
    remove,
    selectQuestion,
    openEditor,
    closeEditor,
    setTypeFilter,
    setDifficultyFilter,
    setSortBy,
    batchImport,
    exportAll,
    importFromJson,
    clearAll,
    fetchStats,
  };
});
