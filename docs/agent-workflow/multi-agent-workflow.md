# 多 Agent 工作流

## 1. 设计原则

来自 [claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) 的核心实践：

- **Command 编排工作流**，Agent 执行专项任务，Skill 提供渐进式领域知识
- **功能专属 Agent** 优于通用 Agent（如「Vue 编辑器实现者」优于「后端工程师」）
- **子任务控制在 50% 上下文内**完成；复杂任务用 Plan 模式起步
- **垂直切片**：DB/Service/UI 同一切片交付，避免水平分阶段
- **人工门禁**：Research 与 Plan 阶段需用户确认后再 Implement

## 2. 角色定义

| 角色 | 标识 | 何时使用 | 产出 |
|------|------|----------|------|
| **规划者 Planner** | `planner` | 新功能、架构变更、跨模块重构 | 调研摘要、实施计划、验收标准 |
| **实现者 Implementer** | `implementer` | 计划已批准、任务边界清晰 | 代码、单元/E2E 测试、变更说明 |
| **审查者 Reviewer** | `reviewer` | 实现完成、PR 前、安全相关改动 | 审查报告、阻塞/建议项 |
| **调试者 Debugger** | `debugger` | 测试失败、运行时错误、加密/IPC 异常 | 根因分析、修复方案、回归验证 |

### 2.1 规划者 Planner

**职责**：读 spec、探索代码库、产出可执行计划。

**必读**：
- `docs/superpowers/specs/2026-07-06-lizhi-kb-complete-design.md`
- 相关 M0/交付计划

**禁止**：直接改生产代码（只读调研）。

**Claude Code**：`.claude/agents/planner.md`  
**Cursor**：Task `subagent_type=explore` 或 Plan 模式 + 本角色说明

### 2.2 实现者 Implementer

**职责**：按 PLAN 小步提交，遵循项目约定。

**栈分工**：
- 前端：`src/` Vue 3 + Pinia + TipTap + Tailwind
- 后端：`src-tauri/src/` Rust + Tauri Commands
- 测试：`tests/e2e/` Playwright

**Claude Code**：`.claude/agents/implementer.md`  
**Cursor**：Agent 模式 + `vue-tauri` 规则

### 2.3 审查者 Reviewer

**职责**：安全（加密、vault）、性能、Vue/Tauri 边界、与 spec 一致性。

**重点关注**：
- 密钥/明文是否落盘或日志
- Tauri IPC 权限与输入校验
- 编辑器 XSS（TipTap 内容）
- 导出/水印逻辑

**Claude Code**：`.claude/agents/reviewer.md`  
**Cursor**：Bugbot / code-reviewer subagent

### 2.4 调试者 Debugger

**职责**：系统化排查，有运行时证据再下结论。

**流程**：复现 → 假设 → 验证 → 修复 → 回归

**Claude Code**：`.claude/agents/debugger.md`  
**Cursor**：Debug 模式 + `systematic-debugging` 技能

### 2.5 辅助 Agent（可选）

以下 Agent 与 §2 四角色**互补**，不参与 `--check` 必需列表；定义见 `.claude/agents/`，内置市场见 `src-tauri/resources/cc-agent-market.json`。

| Agent | 文件 | 何时使用 |
|-------|------|----------|
| **探索者 Explore** | `explore.md` | 只读摸底：路由、模块位置、调用链 |
| **代码审查 Code Reviewer** | `code-reviewer.md` | PR 前快速自查（通用维度） |
| **狸知助手** | `lizhi-kb-assistant.md` | 项目专属：vault/project 边界、IA、委派专职 Agent |
| **基础助手** | `general-assistant.md` | 日常问答与轻量辅助 |
| **归藏 PPT** | `guizang-ppt.md` | guizang-ppt-skill 横向翻页 PPT |
| **公众号创作** | `wechat-mp-writer.md` | 公众号撰写与去 AI 味润色 |

**Cursor 等价**：Explore → `subagent_type=explore`；Code Reviewer → `code-reviewer` / Bugbot subagent。

## 3. 编排模式

### 3.1 顺序模式（默认）

适用于大多数功能与 Bugfix：

```
用户请求
  → Planner（调研 + 计划，用户确认）
  → Implementer（实现 + 自测）
  → Reviewer（审查）
  → Implementer（修复审查项，如有）
  → 用户验收
```

### 3.2 并行模式

适用于独立子任务（需明确文件边界，避免冲突）：

```
Planner 产出任务列表
  ├─ Implementer A：前端 UI（src/components/...）
  ├─ Implementer B：Tauri 命令（src-tauri/...）
  └─ Implementer C：E2E 测试（tests/e2e/...）
  → Reviewer 汇总审查
```

**并行条件**：
- 各任务修改路径无重叠
- 共享类型/接口由 Planner 先定义
- 合并前运行 `pnpm verify` 与 `pnpm test:e2e`

### 3.3 快速通道（Hotfix）

```
Debugger（根因）→ Implementer（最小修复）→ Reviewer（安全扫一眼）→ Ship
```

跳过完整 Plan，但 Debugger 必须留下简短根因记录。

## 4. 交接协议

每次 Agent 切换时使用 [handoff-template.md](./handoff-template.md)。

**必含字段**：
1. 任务 ID / 分支名
2. 已完成项
3. 阻塞项 / 待决问题
4. 下一步 Agent 与具体指令
5. 需读取的文件列表
6. 验证命令（如 `pnpm verify`、`pnpm tauri dev`）

## 5. 上下文管理

| 场景 | 建议 |
|------|------|
| 新功能 | 新会话；Planner 先跑 |
| 延续实现 | 同会话或 handoff 摘要 |
| 上下文 > 40% | `/compact`（带提示）或新会话 + handoff |
| 失败尝试 | `/rewind` 重试，勿堆叠错误修正 |

## 6. 任务模板

按任务类型选用 `templates/` 下模板，复制到 `.agent-tasks/<slug>/TASK.md`（gitignore 可选）。

| 模板 | 路径 |
|------|------|
| 新功能 | [templates/feature.md](./templates/feature.md) |
| Bug 修复 | [templates/bugfix.md](./templates/bugfix.md) |
| UI/UX | [templates/ui.md](./templates/ui.md) |
| 导出 | [templates/export.md](./templates/export.md) |
| Tauri 后端 | [templates/tauri-backend.md](./templates/tauri-backend.md) |

## 7. Claude Code 快捷命令

| 命令 | 说明 |
|------|------|
| `/lizhi-feature` | 完整功能流：Plan → Implement → Review |
| `/lizhi-bugfix` | Bugfix 快速通道 |
| `/lizhi-review` | 仅代码审查 |

定义见 `.claude/commands/`。
