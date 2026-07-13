---
description: 狸知 Bug 修复 Hotfix Debug → Fix → Review
argument-hint: [bug 描述或复现步骤]
allowed-tools:
  - Agent
  - Read
---

# /lizhi-bugfix

**参数**：`$ARGUMENTS`

模板：`docs/agent-workflow/templates/bugfix.md`

## Phase 1 · Debug

Spawn `debugger`：

> 排查：$ARGUMENTS。复现、根因、最小修复范围。使用 bugfix 模板。

## Phase 2 · Fix

Spawn `implementer`：

> 按 debugger 结论最小修复。pnpm verify + 相关验证。

## Phase 3 · Review

Spawn `reviewer`（安全相关 bug 必做）：

> 审查 hotfix diff，关注回归与安全。

## 输出

根因一行、修复文件、验证命令。
