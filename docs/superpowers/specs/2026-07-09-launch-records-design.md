# 上线记录管理 · 产品设计 Spec

**文档版本**：v1.1.2  
**日期**：2026-07-09  
**状态**：无 recordType 双轨；需求关联可选；**关联需求通过选择器选取，禁止手填 ID**  
**关联**：`docs/superpowers/plans/2026-07-07-requirements-kanban.md`（需求看板，可关联）

---

## 0. 决策摘要

| 项 | 决策 |
|----|------|
| **方案** | 独立模块（方案 B），非需求看板派生视图 |
| **记录模型** | **统一单轨**：产品发版、客户交付等均用同一条 `LaunchRecord`，靠标题/版本/客户/标签区分，不设 `recordType` |
| **入口** | AppShell 侧栏「上线记录」，路由 `/launches` |
| **存储** | SQLite `launch_records` 表 + Tauri commands；`pnpm dev` localStorage fallback |
| **需求关联** | **可选**；通过**需求选择器**从已有需求中多选，**不可手填单号/ID** |
| **不做** | recordType 双轨、云同步、审批流、Git/CI 自动同步、PDF（v1.2 可选） |

### 与需求看板的分工

| 模块 | 关注点 | 视图 |
|------|--------|------|
| 需求看板 | 需求从提出到完成的**工作流** | Kanban |
| 上线记录 | 发布/交付事件的**历史审计** | 时间线 + 表格 |

---

## 1. 领域说明

一条上线记录可描述任意上线场景，例如：

- 产品版本发布（v1.5.2）
- 客户系统交付上线
- 热修复、基础设施变更

**不强制分类字段**。可选填 `version`、`clientName`、`projectName`；需要分类时用 `tags`（如 `发版`、`交付`、`热修复`）。

**不强制关联需求**。上线记录可独立存在；需要追溯时在 UI 中通过选择器勾选需求（存为 `linkedRequirementIds`）。从需求看板「创建上线记录」为便捷入口，非必经流程。

---

## 2. 数据模型

### 2.1 TypeScript

```typescript
export type LaunchEnvironment = "production" | "staging" | "preview" | "other";
export type LaunchStatus =
  | "planned"
  | "in_progress"
  | "live"
  | "rolled_back"
  | "cancelled";
export type VerificationStatus = "pending" | "passed" | "failed";
export type LaunchRiskLevel = "low" | "medium" | "high";

export interface LaunchRecord {
  id: string;
  /** 记录单号 REL-YYYYMMDD-NNN */
  recordNumber: string;

  title: string;
  version?: string;
  environment: LaunchEnvironment;
  status: LaunchStatus;
  riskLevel?: LaunchRiskLevel;

  /** 可选：客户/项目上下文（产品发版可留空） */
  clientName?: string;
  projectName?: string;

  scheduledAt?: number;
  launchedAt?: number;
  rolledBackAt?: number;

  operator?: string;
  owner?: string;
  approver?: string;

  changeSummary?: string;
  releaseNotes?: string;
  rollbackReason?: string;

  verificationStatus?: VerificationStatus;
  verificationNotes?: string;

  /** 可选：关联需求单（0..n，可不填） */
  linkedRequirementIds?: string[];
  /** 可选：关联工作区文档 */
  linkedDocumentIds?: string[];
  tags?: string[];

  createdAt: number;
  updatedAt: number;
}
```

### 2.2 SQLite

```sql
CREATE TABLE IF NOT EXISTS launch_records (
  id TEXT PRIMARY KEY NOT NULL,
  record_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  version TEXT,
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL DEFAULT 'planned',
  risk_level TEXT,
  client_name TEXT,
  project_name TEXT,
  scheduled_at INTEGER,
  launched_at INTEGER,
  rolled_back_at INTEGER,
  operator TEXT,
  owner TEXT,
  approver TEXT,
  change_summary TEXT,
  release_notes TEXT,
  rollback_reason TEXT,
  verification_status TEXT,
  verification_notes TEXT,
  linked_requirement_ids TEXT,
  linked_document_ids TEXT,
  tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_launch_records_launched_at ON launch_records(launched_at DESC);
CREATE INDEX idx_launch_records_status ON launch_records(status);
CREATE INDEX idx_launch_records_client ON launch_records(client_name);
```

