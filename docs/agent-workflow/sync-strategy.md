# 双轨配置同步策略

Claude Code 与 Cursor **独立可用**，共享文档为单一事实来源（SSOT）。**全部项目文件位于本目录（`lizhi-kb/`）下。**

## 1. 三层架构

```
lizhi-kb/（项目根）
├── docs/
│   ├── agent-workflow/     ← Agent SSOT
│   ├── superpowers/        ← 产品 spec / 计划
│   └── design/             ← 原始 PRD
├── prototype/
├── AGENTS.md / CLAUDE.md
├── .claude/ / .cursor/
└── scripts/sync-agent-config.mjs
```

```
┌─────────────────────────────────────────────────────────┐
│  共享层（SSOT）docs/agent-workflow/                      │
└──────────────────────────┬──────────────────────────────┘
                           │ 引用（不复制正文）
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌─────────────────────┐           ┌─────────────────────┐
│ Claude Code 轨       │           │ Cursor 轨            │
│ CLAUDE.md           │           │ AGENTS.md            │
│ .claude/            │           │ .cursor/             │
└─────────────────────┘           └─────────────────────┘
```

## 2. 文件归属

| 内容 | 位置 | 维护方式 |
|------|------|----------|
| 项目上下文、栈、约定 | `AGENTS.md` | 直接编辑；Claude/Cursor 均读 |
| Claude 专属 | `.claude/` | 仅 Claude Code |
| Cursor 专属 | `.cursor/rules/` | 仅 Cursor |
| 工作流、角色、模板 | `docs/agent-workflow/` | SSOT，两轨引用 |
| 验证门禁 | `docs/agent-workflow/verification.md` | 零警告编译 SSOT |
| 校验脚本 | `scripts/sync-agent-config.mjs` | 从 `lizhi-kb/` 运行 |
| 产品 spec | `docs/superpowers/specs/` | 产品 SSOT |
| 原始设计 | `docs/design/初版设计.md` | PRD/TDD |

### 2.1 什么放在共享层

- 多 Agent 角色定义与 handoff 协议
- 任务模板（feature/bugfix/ui/export/tauri）
- 工作流图与编排说明

### 2.2 什么放在工具轨

**Claude Code**（`.claude/`）：
- `agents/*.md` — YAML frontmatter 子 Agent
- `commands/*.md` — 斜杠命令
- `skills/*/SKILL.md` — 可复用技能
- `rules/*.md` — 带 `paths:` 的懒加载规则
- `settings.json` — 权限、hooks

**Cursor**（`.cursor/rules/`）：
- `*.mdc` — globs / alwaysApply 规则
- 与 `.claude/rules/` **语义对齐**，格式不同

## 3. 同步规则

1. **改 workflow/角色/模板** → 只改 `docs/agent-workflow/`
2. **改项目约定** → 改 `AGENTS.md`，再检查 `CLAUDE.md` 与 `.cursor/rules/`
3. **改领域规则**（Vue/Tauri）→ 同时更新 `.claude/rules/` 与 `.cursor/rules/`
4. **改 Agent 行为** → Claude 改 `.claude/agents/`；Cursor 在规则或 AGENTS.md 中保留等价说明

## 4. 更新检查清单

每次修改 Agent 配置后：

- [ ] `docs/agent-workflow/` 是否需要更新？
- [ ] `AGENTS.md` 与 `CLAUDE.md` 是否仍一致？
- [ ] `.claude/rules/` 与 `.cursor/rules/` 领域规则是否对齐？
- [ ] 新命令是否在 `multi-agent-workflow.md` 索引中？
- [ ] 运行 `node scripts/sync-agent-config.mjs --check`（在项目根目录）

## 5. 同步脚本

`scripts/sync-agent-config.mjs`：

- `--check`：校验两轨 rules 成对、AGENTS/CLAUDE 引用 SSOT
- `--report`：输出差异摘要

**不自动覆盖正文**——避免误删工具专属 frontmatter。

## 6. 冲突处理

| 冲突 | resolution |
|------|-------------|
| Claude command vs Cursor 无等价物 | 在 AGENTS.md 写等效自然语言流程 |
| Cursor rule vs Claude rule 措辞不同 | 以 `docs/agent-workflow/` 为准 |
| spec 与 AGENTS 矛盾 | spec 优先，更新 AGENTS |

## 7. 个人覆盖（不提交）

| 工具 | 文件 |
|------|------|
| Claude Code | `.claude/settings.local.json` |
| Cursor | 用户级 Rules / Skills |
