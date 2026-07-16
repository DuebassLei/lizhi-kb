import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "./vaultService";
import type {
  BatchImportResult,
  CreateQuestionInput,
  ImportResult,
  Question,
  QuestionBankStats,
  QuestionSearchParams,
  QuestionSearchResult,
  UpdateQuestionPatch,
} from "../types/questionBank";

const STORAGE_KEY = "lizhi-kb-question-bank";

interface StoredData {
  questions: Question[];
}

function loadStored(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { questions: [] };
    const parsed = JSON.parse(raw) as StoredData;
    return { questions: parsed.questions ?? [] };
  } catch {
    return { questions: [] };
  }
}

function saveStored(data: StoredData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function withFallback<T>(
  cmd: string,
  args: Record<string, unknown>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (!isTauriRuntime()) return fallback();
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[questionBank] Tauri command "${cmd}" failed, using fallback:`, err);
    return fallback();
  }
}

// ── localStorage fallback implementations ─────────────────────

let localIdCounter = 0;

function nextLocalId(): string {
  localIdCounter += 1;
  return `local-${Date.now()}-${localIdCounter}`;
}

function localSearch(params: QuestionSearchParams): QuestionSearchResult {
  const data = loadStored();
  let filtered = [...data.questions];

  if (params.keyword) {
    const kw = params.keyword.toLowerCase();
    filtered = filtered.filter(
      (q) =>
        q.title.toLowerCase().includes(kw) ||
        q.explanation.toLowerCase().includes(kw) ||
        q.tags.some((t) => t.toLowerCase().includes(kw)) ||
        q.options.some((o) => o.text.toLowerCase().includes(kw)),
    );
  }

  if (params.type) {
    filtered = filtered.filter((q) => q.type === params.type);
  }

  if (params.difficulty !== undefined) {
    filtered = filtered.filter((q) => q.difficulty === params.difficulty);
  }

  const sortBy = params.sortBy ?? "default";
  filtered.sort((a, b) => {
    switch (sortBy) {
      case "created_desc":
        return b.createdAt - a.createdAt || a.sortOrder - b.sortOrder;
      case "created_asc":
        return a.createdAt - b.createdAt || a.sortOrder - b.sortOrder;
      case "updated_desc":
        return b.updatedAt - a.updatedAt || b.createdAt - a.createdAt;
      default:
        return a.sortOrder - b.sortOrder || b.createdAt - a.createdAt;
    }
  });

  const total = filtered.length;
  const page = params.page;
  const pageSize = params.pageSize;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return { items, total, page, pageSize };
}

function localCreateQuestion(input: CreateQuestionInput): Question {
  const data = loadStored();
  const now = Date.now();
  const q: Question = {
    id: nextLocalId(),
    type: input.type,
    title: input.title.trim(),
    options: input.options,
    correctAnswer: input.correctAnswer,
    explanation: input.explanation ?? "",
    tags: input.tags ?? [],
    source: input.source ?? "",
    difficulty: (input.difficulty ?? 0) as 0 | 1 | 2 | 3,
    sortOrder: data.questions.length,
    createdAt: now,
    updatedAt: now,
  };
  data.questions.push(q);
  saveStored(data);
  return q;
}

function localUpdateQuestion(id: string, patch: UpdateQuestionPatch): Question {
  const data = loadStored();
  const idx = data.questions.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("题目不存在");
  const current = data.questions[idx];
  const updated: Question = {
    ...current,
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.options !== undefined ? { options: patch.options } : {}),
    ...(patch.correctAnswer !== undefined ? { correctAnswer: patch.correctAnswer } : {}),
    ...(patch.explanation !== undefined ? { explanation: patch.explanation } : {}),
    ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
    ...(patch.source !== undefined ? { source: patch.source } : {}),
    ...(patch.difficulty !== undefined ? { difficulty: patch.difficulty as 0 | 1 | 2 | 3 } : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
    updatedAt: Date.now(),
  };
  data.questions[idx] = updated;
  saveStored(data);
  return updated;
}

function localDeleteQuestion(id: string): void {
  const data = loadStored();
  data.questions = data.questions.filter((r) => r.id !== id);
  saveStored(data);
}

// ── Exported API ──────────────────────────────────────────────

export async function searchQuestions(
  params: QuestionSearchParams,
): Promise<QuestionSearchResult> {
  return withFallback("search_questions", { params }, () => localSearch(params));
}

export async function getAllQuestions(): Promise<Question[]> {
  return withFallback("list_questions", {}, () => loadStored().questions);
}

export async function getQuestion(id: string): Promise<Question> {
  return withFallback(
    "get_question",
    { id },
    () => {
      const data = loadStored();
      const q = data.questions.find((r) => r.id === id);
      if (!q) throw new Error("题目不存在");
      return q;
    },
  );
}

export async function createQuestion(input: CreateQuestionInput): Promise<Question> {
  return withFallback("create_question", { input }, () => localCreateQuestion(input));
}

export async function updateQuestion(
  id: string,
  patch: UpdateQuestionPatch,
): Promise<Question> {
  return withFallback("update_question", { id, patch }, () =>
    localUpdateQuestion(id, patch),
  );
}

export async function deleteQuestion(id: string): Promise<void> {
  return withFallback(
    "delete_question",
    { id },
    () => {
      localDeleteQuestion(id);
    },
  );
}

export async function clearAllQuestions(): Promise<number> {
  return withFallback(
    "clear_all_questions",
    {},
    () => {
      const data = loadStored();
      const count = data.questions.length;
      data.questions = [];
      saveStored(data);
      return count;
    },
  );
}

export async function batchImportQuestions(
  inputs: CreateQuestionInput[],
): Promise<BatchImportResult> {
  return withFallback(
    "batch_import_questions",
    { inputs },
    async () => {
      let imported = 0;
      let failed = 0;
      const errors: string[] = [];
      for (const input of inputs) {
        try {
          localCreateQuestion(input);
          imported += 1;
        } catch (e) {
          failed += 1;
          errors.push(e instanceof Error ? e.message : "导入失败");
        }
      }
      return { imported, skipped: 0, failed, errors };
    },
  );
}

export async function exportQuestionBank(): Promise<string> {
  return withFallback(
    "export_question_bank",
    {},
    () => {
      const data = loadStored();
      const exportData = {
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        total: data.questions.length,
        questions: data.questions,
      };
      return JSON.stringify(exportData, null, 2);
    },
  );
}

export async function importQuestionBank(
  jsonData: string,
  mode: "replace" | "merge",
): Promise<ImportResult> {
  return withFallback(
    "import_question_bank",
    { jsonData, mode },
    () => {
      const parsed = JSON.parse(jsonData);
      const questions: Question[] = parsed.questions ?? [];
      const data = loadStored();

      if (mode === "replace") {
        data.questions = [];
      }

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      for (const q of questions) {
        const existingIdx = data.questions.findIndex((e) => e.id === q.id);
        if (existingIdx >= 0) {
          data.questions[existingIdx] = { ...q, updatedAt: Date.now() };
          updated += 1;
        } else {
          data.questions.push({ ...q, updatedAt: Date.now() });
          imported += 1;
        }
      }

      saveStored(data);
      return { imported, updated, skipped, total: questions.length };
    },
  );
}

export async function getQuestionBankStats(): Promise<QuestionBankStats> {
  return withFallback(
    "get_question_bank_stats",
    {},
    () => {
      const data = loadStored();
      const byType: Record<string, number> = {};
      const byDifficulty: Record<number, number> = {};
      for (const q of data.questions) {
        byType[q.type] = (byType[q.type] ?? 0) + 1;
        byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] ?? 0) + 1;
      }
      return {
        total: data.questions.length,
        byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
        byDifficulty: Object.entries(byDifficulty).map(([d, count]) => ({
          difficulty: Number(d),
          count,
        })),
      };
    },
  );
}

export { nextLocalId };
