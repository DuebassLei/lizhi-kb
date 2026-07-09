# 狸知知识库 M0 — Vue 3 脚手架与 Spike 计划

**日期**：2026-07-06  
**产品**：狸知知识库 · Lizhi Knowledge  
**前提**：单人主导 · Vue 3 · Tauri 2  

---

## 1. 初始化命令

```bash
# 需已安装 Rust、Node 20+、pnpm
# 已有项目在本目录执行；新建时：
pnpm create tauri-app lizhi-kb --template vue-ts
cd lizhi-kb
pnpm install

# 核心依赖
pnpm add pinia vue-router @tauri-apps/api
pnpm add @tiptap/vue-3 @tiptap/starter-kit @tiptap/extension-link @tiptap/pm
pnpm add -D tailwindcss @tailwindcss/vite
```

开发：

```bash
pnpm tauri dev
```

本地数据目录（Rust 侧约定）：`~/.lizhi-kb/`

---

## 2. M0 周期（5 工作日）

| 天 | 任务 | 验收 |
|----|------|------|
| D1 | Tauri 项目初始化、目录按 complete-design §4.7 搭建、Pinia + Router 空壳 | `tauri dev` 可跑，三屏路由可切换 |
| D2 | Rust：`create_vault` / `unlock_vault` / 单文件 AES 读写 POC | 错误密码无法解密 |
| D3 | TipTap Vue：基础 MD + `WikiLink` 扩展 + `[[` 补全弹层 | 输入 `[[` 50ms 内出建议 |
| D4 | Vue Flow：3 个 MD 卡片节点 + 拖拽 + 缩放 | 拖拽 ≥ 55fps |
| D5 | 整合：Unlock → Workspace 读一篇加密 MD → 编辑 → 保存 | 锁定后 Pinia/editor 无正文 |

**M0 失败则不上 M1**：若 D3 TipTap 双链体验不达标，允许降级为「源码模式优先 + 简版 WYSIWYG」并更新 spec。

---

## 3. TipTap WikiLink 扩展要点

```typescript
// extensions/WikiLink.ts — 概念结构
// - inline node 或 mark，渲染为 [[title]]
// - onUpdate 扫描文档，emit 'links-changed' 供 Rust 增量写 links 表
// - suggest 模式：监听 '[' 触发 useWikiSuggest(query)
```

---

## 4. Tauri invoke 封装（Vue 侧）

```typescript
import { invoke } from '@tauri-apps/api/core'

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (e) {
    throw e // 映射为 UI：VAULT_LOCKED | WRONG_PASSWORD | IO_ERROR
  }
}
```

---

## 5. 与 HTML 原型的映射

| 原型屏 | Vue View |
|--------|----------|
| ⓪ 引导 | `WelcomeView.vue` |
| ① 解锁 | `UnlockView.vue` |
| ② 工作区 | `WorkspaceView.vue` + editor/* |
| ③ 图谱 | `LocalGraphView.vue` |
| ④ 洞察 | `InsightsView.vue` |
| ⑤ 设置 | `SettingsView.vue` |

原型 CSS token 迁移至 `src/styles/tokens.css`（含 `--paw: #d4a574`）。

---

## 6. Vue 编码约定

- 全部 SFC 使用 `<script setup lang="ts">`
- View 只做组合，逻辑进 `composables/` 或 `stores/`
- 窗口标题：`文档名 — 狸知`；关于页显示 **狸知知识库**

---

**M0 完成后**：代码置于 `lizhi-kb/`，README 标题为「狸知知识库 Lizhi Knowledge」。
