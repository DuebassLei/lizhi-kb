# 狸知知识库 · Agent 工作流文档

> 双轨（Claude Code + Cursor）共享的**单一事实来源**。工具专属配置见 `.claude/` 与 `.cursor/`。

## 文档索引

| 文档 | 说明 |
|------|------|
| [multi-agent-workflow.md](./multi-agent-workflow.md) | 角色定义、编排模式、交接协议 |
| [sync-strategy.md](./sync-strategy.md) | Claude Code / Cursor 配置同步策略 |
| [handoff-template.md](./handoff-template.md) | Agent 间交接模板 |
| [templates/](./templates/) | 常见任务模板 |

## 相关文档（同项目内）

| 文档 | 路径 |
|------|------|
| 产品 spec | [../superpowers/specs/](../superpowers/specs/) |
| 原始 PRD | [../design/初版设计.md](../design/初版设计.md) |
| 交互原型 | [../../prototype/](../../prototype/) |

## 核心工作流

```
Research → Plan → Implement → Review → Verify → Ship
   调研      规划      实现        审查      验证     交付
```

## 入口文件

| 工具 | 入口 | 工作目录 |
|------|------|----------|
| Claude Code | `CLAUDE.md` | 项目根 |
| Cursor | `AGENTS.md` + `.cursor/rules/` | 项目根 |
