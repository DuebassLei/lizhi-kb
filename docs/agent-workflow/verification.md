# 验证门禁 · 零警告编译

> SSOT：合并前与 Agent **Verify** 阶段必须满足本页要求。

## 原则

1. **项目源码零警告** — `src/`、`packages/`、`src-tauri/` 不允许带着 `warning` 合并或交接
2. **第三方依赖除外** — `node_modules` 内包的 warning 不纳入门禁，升级依赖时再评估
3. **类型零错误** — TypeScript `vue-tsc`、Rust `clippy` 必须通过
4. **先本地 `pnpm verify`，再 PR / 用户验收**

## 命令

| 命令 | 范围 | 何时运行 |
|------|------|----------|
| `pnpm verify` | vue-tsc 后 Vite 与 MCP 并行，再 sync、clippy、test | **合并前必跑**；Implementer / Reviewer 完成标准 |
| `pnpm build` | vue-tsc 后 Vite 与 MCP 并行，再 sync | 日常前端迭代 / Tauri beforeBuild |
| `pnpm verify:fe` | vue-tsc → Vite（不含 MCP / Rust） | 只改 `src/` 时 |
| `pnpm verify:rust` | 仅 Rust | 只改 `src-tauri/` 时 |

```bash
pnpm verify          # 完整门禁（推荐）
pnpm verify:fe
pnpm verify:rust
pnpm test:unit       # 单元测试（CI 另跑）
pnpm test:e2e        # 流程变更时
pnpm tauri dev       # Tauri/IPC 手动验证
```

## 工具链约束

### 前端（Vue / Vite / TS）

- `tsconfig.json`：`strict`、`noUnusedLocals`、`noUnusedParameters`
- `vite build`：Rollup `onwarn` 遇**项目源码**（`src/`、`packages/`）警告即失败；**`node_modules` 一律忽略**
- 禁止用 `@ts-ignore` / 空 `eslint-disable` 等方式掩盖问题（无 ESLint 时靠 TS + 零警告构建）

### Rust（Tauri）

- `src-tauri/.cargo/config.toml`：`rustflags = ["-Dwarnings"]`（编译/测试/clippy 均视为错误）
- 无用 `use`、未使用变量、deprecated 等必须在提交前清理
- 仅本地 OpenSSL 路径配置使用 `config.toml.example` 复制为 `config.toml`（勿提交个人路径）

### MCP 包

- `packages/lizhi-mcp`：`tsc` strict + `noUnusedLocals` / `noUnusedParameters`

## Agent 完成标准

**Implementer** 交接 Reviewer 前：

- [ ] `pnpm verify` 通过（项目源码无 warning）
- [ ] 任务相关手动 / E2E 验证通过

**Reviewer** 阻塞项：

- 验证命令失败或 diff 可能引入新的编译警告

## CI

`.github/workflows/ci.yml` 在 PR / main 上运行：

| Job | 内容 |
|-----|------|
| `check` | `pnpm verify` + `pnpm test:unit` |
| `e2e-smoke` | Playwright 冒烟子集（Word 导出 + workspace 基础 + trash）；失败不阻塞 nightly 全量 |

夜间 / 手动全量 E2E：`.github/workflows/e2e-nightly.yml`（`pnpm test:e2e`）。

本地 `pnpm verify` / `pnpm build`：先 `vue-tsc`，再并行 `vite build` 与 `build:mcp`（避免 tsc 与 Vite 双重量级争抢导致总时长不降反升）。

流程/UI 大改时请在本地补跑相关 E2E；Agent 工作台等路由专项见 [CC Workbench §17.4](../superpowers/specs/2026-07-10-cc-workbench-design.md#174-差距追踪待对齐项)。

## 常见警告处理

| 来源 | 处理方式 |
|------|----------|
| Rust `unused import` | 删除或 `cargo fix` |
| TS 未使用变量 | 删除或重构；勿留 dead code |
| Vite chunk 过大 | 优先 dynamic import；确需大包时评估并更新 `chunkSizeWarningLimit`（需 PR 说明） |
| Rollup 循环依赖（`src/`、`packages/`） | 动态 import 或拆模块；Vue 递归组件勿 self-import |
| 第三方包 warning（`node_modules`） | **不处理**；非项目维护范围 |
| Vite `PLUGIN_WARNING`（chunk 拆分提示） | **不处理**；常为 dynamic import 解 cycle 的副作用 |