### 2.3 单号规则

- 格式：`REL-YYYYMMDD-NNN`
- 同日递增序号

---

## 3. 信息架构

```
AppShell 侧栏
├── 看板 (/insights)
├── 工作区 (/workspace)
├── 每日小记 (/journal)
├── 密码本 (/credentials)
├── 需求看板 (/requirements)
├── 上线记录 (/launches)  ← 新增
├── AI 助手 (/ai)
└── 设置 (/settings)
```

- `src/constants/quickNav.ts` 新增 `launches`
- 设置 → 快速导航可隐藏「上线记录」
- vault 解锁后方可读写（与 requirements 一致）

---

## 4. UI/UX

### 4.1 页面结构

```
┌──────────────────────────────────────────────────────────────────┐
│ 上线记录                                                          │
│ 共 N 条 · 本月上线 X 次                                           │
│  [时间线|表格] [筛选▾] [导出▾] [+ 新建上线记录]                    │
├──────────────────────────────────────────────────────────────────┤
│ 状态统计条：计划中 | 上线中 | 已上线 | 已回滚 | 已取消              │
├──────────────────────────────────────────────────────────────────┤
│  🔍 搜索标题/版本/单号/客户名/操作人/标签…                          │
├──────────────────────────────────────────────────────────────────┤
│  ── 2026 年 7 月 ──                                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ REL-20260708-001  v1.5.2 需求看板增强                       │  │
│  │ [已上线][生产][低]  2026-07-08 14:30 · 张三                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ REL-20260710-002  XX银行核心模块上线                          │  │
│  │ [计划中][生产][中]  客户：XX银行 · 预计 07-10 · 李四         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 新建流程

1. 点击「新建上线记录」→ 直接打开详情抽屉
2. 默认状态「计划中」、环境「生产」
3. 所有字段同一表单，无类型切换；`clientName` / `version` 均为可选

### 4.3 筛选器

- 状态（多选）
- 环境（多选）
- 时间范围：本月 / 近 3 月 / 自定义
- 风险等级
- 客户名称（有值时筛选）
- 标签（多选）
- 仅含回滚

### 4.4 详情抽屉分区

```
┌─ 基本信息 ─────────────────────┐
│ 单号（只读）  标题*             │
│ 版本号        环境*             │
│ 状态*         风险等级          │
├─ 客户/项目（均可选）───────────┤
│ 客户名称      项目名称          │
├─ 时间 ─────────────────────────┤
│ 计划上线      实际上线          │
│ 回滚时间（status=rolled_back）  │
├─ 人员 ─────────────────────────┤
│ 负责人        操作人    审批人  │
├─ 内容 ─────────────────────────┤
│ 变更摘要                        │
│ 发布说明（Markdown）            │
│ 回滚原因                        │
├─ 验证 ─────────────────────────┤
│ 验证状态    验证备注            │
├─ 关联（均可选）────────────────┤
│ 关联需求 → 见 §4.8 需求选择器    │
│ 关联文档（可留空）              │
│ 标签                            │
└────────────────────────────────┘
```

### 4.5 状态与主题色

| 状态 | 中文 | Token |
|------|------|-------|
| planned | 计划中 | link |
| in_progress | 上线中 | paw |
| live | 已上线 | secure |
| rolled_back | 已回滚 | danger |
| cancelled | 已取消 | muted |

### 4.6 页头统计

- `共 N 条`（当前筛选或全部）
- `本月上线 X 次`（`status=live` 且 `launchedAt` 在本月）

### 4.7 交互

- 改状态为「已上线」且 `launchedAt` 为空 → 自动填当前时间
- 改状态为「已回滚」→ 显示回滚原因；`rolledBackAt` 自动填
- 删除需 confirm
- Escape 关抽屉；Cmd/Ctrl+S 保存
- 空/加载/错误态与需求看板一致

### 4.8 需求选择器（RequirementLinkPicker）

**禁止**文本框手填需求单号或 ID。关联需求仅能通过选择器完成。

#### 布局（嵌入详情抽屉「关联」区）

```
关联需求
┌─────────────────────────────────────────┐
│ 🔍 搜索单号或标题…                        │
├─────────────────────────────────────────┤
│ ☑ REQ-20260701-003  需求看板字段增强     │
│ ☐ REQ-20260705-001  备份扩展              │
│ ☐ REQ-20260708-002  …                   │
└─────────────────────────────────────────┘
已选：
  [REQ-20260701-003 ×]  [REQ-20260702-001 ×]
