# 狸知知识库 · Claude Agent 工作台设计

**文档版本**：v1.0.2  
**更新日期**：2026-07-13  
**状态**：已实现（v1.0.2 对齐 jetbrains-cc-gui，2026-07-13）  
**对齐基准**：jetbrains-cc-gui（后续新功能按需增量对齐，见 §17）  
**关联**：[2026-07-10-cc-input-model-provider-design.md](./2026-07-10-cc-input-model-provider-design.md)、[2026-07-08-lizhi-ai-chat-design.md](./2026-07-08-lizhi-ai-chat-design.md)

---

## 1. 目标

在狸知内提供 **独立的 Claude Agent 工作台**，完整使用 Claude Code 生态能力（Skills、Agents、MCP、Subagent、Hooks、提示词库），与现有 **AI 助手三模式**（闲聊 / 知识库 / 笔记助手）并列，**不替代、不合并**。

用户可见品牌文案：**Agent 工作台**（避免 Claude Code 商标元素）。

---

## 2. 与 AI Chat 的边界

| 能力 | AI 助手 | Agent 工作台 |
|------|---------|--------------|
| 运行时 | Rust `ai/*` | Node `ai-bridge` + Agent SDK |
| 模型 | Ollama + 多云 OpenAI 兼容 | Anthropic API Key / 自定义 Anthropic 兼容网关 |
| 笔记访问 | Rust 域工具 / FTS RAG | vault 模式：**lizhi-mcp** |
| Skills / 用户 MCP | 不支持 | **完整支持** |
| Subagent / Bash / Edit | 不支持 | **仅本地项目模式** |
| 多供应商切换 | 单配置 | **多供应商 + 会话内切换** |
| 思考过程 | 部分模型支持 | SDK 流式 + 可折叠展示 |

---

## 3. 工作目录策略（vault 加密硬约束）

笔记落盘为 `{id}.md.enc`，Claude Code 文件工具**无法**直接读写密文。

| 模式 | cwd | 笔记访问 | 内置文件工具 |
|------|-----|----------|-------------|
| **vault（默认）** | `~/.lizhi-kb/` | 仅 **lizhi-mcp**（自动注入 token） | 禁用 Read/Edit/Write/Bash/Glob/Grep |
| **project** | 用户选择文件夹 | 文件工具 + 可选 lizhi-mcp | 完整 Claude Code 预设工具 |

vault 模式下 `strictMcpConfig: true`，仅加载预置 `lizhi-kb` MCP。

---

## 4. 架构

```
CcWorkbenchView (Vue)
    → ccWorkbenchService → Tauri IPC
        → cc_workbench/* (Rust)
            → spawn node packages/ai-bridge/channel-manager.js
                → ~/.lizhi-kb/dependencies/claude-sdk/ (按需 npm install)
                    → Claude Agent SDK → CLI 子进程
                        → MCP: lizhi-mcp → HTTP Bridge → DocumentService
```

- SDK **不**打入安装包；桥接脚本随应用分发（`src-tauri/resources/ai-bridge`，与 `packages/ai-bridge` 同步）。
- 流式事件经 Tauri Channel 推送，类型与 AI Chat `StreamEvent` 对齐并扩展（`usage`、`toolPermission` 等）。

---

## 5. 配置与数据路径

| 路径 | 说明 |
|------|------|
| `~/.lizhi-kb/cc-workbench.json` | `cwdMode`、`projectPath`、供应商列表、`promptEnhancer`、`agentMarketUrl` / `skillMarketUrl` 等 |
| `~/.lizhi-kb/cc-secrets.json` | API Key（仅 Rust 读写） |
| `~/.lizhi-kb/cc-usage.json` | 用量统计（按模型/供应商聚合，可配置单价估算） |
| `~/.lizhi-kb/dependencies/claude-sdk/` | 按需安装的 Agent SDK（**版本锁定**，见 §12） |
| `~/.claude/agents/` | 全局 Agents（`.md`） |
| `{project}/.claude/agents/` | 项目 Agents |
| `~/.claude/prompts/` | 全局提示词（`.md` / `.txt`） |
| `{project}/.claude/prompts/` | 项目提示词 |
| `~/.claude/skills/` | 全局 Skills |
| `{project}/.claude/skills/` | 项目 Skills |
| `~/.claude.json` | MCP 服务器配置 |
| `~/.claude/settings.json` | Hooks / env（LOCAL 供应商） |
| `~/.claude/CLAUDE.md` | 全局 CLAUDE.md |

会话 UI 状态（历史、选中模型、权限模式等）持久化于 `vault-ui-state.json`（Tauri 双写 localStorage）。

