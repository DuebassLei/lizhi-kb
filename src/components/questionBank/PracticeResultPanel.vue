<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RotateCcw, LogOut, Check, X, Circle, ChevronDown, ChevronUp } from "@lucide/vue";
import { useQuestionPracticeStore } from "../../stores/questionPractice";
import { QUESTION_TYPE_LABELS } from "../../types/questionBank";

const emit = defineEmits<{ retry: []; exit: [] }>();
const store = useQuestionPracticeStore();

const result = computed(() => store.result);

/** Wrong / unanswered expanded by default; correct collapsed */
const expandedIds = ref<Set<string>>(new Set());

watch(
  result,
  (r) => {
    if (!r) return;
    const next = new Set<string>();
    for (const d of r.details) {
      if (!d.isCorrect) next.add(d.question.id);
    }
    expandedIds.value = next;
  },
  { immediate: true },
);

const scoreColor = computed(() => {
  if (!result.value) return "text-text-secondary";
  if (result.value.score >= 80) return "text-secure";
  if (result.value.score >= 60) return "text-warning";
  return "text-danger";
});

const scoreRingColor = computed(() => {
  if (!result.value) return "var(--color-muted)";
  if (result.value.score >= 80) return "var(--color-secure)";
  if (result.value.score >= 60) return "var(--color-warning)";
  return "var(--color-danger)";
});

const circumference = 2 * Math.PI * 54;
const scoreOffset = computed(() => {
  const score = result.value?.score ?? 0;
  return circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
});

