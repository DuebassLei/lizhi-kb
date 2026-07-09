---
name: lizhi-workflow
description: 狸知知识库多 Agent 工作流、任务模板与交接协议。实现功能、bugfix、审查时加载。
---

# 狸知工作流 Skill

## 文档（渐进披露）

| 主题 | 路径 |
|------|------|
| 工作流总览 | `docs/agent-workflow/multi-agent-workflow.md` |
| 交接模板 | `docs/agent-workflow/handoff-template.md` |
| 同步策略 | `docs/agent-workflow/sync-strategy.md` |
| 功能 | `docs/agent-workflow/templates/feature.md` |
| Bugfix | `docs/agent-workflow/templates/bugfix.md` |
| UI | `docs/agent-workflow/templates/ui.md` |
| 导出 | `docs/agent-workflow/templates/export.md` |
| Tauri | `docs/agent-workflow/templates/tauri-backend.md` |
| 产品 spec | `docs/superpowers/specs/2026-07-06-lizhi-kb-complete-design.md` |

## Gotchas（狸知特有）

- **IA**：Workspace 内编辑/图谱是视图切换，不是独立顶级路由
- **原型**：`prototype/index.html` 仅交互参考，路由以 spec 为准
- **数据**：`~/.lizhi-kb/` 加密库，勿提交、勿测试写入仓库内
- **E2E 浏览器**：国内用 `pnpm playwright:install`，勿用官方 CDN
- **安全**：vault 解锁前不做敏感 IO；导出/水印改动必过 reviewer

## 验证命令

```bash
pnpm dev
pnpm build
pnpm tauri dev
pnpm test:e2e
```

## 目标与约束

- 垂直切片，单切片可演示
- 最小 diff，中文 UI
- 不主动 commit