---

## 6. 路由与页面结构

| 路由 | 组件 | 说明 |
|------|------|------|
| `/cc-workbench` | `CcWorkbenchView` | 主工作台（侧栏「Agent 工作台」） |
| 设置（内嵌） | `CcWorkbenchSettingsShell` | 独立设置壳，侧栏 Tab 导航 |

**不**修改 `AiChatShell` / `AiChatMode`。

### 6.1 主界面布局

```
┌─────────────────────────────────────────────────────────┐
│ 会话标题 / 历史抽屉                                        │
├──────────────────────────────┬──────────────────────────┤
│ 消息流（头像、思考、工具块）     │ 可选分栏：Edit Diff /     │
│                              │ Subagent 详情             │
├──────────────────────────────┴──────────────────────────┤
│ 状态栏：任务 | 子代理 | 编辑                               │
├─────────────────────────────────────────────────────────┤
│ 顶栏：📎 附件 | 上下文环 % | │ | 文件上下文 | 项目 badge   │
│ 输入区：@ # ! / 补全 + 底栏（权限/供应商/模型/effort）       │
└─────────────────────────────────────────────────────────┘
```

---

## 7. 聊天输入栏（对齐 CC GUI）

### 7.1 顶栏工具行

| 控件 | 行为 |
|------|------|
| **📎 回形针** | **添加附件**（系统文件选择；图片可缩略图预览） |
| **上下文环** | 显示 `X%`；tooltip：`X% · Yk / Zk 上下文`；数据来自 SDK `getContextUsage()` + 流式 `usage` |
| **文件上下文** | 打开 `CcFileContextPicker`（vault 文档 / 项目目录文件） |
| **项目 badge** | 本地项目路径摘要（project 模式） |

附件与文件上下文**分离**：附件经 `【消息附件】` 段传入 prompt；文件上下文经 `openedFiles` + `@path` chip 注入。

### 7.2 输入触发符

| 符号 | 占位符文案 | 行为 |
|------|-----------|------|
| `@` | 引用文件 | 补全文件路径，加入 openedFiles |
| `#` | 唤起智能体 | 选择 Agent（不写 `#` 进正文） |
| `!` | 插入提示词 | 从提示词库插入模板正文 |
| `/` | （行首） | 内置斜杠命令（`/review` 等） |
| Enter | 发送 | 提交消息 |

占位符：`@引用文件，#唤起智能体，!插入提示词，Enter 发送`

### 7.3 底栏控件

顺序（见 [输入栏模型设计](./2026-07-10-cc-input-model-provider-design.md)）：

```
[✨ 增强] [⚡ 思考] | [权限模式 ▾] [供应商 ▾] [模型 ▾] [effort ▾] | [发送]
```

- **权限模式**：默认 / 跳过确认 / 仅规划 等，单行说明不换行
- **供应商 / 模型**：会话内切换；1M 上下文 Switch；自定义模型
- **增强提示词**：`CcPromptEnhancerDialog`；受 `promptEnhancer.enabled` 控制显示；`autoTrigger` 时发送前自动增强（失败 toast，继续原文）
- **模型搜索 / 图标**：模型下拉内搜索；供应商与模型图标见 `ccProviderIcons.ts`
- **自定义模型定价**：添加时可填 input/output 单价（USD/1M tok），供用量 Tab 估算

配置项 `promptEnhancer`（`cc-workbench.json`）：

| 字段 | 说明 |
|------|------|
| `enabled` | 是否显示 ✨ 增强按钮（默认 true） |
| `autoTrigger` | 发送前自动增强（实验性） |
| `systemPrompt` | 自定义增强 system prompt；留空则用 ai-bridge 内置默认 |

修改 `packages/ai-bridge` 后须同步：`node scripts/sync-ai-bridge-resources.mjs`

---

## 8. 消息与工具展示

| 能力 | 组件 / 模块 | 说明 |
|------|------------|------|
| 用户/AI 头像 | `CcChatMessage` | 左右布局 |
| 思考过程 | 可折叠块 | 与正文分离 |
| 消息 footer | `CcChatMessage` | 模型 · 耗时 · 入/出 token（有 usage 时） |
| 工具块 | `CcToolBlocks` | Read/Write/Bash/Task 等分组展示 |
| Edit diff | `CcEditDiffView` | 点击 Edit 行展开分屏 diff + 语法高亮 |
| Subagent | `CcToolBlocks` + `CcSubagentOutputView` | 可折叠卡片、状态图标、内联输出；耗时来自 tool `startedAt` / `completedAt` |
| 工具权限 | `CcToolPermissionDialog` | 待确认时 Toast + 对话框 |
| 状态栏 | `CcStatusPanelBar` | 任务（TodoWrite）/ 子代理 / 编辑 三 Tab；编辑 Tab 支持保留全部 / 丢弃全部 / 撤销（项目模式 git checkout） |
| PPT 澄清表单 | `CcClarifyForm` | 解析 `lizhi-clarify` JSON 块（如 guizang-ppt 智能体） |

