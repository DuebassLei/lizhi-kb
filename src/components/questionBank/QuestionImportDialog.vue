<script setup lang="ts">
import { ref } from "vue";
import { X, Sparkles } from "@lucide/vue";
import { useQuestionBankStore } from "../../stores/questionBank";
import type { CreateQuestionInput, QuestionType } from "../../types/questionBank";

const store = useQuestionBankStore();

const emit = defineEmits<{
  close: [];
}>();

const step = ref<"input" | "preview">("input");
const rawText = ref("");
const parsedQuestions = ref<CreateQuestionInput[]>([]);
const selectedIds = ref<Set<number>>(new Set());
const importing = ref(false);
const parseLoading = ref(false);
const parseError = ref("");

// Quick mock parser for demo purposes
// In production, this would call the AI service
function mockParseQuestions(text: string): CreateQuestionInput[] {
  const results: CreateQuestionInput[] = [];
  // Split by blank lines or numbered question patterns
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const title = lines[0].replace(/^\d+[\.、]\s*/, "");
    const optionLines: string[] = [];
    let correctIndices: string[] = [];
    let qType: QuestionType = "single";

    // Detect true/false question: "答案：对/错" or "答案：正确/错误" or "答案：T/F" or "答案：√/×"
    const answerLine = lines.find((l) => l.startsWith("答案") || l.startsWith("正确答案"));
    if (answerLine) {
      const ans = answerLine.replace(/^答案[：:]\s*/, "").replace(/^正确答案[：:]\s*/, "").trim();
      // True/false detection
      const isTrue = /^(对|正确|T|√|true)$/i.test(ans);
      const isFalse = /^(错|错误|F|×|false)$/i.test(ans);
      if (isTrue || isFalse) {
        results.push({
          type: "truefalse",
          title,
          options: [
            { label: "true", text: "正确" },
            { label: "false", text: "错误" },
          ],
          correctAnswer: [isTrue ? "true" : "false"],
          explanation: extractExplanation(lines),
          tags: [],
          source: "",
          difficulty: 0,
        });
        continue;
      }
      // Multi-choice detection
      const labels = ans.split(/[,，、\s]+/).filter(Boolean);
      correctIndices = labels.filter((l) => /^[A-Z]$/i.test(l));
      if (correctIndices.length > 1) qType = "multi";
    }

    // Collect option lines (A. B. C. D. pattern)
    for (const line of lines) {
      if (line.match(/^[A-Z][\.、\s]/i)) {
        optionLines.push(line);
      }
    }

    const options = optionLines.map((ol) => {
      const match = ol.match(/^([A-Z])[\.、\s]\s*(.+)/i);
      return {
        label: match ? match[1].toUpperCase() : "",
        text: match ? match[2] : ol,
      };
    });

    if (title && options.length >= 2) {
      results.push({
        type: qType,
        title,
        options,
        correctAnswer: correctIndices.length > 0 ? correctIndices : [options[0].label],
        explanation: extractExplanation(lines),
        tags: [],
        source: "",
        difficulty: 0,
      });
    }
  }

  return results;
}

function extractExplanation(lines: string[]): string {
  const idx = lines.findIndex((l) => l.startsWith("解析") || l.startsWith("解释"));
  if (idx === -1) return "";
  const first = lines[idx]
    .replace(/^解析[：:]\s*/, "")
    .replace(/^解释[：:]\s*/, "")
    .trim();
  // Collect remaining lines until next question marker
  const rest: string[] = [];
  for (let j = idx + 1; j < lines.length; j++) {
    if (/^\d+[\.、]\s/.test(lines[j]) || lines[j].startsWith("答案")) break;
    rest.push(lines[j]);
  }
  return [first, ...rest].filter(Boolean).join("\n");
}

async function handleParse() {
  if (!rawText.value.trim()) return;
  parseLoading.value = true;
  parseError.value = "";

  try {
    // Simulate AI parsing delay
    await new Promise((r) => setTimeout(r, 500));
    parsedQuestions.value = mockParseQuestions(rawText.value);

    if (parsedQuestions.value.length === 0) {
      parseError.value = "未能从文本中识别出有效的题目结构，请检查格式。";
    } else {
      selectedIds.value = new Set(parsedQuestions.value.map((_, i) => i));
      step.value = "preview";
    }
  } catch {
    parseError.value = "解析失败，请重试。";
  } finally {
    parseLoading.value = false;
  }
}

function toggleSelect(idx: number) {
  const s = new Set(selectedIds.value);
  if (s.has(idx)) s.delete(idx);
  else s.add(idx);
  selectedIds.value = s;
}

function toggleAll() {
  if (selectedIds.value.size === parsedQuestions.value.length) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(parsedQuestions.value.map((_, i) => i));
  }
}

async function handleImport() {
  const selected = parsedQuestions.value.filter((_, i) => selectedIds.value.has(i));
  if (selected.length === 0) return;

  importing.value = true;
  try {
    await store.batchImport(selected);
    emit("close");
  } finally {
    importing.value = false;
  }
}

