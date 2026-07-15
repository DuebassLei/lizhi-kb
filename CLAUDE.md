# CLAUDE.md · 狸知知识库

> Claude Code 项目入口。通用约定见 [AGENTS.md](./AGENTS.md)。  
> 工作流 SSOT：[docs/agent-workflow/](./docs/agent-workflow/README.md)

## 快速参考

- **工作目录**：本目录（项目根）
- **产品 spec（唯一）**：`docs/superpowers/specs/2026-07-06-lizhi-kb-complete-design.md`
- **品牌 / UI**：`docs/brand/lizhi-brand-design.md`
- **Agent 工作台 spec**：`docs/superpowers/specs/2026-07-10-cc-workbench-design.md`（v1.0.2；CC GUI 后续对齐见 spec §17）
- **Plan 优先**：复杂任务先 Plan 模式，用户确认后再实现
- **上下文**：约 40% 时考虑 `/compact`；新任务新会话

## Claude Code 结构

```
.claude/
├── agents/       planner, implementer, reviewer, debugger
├── commands/     lizhi-feature, lizhi-bugfix, lizhi-review
├── rules/        vue-frontend, tauri-rust（paths 懒加载）
├── skills/       lizhi-workflow（工作流知识）
└── settings.json
```

## 编排模式

采用 **Command → Agent → Skill**（参考 claude-code-best-practice）：

| 组件 | 示例 |
|------|------|
| Command | `/lizhi-feature` — 编排全流程 |
| Agent | `implementer` — 执行实现 |
| Skill | `lizhi-workflow` — 渐进式工作流/模板引用 |

子 Agent 通过 **Agent 工具**调用，不要用 bash 模拟。

## 斜杠命令

| 命令 | 说明 |
|------|------|
| `/lizhi-feature` | 功能：Plan → Implement → Review |
| `/lizhi-bugfix` | Bug：Debug → Fix → Review |
| `/lizhi-review` | 仅审查当前变更 |

## 领域规则

- 编辑 `src/**` → 自动加载 `.claude/rules/vue-frontend.md`
- 编辑 `src-tauri/**` → 自动加载 `.claude/rules/tauri-rust.md`

## 安全（加密库）

- 密钥与 vault 明文仅 Rust 侧处理
- 审查改动时默认 spawn `reviewer` agent
- IPC 与导出/水印改动需 extra scrutiny

## 验证

```bash
pnpm verify        # 零警告编译门禁（合并前必跑）
pnpm build         # 前端 + MCP 构建
pnpm test:e2e      # 流程变更时
pnpm tauri dev     # Tauri/IPC 变更时
node scripts/sync-ai-bridge-resources.mjs   # 修改 packages/ai-bridge 后同步到 Tauri bundle
pnpm build:mcp && pnpm sync:lizhi-mcp       # 修改 packages/lizhi-mcp 后同步到 Tauri bundle
```


详见 [verification.md](./docs/agent-workflow/verification.md)。

## 配置同步

修改 workflow 时更新 `docs/agent-workflow/`，并运行：

```bash
node scripts/sync-agent-config.mjs --check
```

详见 [sync-strategy.md](./docs/agent-workflow/sync-strategy.md)。