```

#### 行为

| 项 | 说明 |
|----|------|
| 数据源 | 当前 vault 内 `requirements` 全量（或 store 已加载列表） |
| 搜索 | 复用 `matchesRequirementKeyword`：单号、标题、正文等 |
| 多选 | 勾选/取消；已选项以 **chip** 展示，chip 上 × 移除 |
| 展示 | 列表行：`单号` + `标题`（`getRequirementDisplayTitle`） |
| 空库 | 提示「暂无需求，请先在需求看板创建」；不阻塞保存上线记录 |
| 键盘 | 列表项可 Tab 聚焦；Enter 切换选中；chip × 可键盘操作 |
| 存储 | UI 只操作 ID；持久化仍为 `linkedRequirementIds: string[]` |

#### 从需求创建

需求详情「创建上线记录」→ 打开抽屉时选择器**预勾选**当前需求，用户可增删其他项。

#### CSV 导入（例外）

导入文件「关联需求」列可填**需求单号**（逗号分隔），后台解析为 ID；**编辑 UI 仍仅允许选择器**，导入后展示为已选 chip。

---

## 5. CRUD

| 操作 | 入口 |
|------|------|
| Create | 页头「新建上线记录」→ 抽屉 |
| Read | 时间线 / 表格 / 详情抽屉 |
| Update | 抽屉编辑、卡片状态快捷改 |
| Delete | 抽屉底部，confirm |

表格视图支持多选 → 批量导出（v1）；批量改状态（v1.1 可选）。

---

## 6. 导出与下载

### 6.1 格式

| 格式 | 用途 |
|------|------|
| CSV | Excel 分析、全字段 |
| Markdown | 月度报告、归档到工作区 |
| JSON | 备份迁移（v1.1 可选） |

### 6.2 CSV 列

```
记录单号, 标题, 版本, 环境, 状态, 风险等级,
客户名称, 项目名称,
计划上线, 实际上线, 回滚时间,
负责人, 操作人, 审批人,
变更摘要, 发布说明, 回滚原因,
验证状态, 验证备注,
关联需求, 关联文档, 标签,
创建时间, 更新时间
```

- UTF-8 BOM
- Tauri：`save` + `write_export_file`
- 浏览器：`downloadTextFile`

### 6.3 导出菜单

```
导出 ▾
├── 导出当前筛选 (CSV)
├── 导出当前筛选 (Markdown)
├── 导出全部 (CSV)
└── 下载导入模板 (CSV)
```

### 6.4 Markdown 报告

- 统一列表 + 概览（总上线次数、回滚次数）

### 6.5 CSV 导入

- 单号冲突：跳过 / 覆盖
- 仅 `title` 必填；其余可选

---

## 7. 模块关联（均可选）

```mermaid
flowchart LR
  REQ[需求看板 Requirement]
  LR[上线记录 LaunchRecord]
  DOC[工作区 Document]

  REQ -.->|可选：从需求创建| LR
  LR -.->|可选：linkedRequirementIds| REQ
  LR -.->|可选：linkedDocumentIds| DOC