---

## 9. 设置页（CcWorkbenchSettingsShell）

侧栏 Tab（`CcSettingsSidebar`）：

| Tab | 组件 | 能力 |
|-----|------|------|
| 基础 | — | 总览、快捷操作 |
| 供应商 | `CcProviderList` | 多供应商 CRUD、激活、测试 |
| SDK 依赖 | `CcSdkSection` | Node / bridge / SDK 安装状态 |
| 工作目录 | — | vault / project 模式、项目路径 |
| **Agents** | `CcAgentsSection` | 全局/项目 CRUD；**导入/导出**（skip/overwrite/rename）；**市场**（`CcAgentMarketPanel`） |
| **Skills** | `CcSkillsSection` | 启用/禁用；导入/导出；**市场**（`CcSkillMarketPanel`） |
| **提示词库** | `CcPromptsSection` | 全局/项目 CRUD；导入/导出（md/json）；空状态「暂无自定义提示词 创建」 |
| MCP 服务器 | `CcMcpServersSection` | `~/.claude.json` 管理 |
| Hooks | `CcHooksSection` | settings.json hooks |
| CLAUDE.md | `CcClaudeMdSection` | 全局 CLAUDE.md 编辑 |
| **权限** | `CcPermissionsSection` | 编辑 `~/.claude/settings.json` 的 permissions |
| **用量** | `CcUsageStatsSection` | 读取 `cc-usage.json`；按模型统计与费用估算 |
| **增强** | `CcEnhancedPromptSection` | `promptEnhancer` 开关、autoTrigger、自定义 system prompt |

Agents / Skills / 提示词路径遵循 Claude Code 约定（`~/.claude/` 与 `{project}/.claude/`）。

**导入冲突**：Agents / Skills / 提示词库导入前调用 `preview_cc_*_import`，由 `CcImportConflictDialog` 选择 skip / overwrite / rename。

---

## 10. Tauri Commands（已实现）

### 10.1 核心运行时

| Command | 说明 |
|---------|------|
| `get_cc_workbench_status` | Node / SDK / bridge / MCP 就绪状态 |
| `get_cc_workbench_config` / `set_cc_workbench_config` | 配置与 API Key |
| `install_cc_sdk` | 安装锁定版本 SDK |
| `cc_workbench_send` | 流式对话 |
| `cc_workbench_abort` | 中止生成 |
| `cc_workbench_tool_permission_response` | 工具权限应答 |
| `cc_workbench_test_model` | 模型连通测试 |
| `cc_workbench_enhance_prompt` | 提示词增强 |

### 10.2 供应商

| Command | 说明 |
|---------|------|
| `upsert_cc_provider` / `delete_cc_provider` / `switch_cc_provider` / `sort_cc_providers` | 多供应商管理 |

### 10.3 Skills

| Command | 说明 |
|---------|------|
| `list_cc_skills` / `toggle_cc_skill` / `delete_cc_skill` / `import_cc_skills` / `open_cc_skill` | Skills 管理 |
| `preview_cc_skills_import` | Skills 导入 dry-run |
| `list_cc_skill_market` | 内置 Skill 市场目录 |
| `preview_cc_switch_import` / `save_cc_switch_import` | CC Switch 配置导入 |

### 10.4 Agents

| Command | 说明 |
|---------|------|
| `list_cc_agents` / `save_cc_agent` / `delete_cc_agent` | CRUD |
| `import_cc_agents` / `export_cc_agents` | 导入/导出（md / json / **zip**） |
| `preview_cc_agents_import` | 导入 dry-run 预览 |
| `list_cc_agent_market` | 内置 Agent 市场 |
| `fetch_cc_market_catalog` | 远程市场 catalog（URL 或 env） |

### 10.5 提示词库

| Command | 说明 |
|---------|------|
| `list_cc_prompts` / `save_cc_prompt` / `delete_cc_prompt` | CRUD |
| `import_cc_prompts` / `export_cc_prompts` | 导入/导出 |
| `preview_cc_prompts_import` | 提示词导入 dry-run |
| `list_cc_slash_commands` | 内置斜杠命令列表 |

