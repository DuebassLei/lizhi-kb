# 任务模板 · Bug 修复

## 元信息

| 字段 | 值 |
|------|-----|
| 类型 | bugfix |
| 严重度 | P0 / P1 / P2 |
| 复现环境 | 浏览器 / Tauri 桌面 / 两者 |

## 现象

（实际行为 vs 期望行为）

## 复现步骤

1. …
2. …

## 根因假设（Debugger 填写）

| 假设 | 验证方式 | 结果 |
|------|----------|------|
| … | … | 确认/排除 |

## 修复范围

- **改**：`path/to/file`
- **不改**：（避免 scope creep）

## 验收标准

- [ ] 复现步骤不再触发 bug
- [ ] `pnpm build` 通过
- [ ] 回归：相关 E2E / 手动场景

## Agent 编排（Hotfix）

```
Debugger（复现 + 根因）→ Implementer（最小 diff）→ Reviewer（安全）→ Ship
```

## 验证

```bash
pnpm dev          # 或 pnpm tauri dev
pnpm build
pnpm test:e2e     # 如有对应 spec
```