```

- **独立使用**：不上线记录页可直接新建，无需关联任何需求或文档
- **便捷入口（可选）**：需求详情「创建上线记录」→ 预填 title、scheduledAt，选择器预勾选当前需求
- **有值才展示**：详情中仅当已选需求非空时显示需求卡片；点击跳转 `/requirements` 并打开对应抽屉
- `.lizhi` v2 备份纳入 `launch_records` 表

---

## 8. 技术实现

### 8.1 文件清单

| 路径 | 职责 |
|------|------|
| `src/types/launchRecord.ts` | 类型、标签、主题 |
| `src/stores/launchRecords.ts` | Pinia |
| `src/services/launchRecordService.ts` | IPC + localStorage |
| `src/views/LaunchesView.vue` | 页面壳 |
| `src/components/launches/LaunchesMainView.vue` | 主视图 |
| `src/components/launches/LaunchTimeline.vue` | 时间线 |
| `src/components/launches/LaunchesTable.vue` | 表格 |
| `src/components/launches/LaunchRecordCard.vue` | 卡片 |
| `src/components/launches/LaunchRecordDrawer.vue` | 详情 |
| `src/components/launches/RequirementLinkPicker.vue` | 需求多选（搜索 + chip，禁手填） |
| `src/utils/exportLaunchRecords.ts` | 导出 |
| `src/utils/importLaunchRecords.ts` | 导入 |
| `src-tauri/src/launch_records.rs` | Rust CRUD |
| `src-tauri/src/db.rs` | migration |

### 8.2 Tauri Commands

- `list_launch_records`
- `create_launch_record`
- `update_launch_record`
- `delete_launch_record`

### 8.3 垂直切片

| 切片 | 内容 |
|------|------|
| S1 | 路由 + quickNav + 空壳 UI |
| S2 | CRUD + localStorage |
| S3 | SQLite + Tauri |
| S4 | 时间线 + 表格 + 筛选 |
| S5 | CSV/MD 导出 + CSV 导入 |
| S6 | RequirementLinkPicker + 从需求创建（便捷入口） |
| S7 | E2E + Reviewer + 备份 |

---

## 9. 验收标准

- [ ] **AC-1**：侧栏「上线记录」，`/launches` 可访问
- [ ] **AC-2**：创建/编辑/删除；统一表单，无 recordType
- [ ] **AC-3**：可选填 version、clientName、projectName、tags
- [ ] **AC-4**：时间线按月分组；表格可排序
- [ ] **AC-5**：按状态、环境、时间、客户、标签筛选
- [ ] **AC-6**：导出 CSV/Markdown；CSV 导入
- [ ] **AC-7**：Tauri SQLite；dev localStorage fallback
- [ ] **AC-8**：空/加载/错误；键盘与焦点
- [ ] **AC-9**：vault 未解锁不可读写
- [ ] **AC-10**：不关联需求可正常 CRUD；关联需求仅能通过选择器选取，不可手填
- [ ] **AC-11**：选择器支持搜索、多选、chip 移除；从需求创建时预勾选当前需求

---

## 10. 明确不做（v1）

- recordType / 产品·客户双轨 UI
- 云同步、协作、评论
- 审批工作流（仅字段）
- Git/CI webhook
- PDF 导出
- 日历视图

---

## 11. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.1.2 | 2026-07-09 | 关联需求改为选择器多选，禁止手填 ID/单号 |
| v1.1.1 | 2026-07-09 | 明确需求/文档关联均为可选 |
| v1.1.0 | 2026-07-09 | 移除 recordType 双轨，统一单一记录模型 |
| v1.0.1 | 2026-07-09 | 页头统计去掉产品/客户分别计数 |
| v1.0.0 | 2026-07-09 | 初稿 |