### 10.6 用量与 Git

| Command | 说明 |
|---------|------|
| `append_cc_usage_entry` | 追加单次对话用量 |
| `get_cc_usage_stats` | 聚合统计 |
| `cc_workbench_git_status` | 项目 Git 状态 |
| `cc_workbench_git_diff` | staged/unstaged diff |
| `cc_workbench_git_undo_edits` | 按路径 git checkout 撤销 Agent 编辑 |

### 10.7 其他

| Command | 说明 |
|---------|------|
| `list_cc_mcp_servers` / `upsert_cc_mcp_server` / … | MCP |
| `get_cc_claude_md` / `save_cc_claude_md` | CLAUDE.md |
| `get_cc_hooks` / `save_cc_hooks` | Hooks |
| `list_cc_context_files` | 文件上下文候选列表 |

---

## 11. 上下文与 Token 统计

数据流：

```
SDK stream → emitUsageFromRecord + getContextUsage()
  → stdout JSON → Rust parse_bridge_line
  → Tauri Channel usage 事件
  → ccWorkbench store → CcTokenIndicator / CcChatMessage footer
```

- **上下文环**：`contextPercentage` = used / max（1M 模型时 max=1_000_000）
- **消息 footer**：`modelLabel · 耗时 · 入 Xk · 出 Yk · 合计 Zk`
- 自定义网关若不回 usage，环保持 0%、footer 仅显示耗时

---

## 12. SDK 版本与 vLLM 网关兼容

### 12.1 版本锁定

常量见 `src-tauri/src/cc_workbench/runtime.rs`：

```rust
const CC_AGENT_SDK_VERSION: &str = "0.3.209";
```

| SDK 包版本 | 内置 Claude Code CLI | 说明 |
|------------|----------------------|------|
| 0.3.153 | 2.1.153 | 旧锁定：规避部分企业 vLLM 对 `role: system` 的 400 |
| **0.3.209**（当前锁定） | **≈2.1.209** | 支持同消息叠多个 Skills（CLI ≥ 2.1.199）；需网关接受 system 角色（如 vLLM 0.23.0+） |
| 0.3.154+ | 2.1.154+ | CLI 在 `messages[]` 发送 `role: system`，旧网关可能 400 |

### 12.2 供应商 Base URL

`ANTHROPIC_BASE_URL` **不要**包含 `/v1/messages`。规范化见 `claude-query-shared.js`、`config.rs`。

### 12.3 维护者升级清单

- [ ] 目标网关回归无 `messages[].role == system` 400
- [ ] 更新 `CC_AGENT_SDK_VERSION` 与安装提示
- [ ] 同步 `formatBridgeError` 兼容版本号
- [ ] 回归：Windows 路径、`settingSources: []`、usage/context 统计

---

## 13. 前端目录约定

```
src/
├── views/CcWorkbenchView.vue
├── components/cc/
│   ├── CcWorkbenchShell.vue
│   ├── CcWorkbenchSettingsShell.vue
│   ├── CcWorkbenchSplitPanel.vue
│   ├── chat/          # 输入、消息、工具块、状态栏
│   └── settings/      # 各设置 Tab 区块
├── stores/ccWorkbench.ts
├── services/ccWorkbenchService.ts
├── composables/cc/    # useCcInputCompletions, useCcStatusPanel, …
└── utils/             # ccChatModels, ccModelCatalog, ccAttachments, …
src-tauri/src/cc_workbench/
packages/ai-bridge/    # 与 resources/ai-bridge 同步
```

---

## 14. 已实现能力清单（v1.0.2）

以下已在代码中落地；发版或大改后建议人工回归：

- [x] vault 模式：lizhi-mcp 读写笔记；禁用内置文件/Bash 工具
- [x] project 模式：Bash/Edit 可用；文件上下文与附件分离
- [x] 设置：Agents/Skills/提示词库 CRUD、导入预览、导出（含 Agent ZIP）、内置/远程市场
- [x] 设置：权限 / 用量 / 增强提示词 Tab
- [x] 输入：`@` `#` `!` `/` 补全；供应商/模型/1M/权限/effort 底栏（见输入栏 spec）
- [x] 模型搜索、供应商/模型图标、自定义模型 JSON 导入导出、per-model 1M、定价字段
- [x] 上下文环与消息 footer token（有 usage 时）
- [x] Subagent 卡片 + 真实耗时；Edit diff 分屏；状态栏编辑批处理 / git 撤销
- [x] Commit AI（项目模式 + Git 顶栏入口）
- [x] 提示词增强：自定义 system prompt 贯通 bridge；enabled / autoTrigger
- [x] 顶栏 Node / ai-bridge 进程管理（登记 + 孤立扫描；见 [进程管理 spec](./2026-07-14-cc-bridge-process-manager-design.md)）
- [x] `pnpm verify` 零 warning（合并门禁）