function handleReset() {
  step.value = "input";
  rawText.value = "";
  parsedQuestions.value = [];
  selectedIds.value = new Set();
  parseError.value = "";
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]" @click.self="emit('close')">
      <div
        class="bg-[#1a1d23] border border-white/10 rounded-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h2 class="text-base font-semibold text-[#f0f1f2]">导入题目</h2>
          <button
            class="p-1.5 rounded text-[#6b717a] hover:text-[#b0b5bd] hover:bg-white/5 transition-colors"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <!-- Step: Input -->
          <div v-if="step === 'input'" class="space-y-4">
            <p class="text-sm text-[#b0b5bd]">
              粘贴包含题目的文本，系统将自动解析题目结构。支持格式：
            </p>
            <ul class="text-xs text-[#6b717a] space-y-1 ml-4">
              <li>• 题干（第一行）</li>
              <li>• A. 选项 A  /  B. 选项 B ...</li>
              <li>• 答案：A</li>
              <li>• 解析：题目解析文字</li>
            </ul>

            <textarea
              v-model="rawText"
              rows="12"
              class="w-full bg-[#141619] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-[#f0f1f2]
                     placeholder:text-[#6b717a] resize-none font-mono
                     focus:outline-none focus:ring-1 focus:ring-[#5b9fd4]/30 focus:border-[#5b9fd4]/40"
              placeholder="粘贴题目文本...
例如：

1. 微积分基本定理表明什么？
A. 导数与积分互为逆运算
B. 极限存在则函数连续
C. 连续必可微
D. 可微必可积
答案：A
解析：牛顿-莱布尼茨公式..."
            />

            <div v-if="parseError" class="text-sm text-[#e0556a] bg-[#e0556a]/10 border border-[#e0556a]/20 rounded-lg px-3 py-2">
              {{ parseError }}
            </div>

            <button
              class="w-full py-2.5 rounded-lg text-sm font-medium bg-[#5b9fd4] text-[#141619]
                     hover:bg-[#5b9fd4]/90 transition-colors disabled:opacity-50
                     flex items-center justify-center gap-2"
              :disabled="!rawText.trim() || parseLoading"
              @click="handleParse"
            >
              <Sparkles class="h-4 w-4" />
              {{ parseLoading ? "解析中..." : "解析题目" }}
            </button>
          </div>

          <!-- Step: Preview -->
          <div v-else class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm text-[#b0b5bd]">
                识别到 {{ parsedQuestions.length }} 道题目
              </span>
              <button
                class="text-xs text-[#5b9fd4] hover:text-[#5b9fd4]/80 transition-colors"
                @click="toggleAll"
              >
                {{ selectedIds.size === parsedQuestions.length ? "取消全选" : "全选" }}
              </button>
            </div>

            <div class="space-y-2 max-h-[50vh] overflow-y-auto">
              <div
                v-for="(q, idx) in parsedQuestions"
                :key="idx"
                class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                :class="
                  selectedIds.has(idx)
                    ? 'bg-[#5b9fd4]/10 border-[#5b9fd4]/20'
                    : 'bg-[#141619] border-white/6 hover:border-white/10'
                "
                @click="toggleSelect(idx)"
              >
                <div
                  class="shrink-0 w-5 h-5 rounded border flex items-center justify-center mt-0.5"
                  :class="
                    selectedIds.has(idx)
                      ? 'bg-[#5b9fd4] border-[#5b9fd4]'
                      : 'bg-transparent border-white/15'
                  "
                >
                  <span v-if="selectedIds.has(idx)" class="text-[10px] text-[#141619] font-bold">✓</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      :class="
                        q.type === 'single'
                          ? 'bg-[#5b9fd4]/15 text-[#5b9fd4]'
                          : q.type === 'multi'
                            ? 'bg-[#f0c040]/15 text-[#f0c040]'
                            : 'bg-[#3ecf8e]/15 text-[#3ecf8e]'
                      "
                    >
                      {{ { single: "单选", multi: "多选", truefalse: "判断" }[q.type] }}
                    </span>
                    <span class="text-xs text-[#6b717a]">
                      答案: {{ q.correctAnswer.join(", ") }}
                    </span>
                  </div>
                  <p class="text-sm text-[#f0f1f2] truncate">{{ q.title }}</p>
                  <div class="flex flex-wrap gap-1.5 mt-1">
                    <span
                      v-for="opt in q.options.slice(0, 3)"
                      :key="opt.label"
                      class="text-[11px] text-[#6b717a]"
                    >
                      {{ opt.label }}. {{ opt.text.slice(0, 24) }}{{ opt.text.length > 24 ? '...' : '' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex gap-3">
              <button
                class="flex-1 py-2.5 rounded-lg text-sm text-[#b0b5bd] border border-white/8
                       hover:border-white/15 hover:text-[#f0f1f2] transition-colors"
                @click="handleReset"
              >
                重新粘贴
              </button>
              <button
                class="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[#5b9fd4] text-[#141619]
                       hover:bg-[#5b9fd4]/90 transition-colors disabled:opacity-50"
                :disabled="selectedIds.size === 0 || importing"
                @click="handleImport"
              >
                {{ importing ? "导入中..." : `导入选中 (${selectedIds.size})` }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="fixed inset-0 z-40 bg-black/60" @click="emit('close')" />
  </Teleport>
</template>
