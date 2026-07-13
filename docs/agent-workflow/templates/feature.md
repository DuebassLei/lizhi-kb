# 任务模板 · 新功能

> SSOT：`docs/agent-workflow/templates/feature.md`  
> 工作副本：`.agent-tasks/<slug>/TASK.md`

---

## 元信息

| 字段 | 值 |
|------|-----|
| 类型 | feature |
| 版本目标 | v1.0 / v1.5 / v1.8 |
| Spec 引用 | `docs/superpowers/specs/...` |
| 涉及层 | 前端 / Tauri / 两者 |

## 用户故事

作为 [角色]，我希望 [能力]，以便 [价值]。

## 验收标准

- [ ] AC-1：…
- [ ] AC-2：…
- [ ] AC-3：`pnpm verify` 通过（零警告编译）
- [ ] AC-4：相关 E2E 通过（如适用）

## 垂直切片（ tracer bullet ）

优先交付端到端最小路径，而非「先全部后端再全部前端」：

1. **切片 1**：…（可演示）
2. **切片 2**：…
3. **切片 3**：…

## 技术要点（lizhi-kb）

### 前端

- 组件放 `src/components/<domain>/`
- 状态：`src/stores/`（Pinia）
- 路由：见 `src/router/`（Workspace 内视图切换优先于新路由）
- 样式：`src/styles/tokens.css` + Tailwind

### Tauri（如需要）

- Command 定义：`src-tauri/src/`
- 前端调用：`composables/useTauriCommand.ts`
- 权限：`src-tauri/capabilities/`

### 安全

- [ ] 无密钥/明文写入日志或前端存储
- [ ] 用户内容渲染防 XSS

## Agent 编排

```
Planner（本模板 + spec）→ 用户确认
  → Implementer（按切片）
  → Reviewer
  → Verify（verify + e2e）
```

## 验证

```bash
pnpm dev
pnpm verify
pnpm test:e2e   # 新增/变更流程时
```
