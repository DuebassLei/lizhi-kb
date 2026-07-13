---
description: 狸知新功能完整工作流 Research → Plan → Implement → Review
argument-hint: [功能描述或 TASK.md 路径]
allowed-tools:
  - Agent
  - AskUserQuestion
  - Read
  - Skill
---

# /lizhi-feature

编排狸知知识库**新功能**多 Agent 工作流。

**参数**：`$ARGUMENTS`（功能描述或 `.agent-tasks/<slug>/TASK.md` 路径）

**SSOT**：`docs/agent-workflow/multi-agent-workflow.md` · 模板 `templates/feature.md`

## 执行契约

1. 若计划未批准，**不得**直接改生产代码
2. 子 Agent 必须用 **Agent 工具**，禁止 bash 模拟
3. 每阶段结束输出 handoff 摘要

## Phase 1 · Plan

Spawn `planner`：

> 为狸知知识库规划：$ARGUMENTS。阅读 complete-design spec 相关章节，探索代码库，按 feature 模板输出计划与验收标准。只读。

**用户门禁**：展示计划，等待用户确认「继续实现」。

## Phase 2 · Implement

用户确认后 spawn `implementer`：

> 按已批准计划实现。垂直切片、最小 diff。每切片后 pnpm verify（零警告）。preload lizhi-workflow skill。

## Phase 3 · Review

Spawn `reviewer`：

> 审查本次功能改动，重点安全与 spec。输出阻塞/建议。

## Phase 4 · 收尾

- 若有阻塞：implementer 修复 → reviewer 再审
- 输出：变更摘要、验证命令、是否可 commit（不自动 commit）
