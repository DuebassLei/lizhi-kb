# 幕布 · 产品设计

> **版本**: 1.2.0  
> **日期**: 2026-07-15  
> **状态**: 已批准实现  
> **定位**: 侧栏独立模块，对齐参考产品「主题树 + 笔记/导图」；数据独立存表，不嵌入 Markdown 编辑器

---

## 1. 概述

| 项 | 决策 |
|----|------|
| 侧栏名 | **幕布** |
| 路由 | `/mubu` |
| 视图切换 | **笔记 \| 导图** |
| 数据 | `mubu_docs` + `mubu_nodes`（vault SQLCipher） |
| 与 Workspace | 解耦；禁止与 `documents.content` 双写 |
| 备份 | 随 `.lizhi`；`replace` / `merge-documents` 覆盖 |

### 1.1 能力（v1.2）

- 文档列表：新建 / 删除
- 笔记视图：圆点菜单、引导线、折叠；Tab / Enter / Backspace / ↑↓
- **主题菜单**（**右键**主题行打开，**不含备注/描述**）：标题级别 H1–H3、粗体/斜体/下划线/删除线、字体颜色、荧光笔、待办、图标、删除
- 导图视图：根胶囊 → 一级浅框 → 二级+底线
- **导图双击改标题**：行内编辑节点 `text`；Enter / 失焦提交，Esc 取消；走 debounce 整树保存（不改结构）
- **导图导出**：PNG 图片；Markdown 大纲（整树写出，**不受折叠影响**；待办为 `- [ ]` / `- [x]`）
- 状态栏：主题数 / 字数
- debounce 整树保存

### 1.2 不做（v1）

- 主题备注（编辑描述）
- 图片 / 表格插入（后续）
- CodeMirror 嵌入 / Markdown 双写
- 拖拽改层级、导图上增删节点、协作、云同步
- 参考产品官方格式导入
- `merge`（仅设置）合并幕布数据

---

## 2. 数据模型

见实现：`src-tauri/src/db.rs` 中 `mubu_docs` / `mubu_nodes`。每篇唯一根节点（`parent_id IS NULL`）。

---

## 3. 备份与恢复

| 模式 | 行为 |
|------|------|
| `replace` | 整库含 `mubu_*` |
| `merge` | 不碰 DB |
| `merge-documents` | 按篇 `updated_at`；赢则整树替换节点 |

旧备份无表则 skip。明文→加密须 `copy_table` 两表。

---

## 4. 模块落点

| 路径 | 职责 |
|------|------|
| `src-tauri/src/mubu.rs` | CRUD |
| `src/views/MubuView.vue` | 壳 |
| `src/components/mubu/*` | 列表、编辑器、导图 |
| `src/services/mubuService.ts` | IPC + localStorage fallback |
| `src/stores/mubu.ts` | 状态 |

---

## 5. 验收

- 侧栏可进幕布；笔记编辑可保存并刷新后仍在
- 笔记 ↔ 导图同源切换
- 导图双击可改标题并 debounce 保存；导图可导出 PNG 与 Markdown 整树大纲
- `merge-documents` 较新篇盖写、较旧不覆盖
- `pnpm verify` 通过