function isExpanded(id: string): boolean {
  return expandedIds.value.has(id);
}

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec} 秒`;
  return `${m} 分 ${sec} 秒`;
}

function formatLabel(label: string): string {
  if (label === "true") return "正确";
  if (label === "false") return "错误";
  return label;
}
</script>

<template>
  <div v-if="result" class="qb-page fixed inset-0 z-50 overflow-y-auto bg-base">
    <div class="mx-auto max-w-2xl px-5 py-8">
      <!-- Score hero -->
      <div class="mb-8 text-center">
        <p class="mb-4 text-xs text-muted">练习完成</p>
        <div class="relative mx-auto mb-5 h-32 w-32">
          <svg class="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="color-mix(in srgb, var(--color-text) 8%, transparent)"
              stroke-width="8"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              :stroke="scoreRingColor"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="scoreOffset"
              class="transition-all duration-500"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-4xl font-bold tabular-nums" :class="scoreColor">
              {{ result.score }}
            </span>
            <span class="text-xs text-muted">分</span>
          </div>
        </div>

        <!-- Stats grid -->
        <div class="mx-auto grid max-w-sm grid-cols-4 gap-2">
          <div class="rounded-lg border border-border bg-surface-0 px-2 py-2.5">
            <div class="mb-0.5 flex items-center justify-center gap-1 text-secure">
              <Check class="h-3 w-3" />
            </div>
            <p class="text-sm font-semibold tabular-nums text-text">{{ result.correct }}</p>
            <p class="text-[10px] text-muted">正确</p>
          </div>
          <div class="rounded-lg border border-border bg-surface-0 px-2 py-2.5">
            <div class="mb-0.5 flex items-center justify-center gap-1 text-danger">
              <X class="h-3 w-3" />
            </div>
            <p class="text-sm font-semibold tabular-nums text-text">{{ result.wrong }}</p>
            <p class="text-[10px] text-muted">错误</p>
          </div>
          <div class="rounded-lg border border-border bg-surface-0 px-2 py-2.5">
            <div class="mb-0.5 flex items-center justify-center gap-1 text-muted">
              <Circle class="h-3 w-3" />
            </div>
            <p class="text-sm font-semibold tabular-nums text-text">{{ result.unanswered }}</p>
            <p class="text-[10px] text-muted">未答</p>
          </div>
          <div class="rounded-lg border border-border bg-surface-0 px-2 py-2.5">
            <p class="mb-0.5 text-[10px] text-muted">用时</p>
            <p class="text-xs font-medium leading-snug text-text-secondary">
              {{ formatDuration(result.duration) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Review -->
      <div class="mb-8 space-y-2">
        <div class="mb-3 flex items-baseline justify-between">
          <h3 class="text-sm font-semibold text-text">题目回顾</h3>
          <span v-if="result.wrong + result.unanswered > 0" class="text-xs text-muted">
            {{ result.wrong + result.unanswered }} 道需关注
          </span>
        </div>

        <div
          v-for="(detail, idx) in result.details"
          :key="detail.question.id"
          class="overflow-hidden rounded-lg border"
          :class="detail.isCorrect
            ? 'border-secure/20 bg-secure/4'
            : 'border-danger/20 bg-danger/4'"
        >
          <!-- Header row (always visible) -->
          <button
            class="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
            @click="toggleExpand(detail.question.id)"
          >
            <span class="text-xs tabular-nums text-muted">#{{ idx + 1 }}</span>
            <span class="rounded bg-link/10 px-1.5 py-0.5 text-[10px] font-medium text-link">
              {{ QUESTION_TYPE_LABELS[detail.question.type] }}
            </span>
            <span
              class="text-[10px] font-medium"
              :class="detail.isCorrect ? 'text-secure' : 'text-danger'"
            >
              {{ detail.isCorrect ? '正确' : (detail.userAnswer.length ? '错误' : '未答') }}
            </span>
            <span class="min-w-0 flex-1 truncate text-sm text-text">
              {{ detail.question.title }}
            </span>
            <ChevronDown
              v-if="!isExpanded(detail.question.id)"
              class="h-3.5 w-3.5 shrink-0 text-muted"
            />
            <ChevronUp
              v-else
              class="h-3.5 w-3.5 shrink-0 text-muted"
            />
          </button>

          <!-- Expanded body -->
          <div
            v-if="isExpanded(detail.question.id)"
            class="space-y-3 border-t border-border px-4 pb-4 pt-3"
          >
            <p class="whitespace-pre-wrap text-base leading-relaxed tracking-wide text-text">
              {{ detail.question.title }}
            </p>

            <div class="space-y-2">
              <div
                v-for="opt in detail.question.options"
                :key="opt.label"
                class="qb-review-opt"
                :class="detail.correctAnswer.includes(opt.label)
                  ? 'qb-review-opt--correct'
                  : detail.userAnswer.includes(opt.label)
                    ? 'qb-review-opt--wrong'
                    : 'qb-review-opt--plain'"
              >
                <span class="shrink-0 font-semibold">{{ formatLabel(opt.label) }}.</span>
                <span class="flex-1">{{ opt.text }}</span>
                <Check
                  v-if="detail.correctAnswer.includes(opt.label)"
                  class="mt-0.5 h-3.5 w-3.5 shrink-0 text-secure"
                />
                <X
                  v-else-if="detail.userAnswer.includes(opt.label)"
                  class="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger"
                />
              </div>
            </div>

            <div class="space-y-1.5 border-t border-border pt-2 text-sm">
              <div class="flex gap-2">
                <span class="shrink-0 text-[var(--qb-ink-faint)]">你的答案:</span>
                <span :class="detail.isCorrect ? 'text-secure' : 'text-danger'">
                  {{ detail.userAnswer.length > 0
                    ? detail.userAnswer.map(formatLabel).join('、')
                    : '未作答' }}
                </span>
              </div>
              <div class="flex gap-2">
                <span class="shrink-0 text-[var(--qb-ink-faint)]">正确答案:</span>
                <span class="text-secure">
                  {{ detail.correctAnswer.map(formatLabel).join('、') }}
                </span>
              </div>
            </div>

            <div
              v-if="detail.question.explanation"
              class="border-t border-border pt-3"
            >
              <div class="qb-explain">
                <div class="qb-explain__label">解析</div>
                <p class="whitespace-pre-wrap">
                  {{ detail.question.explanation }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-center gap-3 pb-8">
        <button
          class="btn-primary gap-1.5 px-5 py-2.5"
          @click="emit('retry')"
        >
          <RotateCcw class="h-3.5 w-3.5" />
          再来一组
        </button>
        <button
          class="btn-secondary gap-1.5 px-5 py-2.5"
          @click="emit('exit')"
        >
          <LogOut class="h-3.5 w-3.5" />
          返回题库
        </button>
      </div>
    </div>
  </div>
</template>