**尚未覆盖 / 按需对齐**：OAuth、Codex/Gemini 供应商、捆绑 Node、官方交流群、CC GUI 后续新增 UI（见 §17）。

---

## 15. 已知限制

| 项 | 说明 |
|----|------|
| OAuth / Claude 订阅 | 不支持 |
| Codex / Gemini 供应商 | 不支持 |
| 捆绑 Node.js | 需用户本机 Node |
| vault 明文镜像 | 不做 |
| Agent 导出 | 支持 md / json / **zip** |
| 市场 catalog | 内置 JSON；`cc-workbench.json` 的 `agentMarketUrl` / `skillMarketUrl` 或 `LIZHI_CC_*_MARKET` 环境变量 |
| 导入冲突 | Agents / Skills / 提示词库支持 dry-run 预览 |
| 工具权限 | 通过设置「权限」Tab 编辑 `~/.claude/settings.json` permissions |
| 用量统计 | `~/.lizhi-kb/cc-usage.json`；自定义模型可配置单价估算费用 |
| Commit AI | 仅项目模式 + Git 仓库；基于 diff + 提示词增强 |
| 编辑批处理 | Keep All 为 UI 确认；Discard All / Undo 走 git checkout（仅 project + Git 仓库） |
| 部分网关无 usage | 上下文环 / token footer 可能为空 |
| 历史会话 | 旧消息无 tool 时间戳时，子代理耗时可能为空 |
| Windows Rust 构建 | 需 `OPENSSL_DIR` 指向 OpenSSL 安装目录 |

---

## 16. 变更记录

| 版本 | 日期 | 摘要 |
|------|------|------|
| v0.1.1 | 2026-07-10 | POC：基础对话、SDK 安装、vault/project cwd |
| v1.0.0 | 2026-07-13 | 对齐 CC GUI：多供应商、Agents/Skills/提示词库、市场、附件、上下文环、Subagent/Edit 可视化、usage 统计 |
| v1.0.1 | 2026-07-13 | 导入预览、权限/用量/增强 Tab、ZIP 导出、编辑批处理、远程市场、Commit AI、模型定价 |
| v1.0.2 | 2026-07-13 | 增强 system prompt 贯通 bridge；autoTrigger；子代理真实耗时；文档与对齐流程定稿 |

---

## 17. CC GUI 后续对齐流程

jetbrains-cc-gui 持续演进时，**不自动追平**；由产品/用户点名新功能后再做增量对齐。

### 17.1 触发方式

用户说明「CC GUI 新增了 X，帮我对齐」→ Agent 按本 spec 与 [输入栏 spec](./2026-07-10-cc-input-model-provider-design.md) 做差距分析 → Plan 确认 → Implement。

### 17.2 对齐步骤（Implementer  checklist）

1. **调研**：对照 CC GUI 行为/截图/版本说明，列出与狸知差距（UI、IPC、bridge、配置字段）。
2. **更新 spec**：在本文件 §14 增删项，必要时增补 §7–§10；版本号 + 变更记录。
3. **实现**：优先垂直切片（Vue → `ccWorkbenchService` → Rust → `packages/ai-bridge`）。
4. **bridge 同步**：改 `packages/ai-bridge` 后执行 `node scripts/sync-ai-bridge-resources.mjs`。
5. **验证**：`pnpm verify:fe`；Tauri/IPC 变更时 `cargo check` + `pnpm tauri dev` 冒烟。
6. **文档**：同步 `AGENTS.md` / `complete-design` 索引（若路由或数据路径变化）。

### 17.3 刻意不做（除非 spec 修订）

OAuth 登录、Codex/Gemini 供应商、安装包捆绑 Node、vault 明文镜像、与 AI 助手合并。

### 17.4 差距追踪（待对齐项）

| 功能 | 状态 | 备注 |
|------|------|------|
| Node / ai-bridge 进程管理 | **已实现** | 精简版 A2；见 [2026-07-14-cc-bridge-process-manager-design.md](./2026-07-14-cc-bridge-process-manager-design.md) |
| CC GUI 新功能 | **按需** | 用户点名后填入上表并开 Plan |
| CC Workbench E2E | 待补 | 无专项 Playwright；大改时建议补 |
