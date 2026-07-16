<script setup lang="ts">
import { ref, watch } from "vue";
import { X, Play } from "@lucide/vue";
import { useQuestionPracticeStore } from "../../stores/questionPractice";
import type { QuestionType } from "../../types/questionBank";
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from "../../types/questionBank";

const emit = defineEmits<{ close: [] }>();
const store = useQuestionPracticeStore();

const questionCount = ref(store.config.questionCount);
const selectedTypes = ref<QuestionType[]>([...store.config.types]);
const selectedDifficulty = ref<number[]>([...store.config.difficulty]);

const allTypes: QuestionType[] = ["single", "multi", "truefalse"];
const allDifficulties = [0, 1, 2, 3];
const quickCounts = [10, 20, 30];

watch(questionCount, (val) => {
  if (typeof val !== "number" || isNaN(val)) {
    questionCount.value = 10;
    return;
  }
  if (val < 5) questionCount.value = 5;
  else if (val > 50) questionCount.value = 50;
});

function toggleType(t: QuestionType) {
  const idx = selectedTypes.value.indexOf(t);
  if (idx >= 0) selectedTypes.value.splice(idx, 1);
  else selectedTypes.value.push(t);
}

function toggleDifficulty(d: number) {
  const idx = selectedDifficulty.value.indexOf(d);
  if (idx >= 0) selectedDifficulty.value.splice(idx, 1);
  else selectedDifficulty.value.push(d);
}

function typeChipClass(t: QuestionType, selected: boolean): string {
  if (!selected) {
    return "bg-base text-muted border border-border hover:border-border-strong";
  }
  switch (t) {
    case "single":
      return "bg-link/15 text-link border border-link/30 font-medium";
    case "multi":
      return "bg-warning/15 text-warning border border-warning/30 font-medium";
    case "truefalse":
      return "bg-secure/15 text-secure border border-secure/30 font-medium";
    default:
      return "bg-link/15 text-link border border-link/30 font-medium";
  }
}

async function handleStart() {
  if (selectedTypes.value.length === 0 || selectedDifficulty.value.length === 0) return;
  await store.startPractice({
    questionCount: questionCount.value,
    types: [...selectedTypes.value],
    difficulty: [...selectedDifficulty.value],
  });
  if (store.session) emit("close");
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
    <div class="mx-4 w-full max-w-md rounded-xl border border-border-strong bg-surface-0 shadow-float">
      <!-- Header -->
      <div class="flex items-start justify-between border-b border-border px-5 py-4">
        <div>
          <h2 class="text-sm font-semibold text-text">模拟练习配置</h2>
          <p class="mt-0.5 text-xs text-muted">按条件随机抽题，本地作答</p>
        </div>
        <button class="btn-ghost p-1" @click="emit('close')">
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="space-y-5 px-5 py-4">
        <!-- Question count -->
        <div>
          <div class="mb-3 flex items-end justify-between">
            <label class="text-xs text-text-secondary">题目数量</label>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-semibold tabular-nums text-link">{{ questionCount }}</span>
              <span class="text-xs text-muted">题</span>
            </div>
          </div>

          <div class="mb-3 flex gap-2">
            <button
              v-for="n in quickCounts"
              :key="n"
              class="flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors"
              :class="
                questionCount === n
                  ? 'border-link/30 bg-link/15 text-link'
                  : 'border-border bg-base text-muted hover:border-border-strong hover:text-text-secondary'
              "
              @click="questionCount = n"
            >
              {{ n }} 题
            </button>
          </div>

          <input
            v-model.number="questionCount"
            type="range"
            min="5"
            max="50"
            step="1"
            class="w-full accent-[var(--color-link)]"
          />
          <div class="mt-1 flex justify-between text-[10px] text-muted">
            <span>5</span>
            <span>50</span>
          </div>
        </div>

        <!-- Types -->
        <div>
          <label class="mb-2 block text-xs text-text-secondary">题型</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="t in allTypes"
              :key="t"
              class="rounded-lg px-3 py-1.5 text-xs transition-colors"
              :class="typeChipClass(t, selectedTypes.includes(t))"
              @click="toggleType(t)"
            >
              {{ QUESTION_TYPE_LABELS[t] }}
            </button>
          </div>
          <p
            v-if="selectedTypes.length === 0"
            class="mt-1.5 text-[11px] text-danger"
          >
            请至少选择一种题型
          </p>
        </div>

        <!-- Difficulty -->
        <div>
          <label class="mb-2 block text-xs text-text-secondary">难度</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="d in allDifficulties"
              :key="d"
              class="rounded-lg px-3 py-1.5 text-xs transition-colors"
              :class="
                selectedDifficulty.includes(d)
                  ? 'border border-link/30 bg-link/15 font-medium text-link'
                  : 'border border-border bg-base text-muted hover:border-border-strong'
              "
              @click="toggleDifficulty(d)"
            >
              {{ DIFFICULTY_LABELS[d] }}
            </button>
          </div>
          <p
            v-if="selectedDifficulty.length === 0"
            class="mt-1.5 text-[11px] text-danger"
          >
            请至少选择一种难度
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
        <button
          class="btn-ghost px-4 py-2"
          :disabled="store.loading"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          class="btn-primary gap-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="store.loading
            || selectedTypes.length === 0
            || selectedDifficulty.length === 0"
          @click="handleStart"
        >
          <Play v-if="!store.loading" class="h-3.5 w-3.5" />
          <span
            v-else
            class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
          />
          {{ store.loading ? "加载中…" : `开始练习（${questionCount} 题）` }}
        </button>
      </div>
    </div>
  </div>
</template>
