<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from "vue";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Clock,
  Bookmark,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
} from "@lucide/vue";
import { useQuestionPracticeStore } from "../../stores/questionPractice";
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from "../../types/questionBank";
import PracticeResultPanel from "./PracticeResultPanel.vue";
import ConfirmDialog from "../common/ConfirmDialog.vue";

const emit = defineEmits<{ exit: [] }>();
const store = useQuestionPracticeStore();

const elapsed = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
const mapExpanded = ref(false);

const showSubmitConfirm = ref(false);
const showExitConfirm = ref(false);

const submitDescription = computed(() => {
  if (!store.session) return "确定交卷吗？";
  const unanswered = store.session.questions.length - store.answeredCount;
  return unanswered > 0
    ? `还有 ${unanswered} 题未作答，交卷后不可继续作答。`
    : "交卷后将查看成绩，不可继续作答。";
});

const FONT_SIZE_LEVELS = [
  { label: "小", value: 14 },
  { label: "中", value: 16 },
  { label: "大", value: 18 },
] as const;
const fontSizeIndex = ref(1);

const titleFontSize = computed(() => `${FONT_SIZE_LEVELS[fontSizeIndex.value].value}px`);
const optionFontSize = computed(() => `${FONT_SIZE_LEVELS[fontSizeIndex.value].value}px`);

function startTimer() {
  stopTimer();
  timer = setInterval(() => {
    if (store.session && store.session.status === "answering") {
      elapsed.value = Math.floor((Date.now() - store.session.startedAt) / 1000);
    }
  }, 1000);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch(
  () => store.session?.status,
  (status) => {
    if (status === "submitted") {
      stopTimer();
    } else if (status === "answering") {
      startTimer();
    }
  },
);

onMounted(() => {
  if (store.session) {
    elapsed.value = Math.floor((Date.now() - store.session.startedAt) / 1000);
    startTimer();
  }
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  stopTimer();
  window.removeEventListener("keydown", onKeydown);
});

const currentQ = computed(() => store.currentQuestion);
const currentAnswer = computed<string[]>(() => {
  if (!currentQ.value) return [];
  return store.getAnswer(currentQ.value.id);
});
const currentMarked = computed(() => {
  if (!currentQ.value) return false;
  return store.isMarked(currentQ.value.id);
});

const isLast = computed(() => {
  if (!store.session) return false;
  return store.session.currentIndex === store.session.questions.length - 1;
});

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatOptionLabel(label: string): string {
  if (label === "true") return "T";
  if (label === "false") return "F";
  return label;
}

function toggleOption(label: string) {
  if (!currentQ.value) return;
  const current = [...currentAnswer.value];
  if (currentQ.value.type === "multi") {
    const idx = current.indexOf(label);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(label);
  } else {
    current.length = 0;
    current.push(label);
  }
  store.answerCurrent(current);
}

function isOptionSelected(label: string): boolean {
  return currentAnswer.value.includes(label);
}

function toggleMark() {
  if (!currentQ.value) return;
  store.toggleMark(currentQ.value.id);
}

function handleExit() {
  if (!store.session || store.session.status === "submitted") {
    emit("exit");
    return;
  }
  showExitConfirm.value = true;
}

function confirmExit() {
  showExitConfirm.value = false;
  emit("exit");
}

function handleSubmit() {
  if (!store.session) return;
  showSubmitConfirm.value = true;
}

function confirmSubmit() {
  showSubmitConfirm.value = false;
  store.submitExam();
}

async function handleRetry() {
  await store.restartPractice();
  if (store.session) {
    elapsed.value = 0;
    startTimer();
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!store.session || store.session.status !== "answering") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const key = e.key.toLowerCase();

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    store.goPrev();
    return;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    if (isLast.value) {
      handleSubmit();
    } else {
      store.goNext();
    }
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    handleSubmit();
    return;
  }
  if (key === "m") {
    e.preventDefault();
    toggleMark();
    return;
  }

  if (currentQ.value) {
    let targetLabel: string | null = null;

    const numMatch = e.key.match(/^[1-9]$/);
    if (numMatch) {
      const idx = parseInt(e.key) - 1;
      const opt = currentQ.value.options[idx];
      if (opt) targetLabel = opt.label;
    }

    const letterMatch = key.match(/^[a-z]$/);
    if (letterMatch && !targetLabel) {
      const idx = key.charCodeAt(0) - "a".charCodeAt(0);
      const opt = currentQ.value.options[idx];
      if (opt) targetLabel = opt.label;
    }

    if (currentQ.value.type === "truefalse") {
      if (key === "t" || key === "y") {
        const opt = currentQ.value.options.find((o) => o.label === "true");
        if (opt) targetLabel = "true";
      }
      if (key === "f" || key === "n") {
        const opt = currentQ.value.options.find((o) => o.label === "false");
        if (opt) targetLabel = "false";
      }
    }

    if (targetLabel) {
      e.preventDefault();
      toggleOption(targetLabel);
    }
  }
}

