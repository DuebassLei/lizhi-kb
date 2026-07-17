# AI 隐私护栏 Implementation Plan

> **For agentic workers:** 按任务顺序实现；每任务可独立验证。Spec：`docs/superpowers/specs/2026-07-17-ai-privacy-guard-design.md`

**Goal:** 整篇 `ai_exclude` + `:::ai-private` 围栏硬拦截，全链路不进模型；预览提示、导出删除；编辑栏/插入模块可快插。

**Architecture:** Rust `ai_privacy` 统一 sanitize；DB 字段 `ai_exclude`；前端预览/导出识别围栏；编辑栏与 moduleSnippets 共用 snippet。

**Tech Stack:** Vue 3、Rust/Tauri、SQLite、现有 wechatExport `:::` 解析。

## Global Constraints

- 中文 UI；无「仍要发送」
- 预览有提示卡；导出无占位
- 最小 diff；`pnpm verify` 零警告

---

## Task 1: DB + DocumentMeta

- [ ] 迁移 `documents.ai_exclude INTEGER NOT NULL DEFAULT 0`
- [ ] Rust/TS `DocumentMeta.aiExclude`
- [ ] IPC：`set_document_ai_exclude`（或 update 字段命令）

## Task 2: Rust sanitize + AI 出口

- [ ] `src-tauri/src/ai_privacy.rs`：剥围栏、未闭合处理
- [ ] RAG / Agent read / MCP read-search / CC opened files 挂钩
- [ ] `ai_exclude` 文档跳过/报错

## Task 3: 前端开关

- [ ] 文档菜单「禁止喂 AI」
- [ ] 标题/树小锁（可选轻量）

## Task 4: 预览 + 导出

- [ ] 预览：`ai-private` → 提示卡
- [ ] 导出：整段删除无占位

## Task 5: 插入入口

- [ ] `moduleSnippets` 安全组 + `ai-private`
- [ ] `markdownInsert.insertAiPrivate` + 编辑栏按钮

## Task 6: 扫描（P2，可同 PR 轻量做）

- [ ] 保存后启发式提示条（可简化）

## Task 7: Verify

- [ ] 单元测试围栏/插入
- [ ] `pnpm verify`
