# 狸知知识库 · Claude Agent 工作台设计

**文档版本**：v1.0.0  
**更新日期**：2026-07-13  
**状态**：已实现（对齐 jetbrains-cc-gui）  
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
| `~/.lizhi-kb/cc-workbench.json` | `cwdMode`、`projectPath`、供应商列表等 |
| `~/.lizhi-kb/cc-secrets.json` | API Key（仅 Rust 读写） |
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
- **增强提示词**：`CcPromptEnhancerDialog`

---

## 8. 消息与工具展示

| 能力 | 组件 / 模块 | 说明 |
|------|------------|------|
| 用户/AI 头像 | `CcChatMessage` | 左右布局 |
| 思考过程 | 可折叠块 | 与正文分离 |
| 消息 footer | `CcChatMessage` | 模型 · 耗时 · 入/出 token（有 usage 时） |
| 工具块 | `CcToolBlocks` | Read/Write/Bash/Task 等分组展示 |
| Edit diff | `CcEditDiffView` | 点击 Edit 行展开分屏 diff + 语法高亮 |
| Subagent | `CcToolBlocks` + `CcSubagentOutputView` | 可折叠卡片、状态图标、内联输出解析 |
| 工具权限 | `CcToolPermissionDialog` | 待确认时 Toast + 对话框 |
| 状态栏 | `CcStatusPanelBar` | 任务（TodoWrite）/ 子代理 / 编辑 三 Tab |

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

Agents / Skills / 提示词路径遵循 Claude Code 约定（`~/.claude/` 与 `{project}/.claude/`）。

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
| `list_cc_skill_market` | 内置 Skill 市场目录 |
| `preview_cc_switch_import` / `save_cc_switch_import` | CC Switch 配置导入 |

### 10.4 Agents

| Command | 说明 |
|---------|------|
| `list_cc_agents` / `save_cc_agent` / `delete_cc_agent` | CRUD |
| `import_cc_agents` / `export_cc_agents` | 导入/导出（md 多文件 / json） |
| `list_cc_agent_market` | 内置 Agent 市场（6 模板） |

### 10.5 提示词库

| Command | 说明 |
|---------|------|
| `list_cc_prompts` / `save_cc_prompt` / `delete_cc_prompt` | CRUD |
| `import_cc_prompts` / `export_cc_prompts` | 导入/导出 |
| `list_cc_slash_commands` | 内置斜杠命令列表 |

### 10.6 其他

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
const CC_AGENT_SDK_VERSION: &str = "0.3.153";
```

| SDK 包版本 | 内置 Claude Code CLI | 说明 |
|------------|----------------------|------|
| **0.3.153**（当前锁定） | **2.1.153** | 与多数企业 vLLM Anthropic 代理兼容 |
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

## 14. 验收清单（回归）

- [ ] vault 模式：lizhi-mcp 可读写笔记；无 Bash/Read 文件工具
- [ ] project 模式：Bash/Edit 可用；文件上下文 + 附件分离
- [ ] 设置：Agents/Skills/提示词库 创建、导入、导出、市场安装
- [ ] 输入：`@` `#` `!` `/` 补全；占位符与 CC GUI 一致
- [ ] 上下文环非 NaN；有 usage 时 footer 显示 token
- [ ] Subagent 工具块可折叠；Edit 可展开 diff
- [ ] `pnpm verify` 零 warning

---

## 15. 已知限制

| 项 | 说明 |
|----|------|
| OAuth / Claude 订阅 | 不支持 |
| 捆绑 Node.js | 需用户本机 Node |
| vault 明文镜像 | 不做 |
| Agent ZIP 打包导出 | 当前 md/json |
| 市场远程 catalog | 内置 JSON，可 `LIZHI_CC_*_MARKET` 环境变量覆盖 |
| 部分网关无 usage | 上下文环 / token footer 可能为空 |

---

## 16. 变更记录

| 版本 | 日期 | 摘要 |
|------|------|------|
| v0.1.1 | 2026-07-10 | POC：基础对话、SDK 安装、vault/project cwd |
| v1.0.0 | 2026-07-13 | 对齐 CC GUI：多供应商、Agents/Skills/提示词库、市场、附件、上下文环、Subagent/Edit 可视化、usage 统计 |
