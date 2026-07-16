<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  X, Plus, Trash2, CircleDot, CheckSquare, ToggleLeft,
} from "@lucide/vue";
import { useQuestionBankStore } from "../../stores/questionBank";
import type { Question, QuestionOption, QuestionType } from "../../types/questionBank";
import { QUESTION_TYPE_LABELS } from "../../types/questionBank";

const store = useQuestionBankStore();

const props = defineProps<{
  question?: Question | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const saving = ref(false);
const error = ref("");

const type = ref<QuestionType>("single");
const title = ref("");
const options = ref<QuestionOption[]>([
  { label: "A", text: "" },
  { label: "B", text: "" },
]);
const correctAnswer = ref<string[]>(["A"]);
const explanation = ref("");
const tags = ref<string[]>(["默认"]);
const source = ref("");
const difficulty = ref<number>(0);
const tagsInput = ref("默认");

const isEditing = computed(() => !!props.question);

// Init from existing question
watch(
  () => props.question,
  (q) => {
    if (q) {
      type.value = q.type;
      title.value = q.title;

      if (q.type === "truefalse") {
        options.value = [
          { label: "true", text: "正确" },
          { label: "false", text: "错误" },
        ];
      } else {
        options.value = [...q.options];
      }

      correctAnswer.value = [...q.correctAnswer];
      explanation.value = q.explanation;
      tags.value = [...q.tags];
      source.value = q.source;
      difficulty.value = q.difficulty;
      tagsInput.value = q.tags.join(", ");
    }
  },
  { immediate: true },
);

function setType(t: QuestionType) {
  type.value = t;
  if (t === "truefalse") {
    options.value = [
      { label: "true", text: "正确" },
      { label: "false", text: "错误" },
    ];
    correctAnswer.value = ["true"];
  } else {
    // Reset to lettered options if current options are true/false labels or too few
    const hasTrueFalseLabels = options.value.some((o) => o.label === "true" || o.label === "false");
    if (hasTrueFalseLabels || options.value.length < 2) {
      options.value = [
        { label: "A", text: "" },
        { label: "B", text: "" },
      ];
      correctAnswer.value = ["A"];
    }
  }
}

function addOption() {
  const label = String.fromCharCode(65 + options.value.length);
  options.value.push({ label, text: "" });
}

function removeOption(idx: number) {
  if (options.value.length <= 2) return;
  const removed = options.value[idx].label;
  options.value.splice(idx, 1);
  // Re-label
  options.value.forEach((opt, i) => {
    opt.label = String.fromCharCode(65 + i);
  });
  // Remove from answers if needed
  correctAnswer.value = correctAnswer.value.filter((a) => a !== removed);
}

function toggleAnswer(label: string) {
  if (type.value === "single") {
    correctAnswer.value = [label];
  } else {
    const idx = correctAnswer.value.indexOf(label);
    if (idx >= 0) {
      correctAnswer.value.splice(idx, 1);
    } else {
      correctAnswer.value.push(label);
    }
  }
}

function parseTags() {
  tags.value = tagsInput.value
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function handleSave() {
  error.value = "";

  if (!title.value.trim()) {
    error.value = "请输入题干";
    return;
  }

  if (type.value !== "truefalse") {
    const filled = options.value.filter((o) => o.text.trim());
    if (filled.length < 2) {
      error.value = "至少填写 2 个选项";
      return;
    }
  }

  if (correctAnswer.value.length === 0) {
    error.value = "请选择正确答案";
    return;
  }

  parseTags();

  saving.value = true;
  try {
    if (isEditing.value && props.question) {
      await store.save(props.question.id, {
        type: type.value,
        title: title.value.trim(),
        options: type.value === "truefalse"
          ? [{ label: "true", text: "正确" }, { label: "false", text: "错误" }]
          : options.value.map((o) => ({ ...o, text: o.text.trim() })),
        correctAnswer: correctAnswer.value,
        explanation: explanation.value.trim(),
        tags: tags.value,
        source: source.value.trim(),
        difficulty: difficulty.value,
      });
    } else {
      await store.add({
        type: type.value,
        title: title.value.trim(),
        options: type.value === "truefalse"
          ? [{ label: "true", text: "正确" }, { label: "false", text: "错误" }]
          : options.value.map((o) => ({ ...o, text: o.text.trim() })),
        correctAnswer: correctAnswer.value,
        explanation: explanation.value.trim(),
        tags: tags.value,
        source: source.value.trim(),
        difficulty: difficulty.value,
      });
    }
    emit("close");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "保存失败";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]"
      @click.self="emit('close')"
    >
      <div
        class="bg-[#1a1d23] border border-white/10 rounded-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h2 class="text-base font-semibold text-[#f0f1f2]">
            {{ isEditing ? "编辑题目" : "新建题目" }}
          </h2>
          <button
            class="p-1.5 rounded text-[#6b717a] hover:text-[#b0b5bd] hover:bg-white/5 transition-colors"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <!-- Error -->
          <div
            v-if="error"
            class="text-sm text-[#e0556a] bg-[#e0556a]/10 border border-[#e0556a]/20 rounded-lg px-3 py-2"
          >
            {{ error }}
          </div>

          <!-- Type selector -->
          <div>
            <label class="block text-xs text-[#6b717a] mb-2">题型</label>
            <div class="flex gap-2">
              <button
                v-for="t in (['single', 'multi', 'truefalse'] as QuestionType[])"
                :key="t"
                class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
                :class="
                  type === t
                    ? 'bg-[#5b9fd4]/15 text-[#5b9fd4] border-[#5b9fd4]/25'
                    : 'bg-[#141619] text-[#b0b5bd] border-white/6 hover:border-white/10'
                "
                @click="setType(t)"
              >
                <CircleDot v-if="t === 'single'" class="h-3.5 w-3.5" />
                <CheckSquare v-else-if="t === 'multi'" class="h-3.5 w-3.5" />
                <ToggleLeft v-else class="h-3.5 w-3.5" />
                {{ QUESTION_TYPE_LABELS[t] }}
              </button>
            </div>
          </div>

          <!-- Title -->
          <div>
            <label class="block text-xs text-[#6b717a] mb-2">题干</label>
            <textarea
              v-model="title"
              rows="3"
              class="w-full bg-[#141619] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-[#f0f1f2]
                     placeholder:text-[#6b717a] resize-none
                     focus:outline-none focus:ring-1 focus:ring-[#5b9fd4]/30 focus:border-[#5b9fd4]/40"
              placeholder="输入题目内容..."
            />
          </div>

          <!-- Options -->
          <div v-if="type !== 'truefalse'">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs text-[#6b717a]">选项</label>
              <button
                class="flex items-center gap-1 text-xs text-[#5b9fd4] hover:text-[#5b9fd4]/80 transition-colors"
                @click="addOption"
              >
                <Plus class="h-3 w-3" /> 添加选项
              </button>
            </div>
            <div class="space-y-2">
              <div
                v-for="(opt, idx) in options"
                :key="idx"
                class="flex items-center gap-2"
              >
                <button
                  class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors"
                  :class="
                    correctAnswer.includes(opt.label)
                      ? 'bg-[#d4a574]/20 text-[#d4a574] border-[#d4a574]/30'
                      : 'bg-[#141619] text-[#6b717a] border-white/8 hover:border-white/15'
                  "
                  @click="toggleAnswer(opt.label)"
                >
                  {{ opt.label }}
                </button>
                <input
                  v-model="opt.text"
                  type="text"
                  class="flex-1 bg-[#141619] border border-white/8 rounded-lg px-3 py-2 text-sm text-[#f0f1f2]
                         placeholder:text-[#6b717a]
                         focus:outline-none focus:ring-1 focus:ring-[#5b9fd4]/30 focus:border-[#5b9fd4]/40"
                  :placeholder="`选项 ${opt.label} 内容`"
                />
                <button
                  class="p-1.5 rounded text-[#6b717a] hover:text-[#e0556a] hover:bg-[#e0556a]/10 transition-colors"
                  :class="{ 'opacity-30 pointer-events-none': options.length <= 2 }"
                  @click="removeOption(idx)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- True/False answer -->
          <div v-else>
            <label class="block text-xs text-[#6b717a] mb-2">正确答案</label>
            <div class="flex gap-3">
              <button
                class="flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors"
                :class="
                  correctAnswer.includes('true')
                    ? 'bg-[#3ecf8e]/15 text-[#3ecf8e] border-[#3ecf8e]/25'
                    : 'bg-[#141619] text-[#b0b5bd] border-white/6 hover:border-white/10'
                "
                @click="correctAnswer = ['true']"
              >
                ✓ 正确
              </button>
              <button
                class="flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors"
                :class="
                  correctAnswer.includes('false')
                    ? 'bg-[#e0556a]/15 text-[#e0556a] border-[#e0556a]/20'
                    : 'bg-[#141619] text-[#b0b5bd] border-white/6 hover:border-white/10'
                "
                @click="correctAnswer = ['false']"
              >
                ✗ 错误
              </button>
            </div>
          </div>

          <!-- Explanation -->
          <div>
            <label class="block text-xs text-[#6b717a] mb-2">解析（可选）</label>
            <textarea
              v-model="explanation"
              rows="3"
              class="w-full bg-[#141619] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-[#f0f1f2]
                     placeholder:text-[#6b717a] resize-none
                     focus:outline-none focus:ring-1 focus:ring-[#5b9fd4]/30 focus:border-[#5b9fd4]/40"
              placeholder="输入题目解析..."
            />
          </div>

          <!-- Tags & Source -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-[#6b717a] mb-2">标签（逗号分隔）</label>
              <input
                v-model="tagsInput"
                type="text"
                class="w-full bg-[#141619] border border-white/8 rounded-lg px-3 py-2 text-sm text-[#f0f1f2]
                       placeholder:text-[#6b717a]
                       focus:outline-none focus:ring-1 focus:ring-[#5b9fd4]/30 focus:border-[#5b9fd4]/40"
                placeholder="数学, 微积分"
                @blur="parseTags"
              />
            </div>
            <div>
              <label class="block text-xs text-[#6b717a] mb-2">难度</label>
              <select
                v-model.number="difficulty"
                class="w-full bg-[#141619] border border-white/8 rounded-lg px-3 py-2 text-sm text-[#f0f1f2]
                       focus:outline-none focus:ring-1 focus:ring-[#5b9fd4]/30 focus:border-[#5b9fd4]/40"
              >
                <option :value="0">未标记</option>
                <option :value="1">容易</option>
                <option :value="2">中等</option>
                <option :value="3">困难</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs text-[#6b717a] mb-2">来源（可选）</label>
            <input
              v-model="source"
              type="text"
              class="w-full bg-[#141619] border border-white/8 rounded-lg px-3 py-2 text-sm text-[#f0f1f2]
                     placeholder:text-[#6b717a]
                     focus:outline-none focus:ring-1 focus:ring-[#5b9fd4]/30 focus:border-[#5b9fd4]/40"
              placeholder="文档名 / URL..."
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/6">
          <button
            class="px-4 py-2 rounded-lg text-sm text-[#b0b5bd] hover:text-[#f0f1f2] hover:bg-white/5 transition-colors"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            class="px-4 py-2 rounded-lg text-sm font-medium bg-[#5b9fd4] text-[#141619]
                   hover:bg-[#5b9fd4]/90 transition-colors disabled:opacity-50"
            :disabled="saving"
            @click="handleSave"
          >
            {{ saving ? "保存中..." : "保存题目" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Backdrop -->
    <div class="fixed inset-0 z-40 bg-black/60" @click="emit('close')" />
  </Teleport>
</template>
