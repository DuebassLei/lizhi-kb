# 狸知知识库 · 文档回收站设计

**文档版本**：v1.0.0  
**日期**：2026-07-14  
**状态**：已批准，待实现  
**关联**：当前硬删除见 `delete_document`；产品 IA 见 [2026-07-06-lizhi-kb-complete-design.md](./2026-07-06-lizhi-kb-complete-design.md)；MCP 见 [2026-07-08-lizhi-mcp-design.md](./2026-07-08-lizhi-mcp-design.md)

---

## 1. 目标

将「删除文档」从不可恢复的硬删除改为：

1. UI / 常规删除 → **移至回收站**（软删除），可恢复  
2. 回收站内可 **永久删除** / **清空**  
3. 按保留天数 **自动清理** 到期项（默认 30 天，设置可改）  
4. MCP：`delete` 软删；另提供 **直接硬删**（可跳过回收站）

成功标准：误删可恢复；活跃文档列表/搜索/图谱/RAG 不再计入回收站文档；到期或手动可彻底清除。

## 2. 方案选择

采用 **软删除字段（`deleted_at`）**：文件保留在原 `workspace/{folder}/` 路径，不物理挪到 `.trash/`。

| 方案 | 结论 |
|------|------|
| A. `deleted_at` 软删 | **采用**：恢复简单、加密 vault 无额外搬文件 |
| B. 移入 `.trash/` | 边角多，收益小 |
| C. 独立 trash 表 | 双表同步重，过度设计 |

## 3. 架构

```
Sidebar「回收站」→ TrashPanel（工作区内嵌视图）
       ↓
documents store / documentService
       ↓
Tauri DocumentService
  ├── soft_delete (delete_document)
  ├── restore_document
  ├── purge_document（硬删）
  ├── list_trashed_documents
  ├── empty_trash
  └── purge_expired_documents
       ↓
SQLite documents.deleted_at + FTS / link_index
文件：软删不动；硬删时 fs::remove_file
```

配置：`vault-ui-state.json` 字段 `trash_retention_days`（默认 30，钳制 1–365）。

到期清理触发（不设后台常驻定时器）：

1. vault **解锁后**跑一次 `purge_expired_documents`  
2. **打开回收站**时再跑一次  

## 4. 数据模型

### 4.1 Schema 迁移

沿用 `migrate_documents_columns`：

```sql
ALTER TABLE documents ADD COLUMN deleted_at INTEGER NULL;
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at);
```

语义：`deleted_at IS NULL` = 活跃；非 NULL = 在回收站（Unix 秒或与现有 `created_at`/`updated_at` 同单位）。

### 4.2 查询约定

所有「活跃文档」路径必须过滤 `deleted_at IS NULL`，包括但不限于：

- `list_documents`、树、仪表盘统计、编辑热力聚合所用文档数  
- FTS 检索、RAG、图谱节点来源  
- 备份 merge 时「当前库 live 文档」比较（trash 不计入活跃集合；trash 行与文件仍随 vault 备份）

`list_trashed_documents`：`WHERE deleted_at IS NOT NULL`，结果含 `deleted_at`。

### 4.3 索引与正文

| 操作 | FTS | link_index | 文件 | tags |
|------|-----|------------|------|------|
| 软删 | 移除该 doc | 移除该 doc **出链**（与现硬删前半段一致） | 保留 | **保留** |
| 恢复 | 按正文重建 | 重解析重建 | 不动 | 仍在 |
| 硬删（purge） | 移除 | 移除出链，并 `DELETE` 入链 `target_id = id` 残留 | `remove_file` | **清理** |

软删后其他文档正文中的 `[[wikilink]]` 仍保留，UI 按断链处理；恢复后入链可再建立。

## 5. Tauri Commands

| Command | 行为 |
|---------|------|
| `delete_document(id)` | **改为软删**：`deleted_at = now`；摘 FTS/出链；不删文件、不删行。对已在回收站：幂等成功（保留原 `deleted_at`） |
| `restore_document(id)` | 要求 `deleted_at IS NOT NULL`，否则错误「文档不在回收站」；清空 `deleted_at`；`ensure_folder` 原路径后挂回；重建 FTS/links；返回 `DocumentMeta` |
| `purge_document(id)` | **硬删**：活跃或回收站均可；DB 行 + 文件 + FTS/links + tags；清入链残留 |
| `list_trashed_documents()` | 回收站列表 |
| `empty_trash()` | 硬删全部 trash |
| `purge_expired_documents()` | 按 `trash_retention_days` 硬删到期项；返回 `{ purged: number }` |
| `get_trash_retention_days` / `set_trash_retention_days` | 读写 `vault-ui-state.json`；非法输入钳制 1–365 |

浏览器 fallback（localStorage）：同样维护 `deleted_at` 与保留天数，行为对齐；到期清理在打开回收站时执行。

