# Agent 交接模板

复制以下模板到 `.agent-tasks/<task-slug>/HANDOFF.md` 或粘贴到会话中。

---

## HANDOFF · [任务标题]

**任务 ID**：`TASK-YYYYMMDD-slug`  
**分支**：`feature/xxx` 或 `fix/xxx`  
**日期**：YYYY-MM-DD  
**交出角色** → **接收角色**：Planner → Implementer / Implementer → Reviewer / …

### 背景

（1–3 句：用户要什么、为什么做）

### 已完成

- [ ] 项 1
- [ ] 项 2

### 验收标准

1. …
2. …

### 待决 / 阻塞

| 问题 | 建议 | 需用户决策 |
|------|------|------------|
| … | … | 是/否 |

### 下一步（接收 Agent 指令）

```
（给下一个 Agent 的明确 prompt，含文件路径与命令）
```

### 必读文件

- `path/to/file1`
- `path/to/file2`

### 验证命令

```bash
pnpm dev          # 或 pnpm tauri dev
pnpm build
pnpm test:e2e     # 如适用
```

### 上下文摘要（可选，用于 /compact 或新会话）

> 关键决策、已否决方案、加密/安全注意事项…

---

## 示例：Planner → Implementer

**交出** Planner · **接收** Implementer

**下一步**：

> 实现 WikiLink 自动补全：按 `docs/agent-workflow/templates/feature.md` 中 AC-1~AC-3，修改 `src/composables/useWikiSuggest.ts` 与 `src/components/editor/WikiLinkSuggest.vue`。不要改 Tauri 层。完成后运行 `pnpm build`。

**必读**：`src/extensions/WikiLink.ts`、`src/stores/links.ts`
