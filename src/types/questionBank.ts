export type QuestionType = "single" | "multi" | "truefalse";

export interface QuestionOption {
  label: string;
  text: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  options: QuestionOption[];
  correctAnswer: string[];
  explanation: string;
  tags: string[];
  source: string;
  difficulty: 0 | 1 | 2 | 3;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionSearchParams {
  keyword?: string;
  type?: QuestionType;
  tags?: string[];
  difficulty?: number;
  /** default | created_desc | created_asc | updated_desc */
  sortBy?: QuestionSortBy;
  page: number;
  pageSize: number;
}

export type QuestionSortBy =
  | "default"
  | "created_desc"
  | "created_asc"
  | "updated_desc";

export const QUESTION_SORT_LABELS: Record<QuestionSortBy, string> = {
  default: "默认排序",
  created_desc: "最新创建",
  created_asc: "最早创建",
  updated_desc: "最近更新",
};

export interface QuestionSearchResult {
  items: Question[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateQuestionInput {
  type: QuestionType;
  title: string;
  options: QuestionOption[];
  correctAnswer: string[];
  explanation?: string;
  tags?: string[];
  source?: string;
  difficulty?: number;
}

export interface UpdateQuestionPatch {
  type?: QuestionType;
  title?: string;
  options?: QuestionOption[];
  correctAnswer?: string[];
  explanation?: string;
  tags?: string[];
  source?: string;
  difficulty?: number;
  sortOrder?: number;
}

export interface BatchImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
}

export interface QuestionBankStats {
  total: number;
  byType: { type: string; count: number }[];
  byDifficulty: { difficulty: number; count: number }[];
}

export interface QuestionExportData {
  version: string;
  exportedAt: string;
  total: number;
  questions: Question[];
}

// Display helpers
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: "单选",
  multi: "多选",
  truefalse: "判断",
};

export const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  single: "CircleDot",
  multi: "CheckSquare",
  truefalse: "ToggleLeft",
};

export const DIFFICULTY_LABELS: Record<number, string> = {
  0: "未标记",
  1: "容易",
  2: "中等",
  3: "困难",
};

export const DIFFICULTY_COLORS: Record<number, string> = {
  0: "text-[#6b717a]",
  1: "text-[#3ecf8e]",
  2: "text-[#f0c040]",
  3: "text-[#e0556a]",
};

// ── Practice / Mock Exam ──────────────────────────────────────

export interface PracticeConfig {
  questionCount: number;
  types: QuestionType[];
  difficulty: number[];
}

export interface PracticeSession {
  questions: Question[];
  userAnswers: Record<string, string[]>;
  marked: Record<string, boolean>;
  currentIndex: number;
  status: "answering" | "submitted";
  startedAt: number;
  submittedAt?: number;
  config: PracticeConfig;
}

export interface PracticeQuestionResult {
  question: Question;
  userAnswer: string[];
  correctAnswer: string[];
  isCorrect: boolean;
}

export interface PracticeResult {
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  score: number;
  duration: number;
  details: PracticeQuestionResult[];
}