function mapButtonClass(idx: number, qId: string): string {
  if (!store.session) return "qb-map-cell";
  const isCurrent = idx === store.session.currentIndex;
  const answered = store.getAnswer(qId).length > 0;
  const marked = store.isMarked(qId);

  const parts = ["qb-map-cell"];
  if (isCurrent) parts.push("qb-map-cell--current");
  else if (answered) parts.push("qb-map-cell--answered");
  else parts.push("qb-map-cell--idle");
  if (marked) parts.push("qb-map-cell--marked");
  return parts.join(" ");
}
</script>

<template>
  <PracticeResultPanel
    v-if="store.result"
    @retry="handleRetry"
    @exit="handleExit"
  />

  <div
    v-else-if="store.session && currentQ"
    class="qb-page fixed inset-0 z-50 flex flex-col bg-base"
  >
    <!-- Top bar -->
    <header class="shrink-0 border-b border-border px-5 py-3">
      <div class="mx-auto flex max-w-2xl items-center gap-4">
        <button
          class="flex shrink-0 items-center gap-1 text-xs text-muted transition-colors hover:text-text"
          @click="handleExit"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
          退出
        </button>

        <div class="min-w-0 flex-1">
          <div class="mb-1.5 flex items-center justify-center gap-2 text-xs">
            <span class="tabular-nums text-[var(--qb-ink-soft,#c8c4bc)]">
              第 {{ store.session.currentIndex + 1 }}
              <span class="text-[var(--qb-ink-faint,#9a958c)]">/</span>
              {{ store.session.questions.length }} 题
            </span>
            <span class="text-[var(--qb-ink-faint,#9a958c)]/40">·</span>
            <span class="tabular-nums text-[var(--qb-ink-faint,#9a958c)]">
              已答 {{ store.answeredCount }}
            </span>
          </div>
          <div class="h-0.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)]">
            <div
              class="h-full rounded-full bg-link/80 transition-all duration-300"
              :style="{ width: store.progressPercent + '%' }"
            />
          </div>
        </div>

        <!-- 字号 · 计时 · 标记 -->
        <div class="qb-toolbar shrink-0" role="toolbar" aria-label="练习工具">
          <div class="qb-toolbar__seg qb-toolbar__seg--font">
            <button
              class="qb-toolbar__btn"
              :disabled="fontSizeIndex === 0"
              title="缩小字号"
              @click="fontSizeIndex--"
            >
              <Minus class="h-3 w-3" />
            </button>
            <span class="qb-toolbar__label">{{ FONT_SIZE_LEVELS[fontSizeIndex].label }}</span>
            <button
              class="qb-toolbar__btn"
              :disabled="fontSizeIndex === FONT_SIZE_LEVELS.length - 1"
              title="放大字号"
              @click="fontSizeIndex++"
            >
              <Plus class="h-3 w-3" />
            </button>
          </div>

          <div class="qb-toolbar__seg" title="已用时">
            <Clock class="h-3.5 w-3.5 opacity-70" />
            <span class="qb-toolbar__timer">{{ formatTime(elapsed) }}</span>
          </div>

          <button
            class="qb-toolbar__seg qb-toolbar__mark"
            :class="{ 'qb-toolbar__mark--on': currentMarked }"
            :title="currentMarked ? '取消标记' : '标记本题'"
            @click="toggleMark"
          >
            <Bookmark
              class="h-3.5 w-3.5"
              :fill="currentMarked ? 'currentColor' : 'none'"
            />
            <span>{{ currentMarked ? '已标' : '标记' }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Question content -->
    <div class="flex-1 overflow-y-auto px-5 py-6">
      <div class="mx-auto max-w-2xl">
        <div class="mb-4 flex items-center gap-2">
          <span class="qb-badge">
            {{ QUESTION_TYPE_LABELS[currentQ.type] }}
          </span>
          <span
            v-if="currentQ.difficulty > 0"
            class="qb-difficulty"
            :class="`qb-difficulty--${currentQ.difficulty}`"
          >
            <span class="qb-difficulty__dot" aria-hidden="true" />
            {{ DIFFICULTY_LABELS[currentQ.difficulty] }}
          </span>
        </div>

        <p
          class="mb-6 whitespace-pre-wrap leading-relaxed tracking-wide text-[var(--qb-ink,#f2f0eb)]"
          :style="{ fontSize: titleFontSize }"
        >
          {{ currentQ.title }}
        </p>

        <div class="space-y-2">
          <button
            v-for="opt in currentQ.options"
            :key="opt.label"
            class="qb-choice"
            :class="{ 'qb-choice--selected': isOptionSelected(opt.label) }"
            @click="toggleOption(opt.label)"
          >
            <span class="qb-choice__key">
              {{ formatOptionLabel(opt.label) }}
            </span>
            <span
              class="qb-choice__body"
              :style="{ fontSize: optionFontSize }"
            >{{ opt.text }}</span>
          </button>
        </div>

        <div class="mt-6 text-center text-[10px] text-muted">
          快捷键: A-D 选答案 · ← → 翻题 · M 标记 · Enter 交卷
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="shrink-0 border-t border-border">
      <!-- Question map: horizontal scroll by default -->
      <div class="border-b border-divider px-5 py-2.5">
        <div class="mx-auto max-w-2xl">
          <button
            class="mb-2 flex items-center gap-1 text-[10px] text-muted transition-colors hover:text-text-secondary"
            @click="mapExpanded = !mapExpanded"
          >
            答题卡
            <ChevronDown v-if="!mapExpanded" class="h-3 w-3" />
            <ChevronUp v-else class="h-3 w-3" />
          </button>
          <div
            class="flex gap-2 pt-0.5"
            :class="mapExpanded ? 'flex-wrap' : 'overflow-x-auto pb-0.5'"
          >
            <button
              v-for="(q, idx) in store.session.questions"
              :key="q.id"
              :class="mapButtonClass(idx, q.id)"
              :title="store.isMarked(q.id) ? `第 ${idx + 1} 题（已标记）` : `第 ${idx + 1} 题`"
              @click="store.goToQuestion(idx)"
            >
              {{ idx + 1 }}
              <span
                v-if="store.isMarked(q.id)"
                class="qb-map-cell__pip"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between px-5 py-3">
        <button
          class="btn-secondary h-9 gap-1 px-4 disabled:cursor-not-allowed disabled:opacity-30"
          :disabled="store.session.currentIndex === 0"
          @click="store.goPrev()"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
          上一题
        </button>

        <button
          v-if="!isLast"
          class="btn-primary h-9 gap-1 px-4"
          @click="store.goNext()"
        >
          下一题
          <ChevronRight class="h-3.5 w-3.5" />
        </button>

        <button
          v-else
          class="inline-flex h-9 items-center gap-1.5 rounded-md bg-paw px-4 text-sm font-medium text-ink
                 transition-colors hover:bg-paw/90"
          @click="handleSubmit"
        >
          <Flag class="h-3.5 w-3.5" />
          交卷
        </button>
      </div>
    </footer>
  </div>

  <ConfirmDialog
    :open="showSubmitConfirm"
    title="确认交卷？"
    :description="submitDescription"
    confirm-label="确认交卷"
    destructive
    test-id="qb-practice-submit-confirm"
    @confirm="confirmSubmit"
    @cancel="showSubmitConfirm = false"
  />

  <ConfirmDialog
    :open="showExitConfirm"
    title="退出练习？"
    description="退出后当前练习进度将丢失，此操作不可撤销。"
    confirm-label="确认退出"
    destructive
    test-id="qb-practice-exit-confirm"
    @confirm="confirmExit"
    @cancel="showExitConfirm = false"
  />
</template>
