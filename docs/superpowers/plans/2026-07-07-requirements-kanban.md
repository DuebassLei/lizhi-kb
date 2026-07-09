# 计划 · 需求看板

**日期**: 2026-07-07  
**类型**: feature（v1.x 扩展，spec 未预定义）  
**Spec 引用**: `docs/superpowers/specs/2026-07-06-lizhi-kb-complete-design.md`（顶层 IA 扩展）  
**模板**: `docs/agent-workflow/templates/feature.md` + `ui.md`  
**状态**: 用户已确认 → 切片 1+2 已实现（localStorage MVP）→ **切片 3 SQLite 已实现** → **v1.1 字段增强已实现**

---

## 用户决策（2026-07-07 确认）

| 项 | 决策 |
|----|------|
| **入口** | **独立顶层菜单**，与「看板 / 工作区 / 设置」同级，文案 **「需求看板」** |
| **路由** | **`/requirements`**，与 `/insights`（写作看板）区分 |
| **不做** | 不在工作区 Toolbar 加第三 Tab；不云同步 |
| **列** | 四列：待办 / 进行中 / 挂起 / 完成 |
| **字段** | 需求单号、需求内容、状态、优先级（可选）、提出时间、预计/实际上线、创建/更新时间、截止时间（可选） |

---

## 背景与调研摘要

### 现有「看板」≠ 需求看板

| 概念 | 路由/入口 | 实现 | 用途 |
|------|-----------|------|------|
| **写作看板** | `/insights`，AppShell「看板」 | `InsightsView.vue` + `components/insights/*` | 写作热力图、概览、链接统计 |
| **需求看板（新）** | `/requirements`，AppShell「需求看板」 | `RequirementsView.vue` + `components/requirements/*` | 需求 Kanban + CRUD |
| **工作区** | `/workspace`，AppShell「工作区」 | `WorkspaceView.vue` | 文档编辑、局部图谱 |

命名：主导航「看板」保留指 Insights；新功能 UI 统一 **「需求看板」**。

### 数据层

| 阶段 | 存储 | 说明 |
|------|------|------|
| **MVP（已完成）** | `localStorage` `lizhi-kb-requirements` | 浏览器 dev fallback |
| **当前** | SQLite `requirements` 表 + Tauri commands | 与 documents 同库，vault 解锁后访问 |

---

## 功能范围

### MVP + v1.1 增强（已实现）

| 能力 | 说明 |
|------|------|
| 四列 Kanban | 待办 / 进行中 / 挂起 / 完成 |
| 需求 CRUD | 创建、编辑、删除 |
| 改状态 | 拖拽跨列 或 详情面板下拉 |
| 字段 | `number`、`content`、`status`、`priority?`、`proposedAt?`、`expectedLaunchAt?`、`actualLaunchAt?`、`createdAt`、`updatedAt`、`dueAt?` |
| 详情抽屉 | 单号只读、内容编辑、状态/优先级/时间字段 |
| 需求清单 | 看板下方表格，可排序/筛选状态 |
| 入口 | AppShell 顶层「需求看板」→ `/requirements` |
| 持久化 | SQLite（Tauri）；`pnpm dev` 仍可用 localStorage fallback |
| 中文 UI | 暗色 paw 主题、空/加载/错误态、toast |

### v1.2 增强（非 MVP）

- 关联文档、从需求创建文档到收件箱
- 列自定义、标签
- 命令面板跳转
- Playwright E2E
- 备份/恢复含 requirements 表

### 明确不做

- 工作区 Toolbar 第三 Tab
- 云同步、协作、评论
- 替换 `/insights` 写作看板

---

## UI 方案

### IA：AppShell 顶层导航

```
AppShell 主导航：看板 | 需求看板 | 工作区 | 设置
                      ↓
              /requirements
              RequirementsView
              └── RequirementsKanbanView（四列 Kanban + 清单 + 详情抽屉）
```

### 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│ 需求看板                              [+ 新建需求]           │
├─────────────────────────────────────────────────────────────┤
│  Kanban 主区（横向滚动四列）                                 │
│  ┌────────┬────────┬────────┬────────┐                        │
│  │待办(n) │进行中  │ 挂起   │ 完成   │                        │
│  │[卡片…] │[卡片…] │[卡片…] │[卡片…] │                        │
│  └────────┴────────┴────────┴────────┘                        │
├─────────────────────────────────────────────────────────────┤
│  需求清单（表格：单号/摘要/提出/预计/实际上线/状态/优先级）   │
│                                    ┌──────────────────┐     │
│                                    │ 需求详情抽屉      │     │
│                                    └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 数据模型