现有硬删实现抽为内部 `purge`/`hard_delete`，供 `purge_document`、`empty_trash`、`purge_expired` 复用。

## 6. MCP

均需既有解锁态；写操作需 `writeEnabled`。

| 工具 | 行为 |
|------|------|
| `lizhi_delete_document` | 软删（与 UI 一致）；描述改为「移至回收站」 |
| `lizhi_restore_document` | 恢复 |
| `lizhi_list_trashed_documents` | 列出回收站（只读） |
| `lizhi_purge_document` | **直接硬删**（活跃或 trash 均可）；描述写明不可恢复 |
| `lizhi_empty_trash` | 清空回收站；描述写明不可恢复 |

不提供 MCP「改保留天数」或「仅触发到期清理」专用工具（由客户端解锁/打开回收站触发即可）。

说明：若仅有软删而无 `purge`，Agent 无法兑现「彻底删除敏感内容」、也无法主动回收空间；故 MCP 必须具备硬删。

## 7. UI

### 7.1 侧栏

`src/components/workspace/Sidebar.vue` 文档树下方、固定底部：「回收站」入口（图标 + 文案 + 可选数量徽章）。点击后工作区主内容切到回收站面板（**内嵌视图，不新开路由**）。

### 7.2 回收站面板

新组件（如 `TrashPanel.vue`）：

- 列表：标题、原文件夹、删除时间、剩余天数（`deleted_at + retention`）  
- 行操作：恢复、永久删除（永久删除二次确认）  
- 顶部：清空回收站（确认强调不可恢复）  
- 空态：「回收站为空」  

打开面板时先 `purge_expired` 再 `list_trashed`。

### 7.3 删除确认

全局删除确认文案由「删除后无法恢复」改为表明将移至回收站、可从侧栏恢复；确认按钮文案推荐「移至回收站」。命令面板 / 右键菜单同步。

### 7.4 设置

设置页增加「回收站保留天数」（1–365，默认 30）。不在设置页放完整 trash 列表。

### 7.5 前端状态

- `documents.remove` → 软删；从树 / nav / pinned 移除（与现一致）；`folders.onDocumentRemoved` 仍更新 order  
- 恢复后 `fetchTree`，文档回到原 folder（folder 不存在则 `ensure_folder`）  
- 硬删时清理 `document_tags`  

### 7.6 本切片不做

- 回收站内预览/编辑正文  
- 拖拽进回收站  
- 分文件夹独立回收站  

## 8. 错误与边界

| 场景 | 行为 |
|------|------|
| `restore` / UI 永久删除针对未入站文档 | 错误：「文档不在回收站」（UI 永久删除仅针对 trash 列表项；MCP `purge` 不受此限） |
| 重复软删 | 幂等成功 |
| 恢复时 folder 已删 | `ensure_folder` 后挂回 |
| `empty_trash` / 批量 purge 部分失败 | 尽力删除；返回计数或错误；前端 toast |
| 未解锁 | 与现有命令一致，不可用 |
| 备份 | trash 随 vault 备份；恢复备份后 `deleted_at` 保留 |

对已软删 id 的 `read`/`save`：**拒绝**并提示文档在回收站（需先恢复），避免 Agent 静默改「已删除」正文。

## 9. 验收标准

1. UI 删除后文档离开树与搜索，侧栏回收站可见，可恢复回原夹（或 ensure 后的原路径）  
2. UI 永久删除 / 清空后文件与 DB 行消失，不可恢复  
3. 默认保留 30 天；设置可改；解锁或打开回收站时清理到期项  
4. MCP：`delete` 软删；`purge` 可硬删活跃或 trash；提供 list/restore/empty_trash  
5. 活跃 list/统计/图谱/RAG 不计 trash  
6. 常规删除确认不再声称「无法恢复」（永久删除确认除外）  
7. `pnpm verify` 通过  

## 10. 测试（最低）

- Rust：软删 → list 过滤 → restore → purge；`purge_expired` 按天数；对 trash 外 `restore` 失败  
- 前端：确认文案；回收站恢复 / 永久删除  
- 流程变更时 E2E：删 → 回收站 → 恢复  

## 11. 实现触及面（指引）

| 层 | 主要文件 |
|----|----------|
| Rust | `documents.rs`, `db.rs`, `commands.rs`, `link_index.rs`, `search_index.rs`, `mcp/handlers.rs`, `prefs`（`VaultUiState`） |
| 前端 | `useDocumentDelete.ts`, `App.vue`, `Sidebar.vue`, `documents` store, `documentService.ts`, Settings, 新 `TrashPanel` |
| MCP | `packages/lizhi-mcp` tools / types / httpBackend；同步 bundle |
| Spec 联动 | 实现后可回写 complete-design command 清单与 MCP design |

---

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-07-14 | 初版：软删回收站 + 可配置保留 + MCP 软删/硬删 |
