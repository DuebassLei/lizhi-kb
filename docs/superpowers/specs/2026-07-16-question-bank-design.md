# 题库快速检索功能设计

> **版本**: v1.0.0-draft  
> **日期**: 2026-07-16  
> **状态**: 设计中  
> **作者**: AI Agent  
> **关联**: [主产品 spec](./2026-07-06-lizhi-kb-complete-design.md) | [品牌设计](../../brand/lizhi-brand-design.md)

## 目录

1. [概述](#1-概述)
2. [数据模型](#2-数据模型)
3. [Rust 后端设计](#3-rust-后端设计)
4. [前端架构](#4-前端架构)
5. [UI/UX 设计](#5-uiux-设计)
6. [检索系统](#6-检索系统)
7. [AI 录入](#7-ai-录入)
8. [导出/导入/备份](#8-导出导入备份)
9. [路由与导航](#9-路由与导航)
10. [实现计划](#10-实现计划)

---

## 1. 概述

### 1.1 功能定位

题库快速检索是"狸知知识库"的一个**知识应用模块**，与幕布、每日小记、需求看板平行。提供题目（单选/多选/判断）的录入、检索、浏览、AI 批导及备份导出能力。

### 1.2 核心能力

| 能力 | 优先级 | 说明 |
|------|--------|------|
| 关键词快速检索 | P0 | FTS5 全文索引 + 拼音搜索，毫秒级响应 |
| 题目的增删改查 | P0 | 支持单选、多选、判断三种题型 |
| 题目详情展示 | P0 | 题干、选项、正确答案、解析完整呈现 |
| AI 文档解析录入 | P1 | 粘贴/上传文档 → AI 提取题目结构 → 人工确认后入库 |
| 批量导入/导出 | P1 | JSON 格式，纳入 `.lizhi` 备份体系 |
| 题库分类/标签 | P2 | 按来源、知识点打标，支持标签筛选 |

### 1.3 非目标 (Won't)

- 在线答题/测验/考试功能（纯题库管理，不做练习系统）
- 云端同步（v1.x 本地优先）
- 多人协作
- 题目间关联图谱

---

## 2. 数据模型

### 2.1 SQLite 表结构

```sql
-- 题库主表
CREATE TABLE question_bank (
  id              TEXT PRIMARY KEY NOT NULL,   -- UUID v4
  type            TEXT NOT NULL DEFAULT 'single',  -- single | multi | truefalse
  title           TEXT NOT NULL,               -- 题干 (Markdown)
  options         TEXT NOT NULL DEFAULT '[]',  -- JSON: [{label, text, isHtml?}]
  correct_answer  TEXT NOT NULL,               -- JSON: ["A"] | ["A","C"] | ["true"]
  explanation     TEXT NOT NULL DEFAULT '',    -- 解析 (Markdown)
  tags            TEXT NOT NULL DEFAULT '[]',  -- JSON: ["tag1","tag2"]
  source          TEXT NOT NULL DEFAULT '',    -- 来源文档/URL
  difficulty      INTEGER NOT NULL DEFAULT 0,  -- 0=未标记 1=易 2=中 3=难
  sort_order      INTEGER NOT NULL DEFAULT 0,  -- 手动排序
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FTS5 全文索引 (题干 + 解析 + 标签 + 选项文本)
CREATE VIRTUAL TABLE question_bank_fts USING fts5(
  title,
  explanation,
  tags,
  options_text,          -- 选项文本拼接
  content='question_bank',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- 触发器保持 FTS 同步
CREATE TRIGGER question_bank_ai AFTER INSERT ON question_bank BEGIN
  INSERT INTO question_bank_fts(rowid, title, explanation, tags, options_text)
  VALUES (new.rowid, new.title, new.explanation, new.tags,
    (SELECT group_concat(json_extract(value, '$.text'), ' ') FROM json_each(new.options)));
END;

CREATE TRIGGER question_bank_ad AFTER DELETE ON question_bank BEGIN
  INSERT INTO question_bank_fts(question_bank_fts, rowid, title, explanation, tags, options_text)
  VALUES ('delete', old.rowid, old.title, old.explanation, old.tags,
    (SELECT group_concat(json_extract(value, '$.text'), ' ') FROM json_each(old.options)));
END;

CREATE TRIGGER question_bank_au AFTER UPDATE ON question_bank BEGIN
  INSERT INTO question_bank_fts(question_bank_fts, rowid, title, explanation, tags, options_text)
  VALUES ('delete', old.rowid, old.title, old.explanation, old.tags,
    (SELECT group_concat(json_extract(value, '$.text'), ' ') FROM json_each(old.options)));
  INSERT INTO question_bank_fts(rowid, title, explanation, tags, options_text)
  VALUES (new.rowid, new.title, new.explanation, new.tags,
    (SELECT group_concat(json_extract(value, '$.text'), ' ') FROM json_each(new.options)));
END;

-- 常用索引
CREATE INDEX idx_question_bank_type ON question_bank(type);
CREATE INDEX idx_question_bank_tags ON question_bank(tags);
CREATE INDEX idx_question_bank_created ON question_bank(created_at);
```

### 2.2 TypeScript 类型定义

```typescript
// src/types/questionBank.ts

export type QuestionType = "single" | "multi" | "truefalse";

export interface QuestionOption {
  label: string;   // A / B / C / D / true / false
  text: string;    // 选项内容 (支持 Markdown)
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;           // 题干 (Markdown)
  options: QuestionOption[];
  correctAnswer: string[]; // ["A"] | ["A","C"] | ["true"]
  explanation: string;     // 解析 (Markdown)
  tags: string[];
  source: string;
  difficulty: 0 | 1 | 2 | 3;
  sortOrder: number;
  createdAt: string;       // ISO 8601
  updatedAt: string;
}

export interface QuestionSearchParams {
  keyword?: string;
  type?: QuestionType;
  tags?: string[];
  difficulty?: number;
  page: number;
  pageSize: number;
}

export interface QuestionSearchResult {
  items: Question[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QuestionImportItem {
  type: QuestionType;
  title: string;
  options: QuestionOption[];
  correctAnswer: string[];
  explanation: string;
  tags: string[];
  source: string;
  difficulty: 0 | 1 | 2 | 3;
}

export interface QuestionExportData {
  version: string;          // 导出格式版本
  exportedAt: string;       // ISO 8601
  total: number;
  questions: Question[];
}
```

### 2.3 Rust 结构体

```rust
// src-tauri/src/question_bank.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionOption {
    pub label: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub id: String,
    pub r#type: String,  // "single" | "multi" | "truefalse"
    pub title: String,
    pub options: Vec<QuestionOption>,
    pub correct_answer: Vec<String>,
    pub explanation: String,
    pub tags: Vec<String>,
    pub source: String,
    pub difficulty: u8,
    pub sort_order: u32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionSearchParams {
    pub keyword: Option<String>,
    pub r#type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub difficulty: Option<u8>,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionSearchResult {
    pub items: Vec<Question>,
    pub total: u32,
    pub page: u32,
    pub page_size: u32,
}
```

---

## 3. Rust 后端设计

### 3.1 模块结构

```
src-tauri/src/
└── question_bank/
    ├── mod.rs               # QuestionBankService + 数据库操作
    └── import_parser.rs     # AI 解析结果验证与规范化
```

### 3.2 QuestionBankService

```rust
// src-tauri/src/question_bank/mod.rs

pub struct QuestionBankService {
    conn: Connection,  // 共享 vault.db 连接
}

impl QuestionBankService {
    pub fn new(conn: Connection) -> Self;

    // CRUD
    pub fn add_question(&self, q: NewQuestion) -> Result<Question>;
    pub fn update_question(&self, q: Question) -> Result<Question>;
    pub fn delete_question(&self, id: &str) -> Result<()>;
    pub fn get_question(&self, id: &str) -> Result<Question>;

    // 检索
    pub fn search(&self, params: &QuestionSearchParams) -> Result<QuestionSearchResult>;

    // 批量操作
    pub fn batch_import(&self, items: Vec<NewQuestion>) -> Result<BatchImportResult>;
    pub fn export_all(&self) -> Result<Vec<Question>>;       // 全量导出
    pub fn import_from_json(&self, data: &[u8]) -> Result<ImportResult>;

    // 统计
    pub fn get_stats(&self) -> Result<QuestionBankStats>;
}
```

### 3.3 Tauri Commands

在 `lib.rs` 中注册，在 `commands.rs` 中添加：

```rust
#[tauri::command]
async fn cmd_question_bank_search(state: State<'_, Arc<AppState>>, params: QuestionSearchParams) -> Result<QuestionSearchResult, AppError>;

#[tauri::command]
async fn cmd_question_bank_get(state: State<'_, Arc<AppState>>, id: String) -> Result<Question, AppError>;

#[tauri::command]
async fn cmd_question_bank_add(state: State<'_, Arc<AppState>>, question: NewQuestion) -> Result<Question, AppError>;

#[tauri::command]
async fn cmd_question_bank_update(state: State<'_, Arc<AppState>>, question: Question) -> Result<Question, AppError>;

#[tauri::command]
async fn cmd_question_bank_delete(state: State<'_, Arc<AppState>>, id: String) -> Result<(), AppError>;

#[tauri::command]
async fn cmd_question_bank_batch_import(state: State<'_, Arc<AppState>>, items: Vec<NewQuestion>) -> Result<BatchImportResult, AppError>;

#[tauri::command]
async fn cmd_question_bank_export(state: State<'_, Arc<AppState>>) -> Result<String, AppError>;

#[tauri::command]
async fn cmd_question_bank_import(state: State<'_, Arc<AppState>>, json_data: String, mode: String) -> Result<ImportResult, AppError>;

#[tauri::command]
async fn cmd_question_bank_stats(state: State<'_, Arc<AppState>>) -> Result<QuestionBankStats, AppError>;
```

### 3.4 数据库迁移

在 `db.rs` 的 `MIGRATIONS` 数组中添加题库表迁移，并在 `initialize_database` 中执行列迁移检查。

---

## 4. 前端架构

### 4.1 文件清单

```
src/
├── types/
│   └── questionBank.ts                    # 类型定义
├── stores/
│   └── questionBank.ts                    # Pinia store
├── composables/
│   └── useQuestionBankSearch.ts           # 搜索 debounce + 分页
├── services/
│   └── questionBankService.ts             # Tauri IPC 封装
├── views/
│   └── QuestionBankView.vue               # 主视图
└── components/
    └── questionBank/
        ├── QuestionList.vue               # 题目列表
        ├── QuestionCard.vue               # 题目卡片
        ├── QuestionEditor.vue             # 题目编辑器（新建/编辑）
        ├── QuestionSearchBar.vue          # 搜索栏
        ├── QuestionTypeFilter.vue         # 题型筛选
        ├── QuestionStatsBar.vue           # 统计信息栏
        ├── QuestionImportDialog.vue       # AI 导入对话框
        ├── QuestionExportDialog.vue       # 导出对话框
        └── QuestionEmptyState.vue         # 空状态
```

### 4.2 Pinia Store

```typescript
// src/stores/questionBank.ts

export const useQuestionBankStore = defineStore("questionBank", () => {
  // State
  const questions = ref<Question[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const currentQuestion = ref<Question | null>(null);
  const searchParams = ref<QuestionSearchParams>({
    page: 1,
    pageSize: 20,
  });
  const stats = ref<QuestionBankStats | null>(null);

  // Getters
  const isEmpty = computed(() => total.value === 0 && !loading.value);
  const hasMore = computed(() => questions.value.length < total.value);
  const typeDistribution = computed(() => { /* ... */ });

  // Actions
  async function search(params?: Partial<QuestionSearchParams>);
  async function loadMore();
  async function getQuestion(id: string);
  async function addQuestion(q: NewQuestion);
  async function updateQuestion(q: Question);
  async function deleteQuestion(id: string);
  async function batchImport(items: NewQuestion[]);
  async function exportAll(): Promise<string>;
  async function importFromJson(json: string, mode: "replace" | "merge");
  async function fetchStats();

  return {
    questions, total, loading, currentQuestion, searchParams, stats,
    isEmpty, hasMore, typeDistribution,
    search, loadMore, getQuestion, addQuestion, updateQuestion,
    deleteQuestion, batchImport, exportAll, importFromJson, fetchStats,
  };
});
```

### 4.3 IPC Service

```typescript
// src/services/questionBankService.ts

import { tauriInvoke } from "../composables/useTauriCommand";
import type { Question, QuestionSearchParams, QuestionSearchResult, ... } from "../types/questionBank";

export const questionBankService = {
  search: (params: QuestionSearchParams) =>
    tauriInvoke<QuestionSearchResult>("cmd_question_bank_search", { params }),

  get: (id: string) =>
    tauriInvoke<Question>("cmd_question_bank_get", { id }),

  add: (question: NewQuestion) =>
    tauriInvoke<Question>("cmd_question_bank_add", { question }),

  update: (question: Question) =>
    tauriInvoke<Question>("cmd_question_bank_update", { question }),

  delete: (id: string) =>
    tauriInvoke<void>("cmd_question_bank_delete", { id }),

  batchImport: (items: NewQuestion[]) =>
    tauriInvoke<BatchImportResult>("cmd_question_bank_batch_import", { items }),

  exportAll: () =>
    tauriInvoke<string>("cmd_question_bank_export"),

  importFromJson: (jsonData: string, mode: "replace" | "merge") =>
    tauriInvoke<ImportResult>("cmd_question_bank_import", { jsonData, mode }),

  stats: () =>
    tauriInvoke<QuestionBankStats>("cmd_question_bank_stats"),
};
```

---

## 5. UI/UX 设计

### 5.1 设计方向

遵循品牌设计系统的**暗色工程终端**风格。题目卡片采用**半透明边框层级**代替阴影，联结蓝 `#5b9fd4` 作为交互主色，暖爪 `#d4a574` 用于高亮正确选项和重要标记（每界面 ≤3 处）。

**关键视觉决策**：
- 搜索框使用**命令面板风格**：大号居中搜索栏，带键盘快捷键提示 (Ctrl+K)
- 题目卡片左侧**彩色竖线**区分题型（蓝=single, 橙=multi, 绿=truefalse）
- 正确选项使用暖爪色文字高亮，错误选项保持默认灰色
- 列表支持**虚拟滚动** (大量题目时)
- 导入对话框采用**拖拽区域 + 粘贴框**

### 5.2 主视图布局

```
┌──────────────────────────────────────────────────────────────┐
│ [侧栏] │ 题库                                          [+ 新建]│
│        │ ┌──────────────────────────────────────────────────┐│
│ 筛选   │ │  🔍 搜索题目...                        Ctrl+K    ││
│ ─────  │ ├──────────────────────────────────────────────────┤│
│ 全部   │ │  全部 │ 单选 23 │ 多选 12 │ 判断 8  │  标签筛选  ││
│ 单选   │ ├──────────────────────────────────────────────────┤│
│ 多选   │ │                                                  ││
│ 判断   │ │  ┌────────────────────────────────────────────┐  ││
│        │ │  │ [单选] 什么是微积分基本定理？              │  ││
│ 标签   │ │  │ A. 导数与积分互为逆运算                    │  ││
│  ────  │ │  │ B. 极限存在则函数连续  ✅ A  ──────────── │  ││
│ tag1   │ │  │ 解析：牛顿-莱布尼茨公式...  [编辑] [删除] │  ││
│ tag2   │ │  └────────────────────────────────────────────┘  ││
│        │ │                                                  ││
│        │ │  ┌────────────────────────────────────────────┐  ││
│        │ │  │ [判断] TCP 是面向连接的协议                │  ││
│        │ │  │ 答案：正确 ✅  ─────────────────────────── │  ││
│        │ │  │ 解析：TCP 通过三次握手... [编辑] [删除]    │  ││
│        │ │  └────────────────────────────────────────────┘  ││
│        │ │                                                  ││
│        │ │              第 1/3 页  ←  →                     ││
│        │ └──────────────────────────────────────────────────┘│
│        │                                         共 43 题    │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 题目卡片详细设计

```
┌──┬──────────────────────────────────────────────────────┐
│  │  [单选] #数学 #微积分             来源: 高数笔记.md  │
│蓝│                                                     │
│竖│  设函数 f(x) 在 [a,b] 上连续，F(x) = ∫[a,x] f(t)dt │
│线│  则 F'(x) = _____                                  │
│  │                                                     │
│  │  ○ A. f(x) - f(a)                                  │
│  │  ● B. f(x)         ◄── 暖爪色高亮正确选项          │
│  │  ○ C. f'(x)                                        │
│  │  ○ D. 0                                            │
│  │                                                     │
│  │  ───────────────────────────────────────────────    │
│  │  📝 解析                                           │
│  │  根据微积分基本定理（牛顿-莱布尼茨公式），          │
│  │  若 F(x) = ∫[a,x] f(t)dt，则 F'(x) = f(x)。       │
│  │                                                     │
│  │  [编辑] [删除]                    2026-07-15        │
└──┴──────────────────────────────────────────────────────┘
```

### 5.4 题型色条映射

| 题型 | 色条颜色 | 图标 | 标签文字 |
|------|----------|------|----------|
| 单选 (single) | `#5b9fd4` (联结蓝) | `CircleDot` | 单选 |
| 多选 (multi) | `#f0c040` (警告黄) | `CheckSquare` | 多选 |
| 判断 (truefalse) | `#3ecf8e` (成功绿) | `ToggleLeft` | 判断 |

### 5.5 Tailwind 关键 class

使用品牌设计系统的 CSS 变量 + Tailwind 原子类：

- 卡片背景：`bg-[#1a1d23]` (面板色)
- 卡片边框：`border border-white/6` (半透明白色)
- 卡片 hover：`hover:border-white/10` (微提亮)
- 正确选项：`text-[#d4a574]` (暖爪色)
- 错误/普通选项：`text-[#b0b5bd]` (次要文字)
- 搜索框聚焦：`ring-1 ring-[#5b9fd4]/30` (联结蓝光环)
- 新建按钮：`bg-[#5b9fd4] text-[#141619]` (反色按钮)

---

## 6. 检索系统

### 6.1 检索策略

| 层级 | 技术 | 适用场景 |
|------|------|----------|
| SQLite FTS5 | 全文索引 + `unicode61` 分词 | 题干/解析/标签关键词搜索 |
| 内存过滤 | 前端 computed 过滤 | 题型/难度/标签等结构化筛选 |
| 拼音搜索 | 前端 `pinyin-pro` | 中文拼音首字母匹配（已有依赖） |

### 6.2 FTS5 全文搜索 SQL

```sql
-- 基础搜索
SELECT q.* FROM question_bank q
INNER JOIN question_bank_fts fts ON q.rowid = fts.rowid
WHERE question_bank_fts MATCH ?
ORDER BY rank
LIMIT ? OFFSET ?;

-- 组合筛选搜索 (模板)
SELECT q.*, COUNT(*) OVER() as total
FROM question_bank q
INNER JOIN question_bank_fts fts ON q.rowid = fts.rowid
WHERE question_bank_fts MATCH ?
  AND (? IS NULL OR q.type = ?)
  AND (? IS NULL OR q.difficulty = ?)
ORDER BY rank
LIMIT ? OFFSET ?;
```

### 6.3 前端搜索 Composable

```typescript
// src/composables/useQuestionBankSearch.ts
export function useQuestionBankSearch() {
  const store = useQuestionBankStore();
  const searchKeyword = ref("");
  const debouncedKeyword = refDebounced(searchKeyword, 300);

  watch(debouncedKeyword, (kw) => {
    store.search({ keyword: kw || undefined, page: 1 });
  });

  watch(() => store.searchParams.type, () => {
    store.search({ page: 1 });
  });

  function clearSearch() {
    searchKeyword.value = "";
    store.search({ keyword: undefined, page: 1 });
  }

  return { searchKeyword, debouncedKeyword, clearSearch };
}
```

### 6.4 拼音匹配增强

利用项目已有的 `pinyin-pro` 依赖，在前端进行本地拼音匹配作为 FTS5 的补充：

```typescript
import { pinyin } from "pinyin-pro";

function matchPinyin(query: string, text: string): boolean {
  const full = pinyin(text, { toneType: "none", type: "array" }).join("");
  const firstLetters = pinyin(text, { pattern: "first", toneType: "none", type: "array" }).join("");
  const lowerQuery = query.toLowerCase();
  return full.includes(lowerQuery) || firstLetters.includes(lowerQuery);
}
```

### 6.5 性能目标

| 指标 | 目标 |
|------|------|
| 关键词搜索响应 | <100ms (1000 题规模) |
| 分页加载 | <50ms/页 |
| 前端筛选切换 | <16ms (一帧) |
| 虚拟滚动 | 10000 题流畅滚动 |

---

## 7. AI 录入

### 7.1 流程

```
用户粘贴/上传文档
      │
      ▼
前端: 文本预处理（分块、去噪）
      │
      ▼
调用 AI (LLM) 解析题目结构
  Prompt: "从以下文本中提取题目，返回 JSON 数组
          [{type, title, options, correctAnswer, explanation, tags}]"
      │
      ▼
前端: 展示解析结果预览列表
  每条可编辑、删除、调整
      │
      ▼
用户确认 → 调用 batch_import API 入库
```

### 7.2 AI Prompt 设计

```
你是一个题目解析器。请从以下文本中提取所有题目，返回严格符合格式的 JSON 数组。

每条题目格式：
{
  "type": "single" | "multi" | "truefalse",
  "title": "题干文本",
  "options": [{"label": "A", "text": "选项内容"}, ...],
  "correctAnswer": ["A"],
  "explanation": "题目解析",
  "tags": ["标签1", "标签2"],
  "difficulty": 0 | 1 | 2 | 3
}

规则：
- 单选 type="single"，多选 type="multi"，判断 type="truefalse"
- 判断题为 options: [{"label":"true","text":"正确"},{"label":"false","text":"错误"}]
- correctAnswer 始终为字符串数组
- 如无解析，explanation 为空字符串
- 自动根据内容推断标签

文本内容：
---
{用户输入的文本}
---
```

### 7.3 导入预览 UI

复用品牌设计风格，预览列表使用卡片组，每张卡片可展开编辑。顶部显示统计（提取 X 题，Y 题需修复），底部 [全部导入] [取消] 按钮。

---

## 8. 导出/导入/备份

### 8.1 导出格式

```json
{
  "version": "1.0.0",
  "exportedAt": "2026-07-16T10:30:00Z",
  "total": 43,
  "questions": [
    {
      "id": "uuid-v4",
      "type": "single",
      "title": "什么是微积分基本定理？",
      "options": [
        {"label": "A", "text": "导数与积分互为逆运算"},
        {"label": "B", "text": "极限存在则函数连续"}
      ],
      "correctAnswer": ["A"],
      "explanation": "牛顿-莱布尼茨公式表明...",
      "tags": ["数学", "微积分"],
      "source": "高数笔记.md",
      "difficulty": 2,
      "sortOrder": 0,
      "createdAt": "2026-07-15T08:00:00Z",
      "updatedAt": "2026-07-15T08:00:00Z"
    }
  ]
}
```

### 8.2 导出/导入模式

| 模式 | 行为 |
|------|------|
| `replace` | 清空现有题库，全部替换为导入数据 |
| `merge` | 保留现有，按 id 去重合并（id 相同的更新，新的添加） |

### 8.3 与现有备份体系集成

题库数据纳入 `.lizhi` 备份体系（`~/.lizhi-kb/backups/`），在整体 vault 导出时，`question_bank` 表数据作为可选模块包含在内。

- 备份清单中新增：`question_bank` 模块
- 恢复模式对齐现有三态：`replace` | `merge` | `merge-documents` — 题库属于 `merge-documents` 的数据范围
- 导出对话框 UI：在备份设置中增加「题库」勾选项

---

## 9. 路由与导航

### 9.1 路由注册

```typescript
// src/router/index.ts
{
  path: "/question-bank",
  name: "question-bank",
  component: () => import("../views/QuestionBankView.vue"),
  meta: {
    title: "题库",
    requiresUnlock: true,
    layer: "app",
  },
}
```

### 9.2 侧栏导航

在 AppShell 侧栏底部（幕布/需求看板/Agent 工作台同级），添加"题库"入口：

| 图标 | 文字 | 路由 |
|------|------|------|
| `Library` (Lucide) | 题库 | `/question-bank` |

侧栏导航项结构对齐现有 `navItems` 配置模式，使用 `useRouter` 判断 `route.name === "question-bank"` 高亮。

---

## 10. 实现计划

### 10.1 分阶段实施

| 阶段 | 内容 | 预估 |
|------|------|------|
| **Phase 1: 核心骨架** | 类型定义 + DB 迁移 + Rust Service + 基础 CRUD commands | Rust 后端 |
| **Phase 2: 列表检索** | Pinia store + 服务层 + 搜索栏 + 题目列表 + 虚拟滚动 | 前端核心 |
| **Phase 3: 题目编辑** | 新建/编辑对话框 + 题型切换 + 选项管理 + 标签输入 | 前端交互 |
| **Phase 4: 详情展示** | 题目卡片展开/详情页 + 正确选项高亮 + 解析展示 | 前端展示 |
| **Phase 5: 导出导入** | JSON 导出/导入 + 备份集成 + 替换/合并模式 | 全栈 |
| **Phase 6: AI 录入** | AI 解析对话框 + 预览编辑 + 批次确认入库 | 全栈 |
| **Phase 7: 打磨** | 拼音搜索 + 动画过渡 + 键盘快捷键 + 响应式适配 | 前端 |

### 10.2 路由入口

按路由 IA 约定，题型检索作为独立侧栏入口（`/question-bank`），不嵌套在现有 workspace 下。

### 10.3 数据库迁移兼容

- 题库表为**新增独立表**，不影响现有 documents/requirements 等表
- 加密 vault 自动使用 SQLCipher 连接（与现有 `vault.db` 共用连接）
- 明文模式使用 `lizhi-kb.db`

---

## 附录 A: 参考资源

- [狸知品牌设计](../../brand/lizhi-brand-design.md) — 色板、字体、组件规范
- [DESIGN.md](../../../DESIGN.md) — AI Agent 消费用设计令牌
- [主产品 spec](./2026-07-06-lizhi-kb-complete-design.md) — 路由 IA、架构约定
- [备份设计](../../design/2026-07-08-backup-extension.md) — `.lizhi` 备份格式
- [AGENTS.md](../../../AGENTS.md) — 编码原则、目录约定
