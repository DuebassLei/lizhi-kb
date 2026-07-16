import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getAllQuestions } from "../services/questionBankService";
import type {
  PracticeConfig,
  PracticeQuestionResult,
  PracticeResult,
  PracticeSession,
  Question,
} from "../types/questionBank";
import { useUiStore } from "./ui";

const DEFAULT_CONFIG: PracticeConfig = {
  questionCount: 10,
  types: ["single", "multi", "truefalse"],
  difficulty: [0, 1, 2, 3],
};

export const useQuestionPracticeStore = defineStore("questionPractice", () => {
  const session = ref<PracticeSession | null>(null);
  const result = ref<PracticeResult | null>(null);
  const loading = ref(false);
  const config = ref<PracticeConfig>({ ...DEFAULT_CONFIG });

  const currentQuestion = computed<Question | null>(() => {
    if (!session.value) return null;
    return session.value.questions[session.value.currentIndex] ?? null;
  });

  const answeredCount = computed(() => {
    if (!session.value) return 0;
    return Object.values(session.value.userAnswers).filter((a) => a.length > 0).length;
  });

  const markedCount = computed(() => {
    if (!session.value) return 0;
    return Object.values(session.value.marked).filter(Boolean).length;
  });

  // Progress based on answered count (not current index) for stable UX
  const progressPercent = computed(() => {
    if (!session.value || session.value.questions.length === 0) return 0;
    return Math.round((answeredCount.value / session.value.questions.length) * 100);
  });

  function pickRandom(pool: Question[], count: number): Question[] {
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, Math.min(count, arr.length));
  }

  function judgeAnswer(question: Question, userAnswer: string[]): boolean {
    if (userAnswer.length === 0) return false;
    if (question.type === "multi") {
      const correct = new Set(question.correctAnswer);
      const user = new Set(userAnswer);
      return correct.size === user.size && [...correct].every((v) => user.has(v));
    }
    return userAnswer[0] === question.correctAnswer[0];
  }

  async function startPractice(customConfig?: PracticeConfig) {
    const cfg = customConfig ?? config.value;
    loading.value = true;
    try {
      const all = await getAllQuestions();
      const pool = all.filter(
        (q) => cfg.types.includes(q.type) && cfg.difficulty.includes(q.difficulty),
      );
      if (pool.length === 0) {
        useUiStore().showToast("error", "没有符合条件的题目");
        return;
      }
      const picked = pickRandom(pool, cfg.questionCount);
      if (picked.length < cfg.questionCount) {
        useUiStore().showToast(
          "success",
          `符合条件的题目共 ${pool.length} 题，已全部加入练习`,
        );
      }
      session.value = {
        questions: picked,
        userAnswers: {},
        marked: {},
        currentIndex: 0,
        status: "answering",
        startedAt: Date.now(),
        config: { ...cfg },
      };
      result.value = null;
    } catch {
      useUiStore().showToast("error", "加载题目失败");
    } finally {
      loading.value = false;
    }
  }

  function answerCurrent(labels: string[]) {
    if (!session.value || !currentQuestion.value) return;
    session.value.userAnswers[currentQuestion.value.id] = labels;
  }

  function getAnswer(qid: string): string[] {
    if (!session.value) return [];
    return session.value.userAnswers[qid] ?? [];
  }

  function toggleMark(qid: string) {
    if (!session.value) return;
    session.value.marked[qid] = !session.value.marked[qid];
  }

  function isMarked(qid: string): boolean {
    if (!session.value) return false;
    return !!session.value.marked[qid];
  }

  function goToQuestion(index: number) {
    if (!session.value) return;
    if (index >= 0 && index < session.value.questions.length) {
      session.value.currentIndex = index;
    }
  }

  function goNext() {
    if (!session.value) return;
    goToQuestion(session.value.currentIndex + 1);
  }

  function goPrev() {
    if (!session.value) return;
    goToQuestion(session.value.currentIndex - 1);
  }

  function submitExam() {
    if (!session.value) return;
    const s = session.value;
    const details: PracticeQuestionResult[] = s.questions.map((q) => {
      const userAnswer = s.userAnswers[q.id] ?? [];
      return {
        question: q,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect: judgeAnswer(q, userAnswer),
      };
    });

    const correct = details.filter((d) => d.isCorrect).length;
    const unanswered = details.filter((d) => d.userAnswer.length === 0).length;
    const wrong = details.length - correct - unanswered;
    const total = details.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const duration = Math.floor((Date.now() - s.startedAt) / 1000);

    result.value = { total, correct, wrong, unanswered, score, duration, details };
    s.status = "submitted";
    s.submittedAt = Date.now();
  }

  // Restart with the same config — used by "再来一组"
  async function restartPractice() {
    if (!session.value) return;
    const cfg = session.value.config;
    result.value = null;
    session.value = null;
    await startPractice(cfg);
  }

  function resetPractice() {
    session.value = null;
    result.value = null;
    config.value = { ...DEFAULT_CONFIG };
  }

  function exitPractice() {
    session.value = null;
    result.value = null;
  }

  return {
    session,
    result,
    loading,
    config,
    currentQuestion,
    answeredCount,
    markedCount,
    progressPercent,
    startPractice,
    answerCurrent,
    getAnswer,
    toggleMark,
    isMarked,
    goToQuestion,
    goNext,
    goPrev,
    submitExam,
    restartPractice,
    resetPractice,
    exitPractice,
  };
});
