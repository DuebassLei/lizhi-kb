---
paths:
  - "src/**"
---

# Vue 前端规则

与 Cursor 规则 `.cursor/rules/vue-frontend.mdc` 语义一致。SSOT 说明见 `docs/agent-workflow/sync-strategy.md`。

## 结构

- 组件 `src/components/<domain>/` · 视图 `src/views/` · Pinia `src/stores/`
- TipTap 编辑器 · WikiLink 扩展 · 局部图谱（Workspace 内嵌 SVG）

## 约定

- Composition API + `<script setup lang="ts">`
- Token：`src/styles/tokens.css` + Tailwind 4
- 产品 IA 路由见 AGENTS.md，勿照搬 prototype 七屏
- **删除须二次确认**：破坏性删除用 `ConfirmDialog`；新代码勿新增裸 `window.confirm` / 一键删除

## 验证

`pnpm dev` · `pnpm verify` · `pnpm build`（零警告 Vite 配置）
