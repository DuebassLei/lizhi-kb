# AGENTS.md · 狸知知识库

> **通用 Agent 指令** — Claude Code 与 Cursor 均适用。  
> Claude 专属：见 [CLAUDE.md](./CLAUDE.md)。  
> 工作流 SSOT：[docs/agent-workflow/](./docs/agent-workflow/README.md)

## 项目

**狸知知识库（Lizhi Knowledge）** — 本地优先、端到端加密的个人知识库桌面应用。

| 项 | 值 |
|----|-----|
| 工作目录 | 本目录（`lizhi-kb/` 代码路径） |
| 产品 spec | `docs/superpowers/specs/2026-07-06-lizhi-kb-complete-design.md` |
| Agent 工作台 spec | `docs/superpowers/specs/2026-07-10-cc-workbench-design.md` |
| AI 助手 spec | `docs/superpowers/specs/2026-07-08-lizhi-ai-chat-design.md` |
| 原始 PRD | `docs/design/初版设计.md` |
| 备份设计 | `docs/design/2026-07-08-backup-extension.md` |
| 数据目录 | `~/.lizhi-kb/`（加密库，勿提交） |

### 数据目录要点

- **vault 核心**：`workspace/`、`assets/`、`vault.db`（或明文 `lizhi-kb.db`）、`vault.meta.json`、`keys.enc`
- **配置**：`ai-config.json`、`ai-secrets.json`、`mcp-config.json`、`cc-workbench.json`、`cc-secrets.json`（敏感，纳入 `.lizhi` v2 备份）
- **Claude Code 生态**（Agent 工作台）：`~/.claude/`（agents、prompts、skills）、`~/.claude.json`（MCP）；项目级 `{project}/.claude/`
- **UI 状态 SSOT**：`vault-ui-state.json`（文件夹树、标签、对话记录等；Tauri 下双写 localStorage）
- **恢复模式**：`replace`（整库）| `merge`（仅设置）| `merge-documents`（文档+设置合并）

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Tauri 2 |
| 后端 | Rust（`src-tauri/`） |
| 前端 | Vue 3 + TypeScript + Vite |
| 状态 | Pinia |
| 路由 | Vue Router 4 |
| 样式 | Tailwind CSS 4 |
| 编辑器 | CodeMirror 6（Markdown 源码） |
| 图谱 | SVG + composable（工作区内嵌视图） |
| E2E | Playwright |

## 常用命令

```bash
pnpm install
pnpm dev              # 浏览器预览（无需 Rust）
pnpm tauri dev        # 完整桌面应用
pnpm build            # 前端构建（含类型检查，零警告 Vite）
pnpm verify           # 完整门禁：前端 + MCP + Rust，零警告
pnpm verify:fe        # 仅前端
pnpm verify:rust      # 仅 Rust
pnpm test:e2e         # Playwright
pnpm playwright:install   # 国内镜像安装浏览器
```

## 目录约定

```
src/
├── components/   vault | workspace | editor | graph | insights | cc | common
├── views/        Welcome | Unlock | Insights | Workspace | Settings | CcWorkbench
├── stores/       vault, documents, editor, links, ui, folders, ccWorkbench
├── composables/  useTauriCommand, useAutoSave, useWikiSuggest, cc/* …
├── services/     documentService, ccWorkbenchService, aiService …
├── extensions/   WikiLink.ts
└── router/       产品 IA（非 prototype 七屏 demo）
src-tauri/src/    Rust commands、加密、文件 IO、cc_workbench/*
packages/ai-bridge/   Agent SDK 桥接（同步至 src-tauri/resources/ai-bridge）
tests/e2e/        Playwright
```

**路由 IA**：`/welcome` → `/unlock` → `/insights`（默认）→ `/workspace`（编辑/图谱为视图切换）→ `/settings`；并列 **`/cc-workbench`**（Agent 工作台，侧栏入口）

## 编码原则

1. **最小 diff** — 只改任务相关文件
2. **匹配现有风格** — 命名、Composition API、Pinia store 模式
3. **垂直切片** — 优先端到端可演示的小步，避免「先全后端再全前端」
4. **安全优先** — 加密库项目：密钥不进日志、不进前端持久化明文
5. **中文 UI** — 用户可见文案用中文
6. **不主动 commit** — 除非用户明确要求

## 多 Agent 工作流

完整说明：[multi-agent-workflow.md](./docs/agent-workflow/multi-agent-workflow.md)

| 角色 | 用途 |
|------|------|
| Planner | 调研、计划、验收标准 |
| Implementer | 实现与自测 |
| Reviewer | 代码审查、安全 |
| Debugger | 系统化排错 |

**默认流程**：Research → Plan（用户确认）→ Implement → Review → Verify

**Verify**：`pnpm verify` 必须通过（**项目源码**零 warning；`node_modules` 除外）— 见 [verification.md](./docs/agent-workflow/verification.md)

**任务模板**：`docs/agent-workflow/templates/`（feature / bugfix / ui / export / tauri-backend）

**交接**：使用 [handoff-template.md](./docs/agent-workflow/handoff-template.md)

## Cursor 专用

- 规则：`.cursor/rules/`
- 复杂任务先 Plan 模式；实现用 Agent 模式
- 审查可用 `bugbot` / `code-reviewer` subagent
- 探索代码库用 `explore` subagent（readonly）

## 禁止

- 不要以 `prototype/index.html` 的七屏导航覆盖 spec IA
- 不要引入云同步/协作（v1.x Won't）
- 不要跳过 vault 解锁态做敏感 IO
- 不要 bundle 无关重构进功能 PR
