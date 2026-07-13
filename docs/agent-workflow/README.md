# 狸知知识库 · Agent 工作流文档

> 双轨（Claude Code + Cursor）共享的**单一事实来源**。工具专属配置见 `.claude/` 与 `.cursor/`。

## 文档索引

| 文档 | 说明 |
|------|------|
| [multi-agent-workflow.md](./multi-agent-workflow.md) | 角色定义、编排模式、交接协议 |
| [sync-strategy.md](./sync-strategy.md) | Claude Code / Cursor 配置同步策略 |
| [handoff-template.md](./handoff-template.md) | Agent 间交接模板 |
| [verification.md](./verification.md) | **零警告编译**验证门禁 |
| [templates/](./templates/) | 常见任务模板 |

## 相关文档（同项目内）

| 文档 | 路径 |
|------|------|
| 产品 spec | [../superpowers/specs/](../superpowers/specs/) |
| Agent 工作台 | [../superpowers/specs/2026-07-10-cc-workbench-design.md](../superpowers/specs/2026-07-10-cc-workbench-design.md)（v1.0.2；CC GUI 按需对齐 §17） |
| AI 助手 | [../superpowers/specs/2026-07-08-lizhi-ai-chat-design.md](../superpowers/specs/2026-07-08-lizhi-ai-chat-design.md) |
| 原始 PRD | [../design/初版设计.md](../design/初版设计.md) |
| 交互原型 | [../../prototype/](../../prototype/) |

## 核心工作流

```
Research → Plan → Implement → Review → Verify → Ship
   调研      规划      实现        审查      验证     交付
```

**Verify 门禁**：`pnpm verify` 必须通过，编译/构建**零警告**（见 [verification.md](./verification.md)）。

## 入口文件

| 工具 | 入口 | 工作目录 |
|------|------|----------|
| Claude Code | `CLAUDE.md` | 项目根 |
| Cursor | `AGENTS.md` + `.cursor/rules/` | 项目根 |