### TypeScript（`src/types/requirement.ts`）

```ts
export type RequirementStatus = "todo" | "in_progress" | "suspended" | "done";
export type RequirementPriority = "low" | "medium" | "high";

export interface Requirement {
  id: string;
  number: string;       // REQ-YYYYMMDD-001
  content: string;      // 首行作标题摘要
  status: RequirementStatus;
  priority?: RequirementPriority;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  dueAt?: number;
  proposedAt?: number;         // 提出时间
  expectedLaunchAt?: number;   // 预计上线
  actualLaunchAt?: number;     // 实际上线
}
```

### SQLite（已实现）

```sql
CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY NOT NULL,
  number TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  due_at INTEGER,
  proposed_at INTEGER,
  expected_launch_at INTEGER,
  actual_launch_at INTEGER
);
```

> 旧库通过 `ALTER TABLE ADD COLUMN` 迁移，新字段 nullable。

---

## 垂直切片

### 切片 1 · UI 壳 ✅

- AppShell 导航 + `/requirements` 路由
- Kanban 三列 + 卡片 + 详情抽屉
- 空/加载/错误态

### 切片 2 · 持久化（localStorage MVP）✅

- `requirementService.ts` + `requirements` store
- 拖拽改状态
- 重启后数据仍在（同浏览器 localStorage）

### 切片 3 · SQLite + Tauri ✅

- `requirements` 表 migration + `requirements.rs`
- Tauri commands：`list/create/update/delete/reorder_requirements`
- `requirementService.ts` invoke + localStorage 一次性迁移
- Rust 单元测试

### 切片 4 · 字段增强 + 清单列表 ✅

- 提出/预计/实际上线时间字段 + `suspended` 挂起状态
- 四列 Kanban + `RequirementsList.vue`
- SQLite `ALTER TABLE` 列迁移（nullable）
- 详情抽屉 datetime-local 编辑

### 切片 5 · 质量（待做）

- 关联文档、E2E、Reviewer

---

## 涉及文件

### 新建

| 路径 | 职责 |
|------|------|
| `src/types/requirement.ts` | 类型与标签 |
| `src/stores/requirements.ts` | Pinia |
| `src/services/requirementService.ts` | Tauri IPC + localStorage fallback / 迁移 |
| `src/views/RequirementsView.vue` | 页面壳 |
| `src/components/requirements/RequirementsKanbanView.vue` | 主视图 |
| `src/components/requirements/KanbanColumn.vue` | 单列 |
| `src/components/requirements/RequirementCard.vue` | 卡片 |
| `src/components/requirements/RequirementsList.vue` | 看板下方清单表格 |

### 修改

| 路径 | 变更 |
|------|------|
| `src/components/layout/AppShell.vue` | 新增「需求看板」导航 |
| `src-tauri/src/requirements.rs` | SQLite CRUD + 新字段 |
| `src-tauri/src/db.rs` | `requirements` 表 + 列迁移 |
| `src/components/requirements/RequirementDetailDrawer.vue` | 详情/编辑（含时间字段） |
| `src/router/index.ts` | 新增 `/requirements` |

---

## 验收标准

- [x] **AC-1**：AppShell 可见「需求看板」，路由 `/requirements` 可访问
- [x] **AC-2**：四列 Kanban；创建、编辑、删除
- [x] **AC-3**：拖拽或详情改状态（待办/进行中/挂起/完成）
- [x] **AC-4**：详情含单号、内容、优先级、提出/上线时间字段
- [x] **AC-5**：空/加载/错误态；焦点可见；Escape 关抽屉
- [x] **AC-6**：`pnpm dev` 浏览器 fallback；Tauri 下 SQLite 持久化
- [x] **AC-7**：看板下方需求清单（排序/筛选）
- [ ] **AC-8**：E2E（后续）

---

## HANDOFF · Implementer → Reviewer

**变更摘要**：需求看板 v1.1 增强——新增提出/预计/实际上线时间、`suspended` 挂起状态、四列 Kanban、看板下方需求清单表格；SQLite 列迁移兼容旧数据。

**验证**：

```bash
pnpm build
cd src-tauri && cargo check
cargo test -p lizhi-kb requirements::
```

手动：解锁 → 需求看板 → 新建 → 编辑时间字段 → 拖至挂起列 → 清单筛选/排序 → 刷新确认数据仍在。
