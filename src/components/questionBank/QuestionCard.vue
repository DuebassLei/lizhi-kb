<script setup lang="ts">
import { computed, ref } from "vue";
import { CircleDot, CheckSquare, ToggleLeft, Edit3, Trash2, ChevronDown, ChevronUp, Check } from "@lucide/vue";
import type { Question } from "../../types/questionBank";
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from "../../types/questionBank";

const props = defineProps<{
  question: Question;
}>();

const emit = defineEmits<{
  edit: [q: Question];
  delete: [id: string];
}>();

const expanded = ref(false);

const typeIcon = computed(() => {
  switch (props.question.type) {
    case "single":
      return CircleDot;
    case "multi":
      return CheckSquare;
    case "truefalse":
      return ToggleLeft;
    default:
      return CircleDot;
  }
});

const looksLikeCode = computed(() => {
  const t = props.question.title;
  return (
    t.includes("{")
    || t.includes(";")
    || /\b(public|class|function|def |import |package )\b/.test(t)
    || t.split("\n").length > 2
  );
});

function isCorrect(optionLabel: string): boolean {
  return props.question.correctAnswer.includes(optionLabel);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("zh-CN");
}

function formatOptionLabel(label: string): string {
  if (label === "true") return "T";
  if (label === "false") return "F";
  return label;
}

function toggleExpand() {
  expanded.value = !expanded.value;
}
</script>

<template>
  <article
    class="qb-card group overflow-hidden"
    :class="{ 'qb-card--expanded': expanded }"
  >
    <div class="px-4 py-3.5">
      <div class="mb-2.5 flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <span class="qb-badge shrink-0">
              <component :is="typeIcon" class="h-3 w-3" />
              {{ QUESTION_TYPE_LABELS[question.type] }}
            </span>
            <span
              v-if="question.difficulty > 0"
              class="qb-difficulty shrink-0"
              :class="`qb-difficulty--${question.difficulty}`"
            >
              <span class="qb-difficulty__dot" aria-hidden="true" />
              {{ DIFFICULTY_LABELS[question.difficulty] }}
            </span>
          </div>

          <div class="qb-card__actions flex shrink-0 items-center gap-0.5">
            <button
              class="rounded p-1.5 text-[var(--qb-ink-faint)] transition-colors hover:bg-link/10 hover:text-link"
              title="编辑"
              @click.stop="emit('edit', question)"
            >
              <Edit3 class="h-3.5 w-3.5" />
            </button>
            <button
              class="rounded p-1.5 text-[var(--qb-ink-faint)] transition-colors hover:bg-danger/10 hover:text-danger"
              title="删除"
              @click.stop="emit('delete', question.id)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
            <button
              class="rounded p-1.5 text-[var(--qb-ink-faint)] transition-colors hover:text-[var(--qb-ink-soft)]"
              :title="expanded ? '收起' : '展开'"
              @click.stop="toggleExpand"
            >
              <ChevronDown v-if="!expanded" class="h-3.5 w-3.5" />
              <ChevronUp v-else class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <h3
          class="qb-title"
          :class="{ 'qb-title--code': looksLikeCode }"
          @click="toggleExpand"
        >
          {{ question.title }}
        </h3>

        <div
          v-if="!expanded"
          class="qb-preview-list"
          @click="toggleExpand"
        >
          <div
            v-for="opt in question.options.slice(0, 2)"
            :key="opt.label"
            class="qb-preview-row"
          >
            <span class="qb-preview-row__key">{{ formatOptionLabel(opt.label) }}</span>
            <span class="qb-preview-row__text">{{ opt.text }}</span>
          </div>
          <span
            v-if="question.options.length > 2"
            class="qb-preview-more"
          >
            还有 {{ question.options.length - 2 }} 个选项
          </span>
        </div>

        <div
          v-if="expanded"
          class="mt-3 space-y-2.5 border-t border-[color-mix(in_srgb,var(--color-text)_6%,transparent)] pt-3"
        >
          <div class="space-y-1.5">
            <div
              v-for="opt in question.options"
              :key="opt.label"
              class="qb-option"
              :class="isCorrect(opt.label) ? 'qb-option--correct' : 'qb-option--plain'"
            >
              <span class="qb-option__mark">
                {{ formatOptionLabel(opt.label) }}
              </span>
              <span class="qb-option__text">{{ opt.text }}</span>
              <Check
                v-if="isCorrect(opt.label)"
                class="qb-option__check h-3.5 w-3.5"
              />
            </div>
          </div>

          <div v-if="question.explanation" class="pt-2">
            <div class="qb-explain">
              <div class="qb-explain__label">解析</div>
              <div class="whitespace-pre-wrap">{{ question.explanation }}</div>
            </div>
          </div>

          <div
            v-if="question.tags.length > 0"
            class="flex flex-wrap items-center gap-1.5 pt-1"
          >
            <span
              v-for="tag in question.tags"
              :key="tag"
              class="qb-tag"
            >
              #{{ tag }}
            </span>
          </div>

          <div class="qb-meta flex items-center gap-3 pt-1">
            <span v-if="question.source">来源: {{ question.source }}</span>
            <span>{{ formatDate(question.createdAt) }}</span>
          </div>
        </div>
    </div>
  </article>
</template>
