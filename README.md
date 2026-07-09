# 狸知知识库 · Lizhi Knowledge

> 你的加密知识库，猫一样安静。

本地优先、端到端加密的**个人知识库**桌面应用。技术栈：Tauri 2 + Rust + Vue 3 + Pinia + Tailwind 4。

## 核心能力

| 类别 | 能力 |
|------|------|
| **安全存储** | Argon2id + AES-256-GCM 加密库；主密码解锁；可选启动锁定 |
| **写作** | CodeMirror 6 Markdown 编辑器；分栏预览；Wiki 双链 `[[标题]]`；剪贴板粘贴图片 |
| **知识组织** | 文件夹树；文档标签；置顶 / 最近；局部知识图谱 |
| **看板** | 编辑热力图（贪吃蛇动画）；需求看板；每日小记 |
| **AI** | 本地 Ollama / 云端 API（含 Agnes AI 等预设）；RAG 检索；Agent 工具调用 |
| **集成** | MCP 服务（`lizhi-mcp`）；凭证库（开发中） |
| **导出** | Markdown / PDF / HTML；按文件夹导出；微信公众号主题预览 |
| **备份** | `.lizhi` 完整备份；整库恢复 / 合并设置 / 合并文档；Markdown 迁移导出 |

## 前置要求

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)（运行 `pnpm tauri dev` 需要）

### Windows 额外步骤（SQLCipher / OpenSSL）

默认 feature `sqlcipher` 会通过 `bundled-sqlcipher` 从源码编译 SQLCipher，**Windows 上需要系统 OpenSSL**（macOS 使用 CommonCrypto，Linux 通常已有 `libssl-dev`）。

1. 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（「使用 C++ 的桌面开发」工作负载）
2. 安装 OpenSSL **Dev 版**（含 `include/` 与 `libcrypto.lib`，Light 版仅运行时、无法编译）：

```powershell
winget install ShiningLight.OpenSSL.Dev
```

3. 若安装路径非默认，在 PowerShell 中设置（或写入用户环境变量）：

```powershell
$env:OPENSSL_DIR = "C:\Program Files\OpenSSL-Win64"
$env:OPENSSL_LIB_DIR = "C:\Program Files\OpenSSL-Win64\lib\VC\x64\MD"
```

推荐复制 `src-tauri/.cargo/config.toml.example` 为 `config.toml`（已含 `OPENSSL_LIB_DIR`）。若此前链接失败，请执行一次 `cargo clean -p libsqlite3-sys` 后重试。或运行：

```powershell
.\scripts\setup-windows-build.ps1 -TauriDev
```

> **开发回退**（仅本地调试，vault 无加密）：`cargo build --no-default-features --features plain-sqlite`

## 开发

```bash
# 仅前端（浏览器预览，无需 Rust）
pnpm dev

# 完整桌面应用
pnpm tauri dev

# E2E 测试（国内请用镜像安装浏览器，勿用官方 CDN）
pnpm playwright:install
pnpm test:e2e
```

## 打包与发版

### 本地打包（Windows）

```powershell
pnpm tauri build
```

产物：`src-tauri/target/release/bundle/msi/*.msi`、`nsis/*.exe`

> **中文应用名**：`productName` 含中文时，MSI 需使用 `bundle.windows.wix.language: "zh-CN"`（已配置），否则 WiX `light.exe` 会因代码页 1252 报错。

### 云端多平台打包（GitHub Actions）

工作流：[`.github/workflows/build-release.yml`](.github/workflows/build-release.yml)

| 平台 | 产物 |
|------|------|
| Windows | `.msi`、`.exe`（NSIS） |
| macOS | `.dmg`、`.app` |
| Linux | `.deb`、`.AppImage` |

**手动触发**：GitHub → Actions → **Build Release** → Run workflow → 各 job 的 Artifacts 下载。

**正式发布**（同步创建 GitHub Release）：

```bash
# 发版前对齐 package.json、src-tauri/Cargo.toml、src-tauri/tauri.conf.json 的 version
git tag v0.1.0
git push origin v0.1.0
```

推送 `v*` 标签后，三平台并行构建，完成后产物出现在 **Releases** 页面。

> v0.1 未配置代码签名；macOS/Windows 安装时可能出现系统安全提示，功能不受影响。

## 项目结构

```
lizhi-kb/
├── src/                  Vue 3 前端
├── src-tauri/            Tauri / Rust 后端
├── docs/
│   ├── agent-workflow/   多 Agent 工作流（SSOT）
│   ├── superpowers/      产品设计 spec / 交付计划
│   └── design/           PRD 与设计补充（备份扩展等）
├── prototype/            交互原型（HTML）
├── scripts/              工具脚本
├── AGENTS.md / CLAUDE.md Agent 入口
├── .claude/ / .cursor/   双轨 Agent 配置
└── tests/e2e/            Playwright
```

### 源码布局（complete-design §4.7）

```
src/
├── components/   vault | workspace | editor | graph | insights | common
├── views/        Welcome / Unlock / Insights / Workspace / Settings
├── stores/       vault, documents, editor, links, ui, folders
├── composables/  useTauriCommand, useAutoSave, useWikiSuggest…
└── extensions/   WikiLink.ts
```

**路由（产品 IA，非 prototype 七屏 demo）：**

| 路由 | 说明 |
|------|------|
| `/welcome` | FTUE 首次引导（无 vault 时） |
| `/unlock` | 解锁层 |
| `/insights` | **看板**（默认首页） |
| `/workspace` | 主工作区（编辑 / 图谱为**视图切换**） |
| `/settings` | 设置 |

原型 `prototype/index.html` 仅作交互参考；实现以 spec 信息架构为准。

## 数据目录

用户数据存储于 `~/.lizhi-kb/`（请勿提交到 Git）。

```
~/.lizhi-kb/
├── vault.meta.json      # 库元数据（加密状态、vault ID 等）
├── keys.enc             # 数据加密密钥（DEK）
├── vault.db / lizhi-kb.db   # SQLite（文档索引、需求、小记、热力图、链接索引）
├── workspace/           # Markdown 正文（.md 或 .md.enc）
├── assets/              # 图片等资源
├── vault-ui-state.json  # 文件夹树、标签、对话记录等 UI 状态（备份 SSOT）
├── ai-config.json       # AI 提供商配置
├── ai-secrets.json      # API Key（敏感）
└── mcp-config.json      # MCP 服务配置
```

### 备份与恢复（`.lizhi`）

设置 → **备份与恢复**。桌面版导出 `.lizhi` 压缩包（format v2），含文档、资源、需求/小记、文件夹与标签、AI/MCP 配置等。

| 操作 | 说明 |
|------|------|
| **导出备份** | 打包当前库；加密库导出需验证主密码 |
| **从备份恢复** | 整库替换，换机 / 灾难恢复；完成后自动重启 |
| **合并备份设置** | 仅合并 AI、文件夹、标签、对话记录等；**不改动现有文档** |
| **合并备份文档** | 按 `updated_at` 合并文档与资源，并合并设置；较新者胜 |
| **导出 Markdown** | 迁移到 Obsidian 等；单文件或按文件夹结构 |

> 加密库中文档与数据库在备份内保持加密；`ai-config.json` 等配置文件在包内为明文，请妥善保管 `.lizhi` 文件。  
> 详细设计：[docs/design/2026-07-08-backup-extension.md](./docs/design/2026-07-08-backup-extension.md)

## 文档

| 文档 | 路径 |
|------|------|
| 完整设计 spec | [docs/superpowers/specs/2026-07-06-lizhi-kb-complete-design.md](./docs/superpowers/specs/2026-07-06-lizhi-kb-complete-design.md) |
| 备份与恢复设计 | [docs/design/2026-07-08-backup-extension.md](./docs/design/2026-07-08-backup-extension.md) |
| AI 对话设计 | [docs/superpowers/specs/2026-07-08-lizhi-ai-chat-design.md](./docs/superpowers/specs/2026-07-08-lizhi-ai-chat-design.md) |
| MCP 集成设计 | [docs/superpowers/specs/2026-07-08-lizhi-mcp-design.md](./docs/superpowers/specs/2026-07-08-lizhi-mcp-design.md) |
| 品牌方案 | [docs/superpowers/specs/2026-07-06-lizhi-kb-brand-cat.md](./docs/superpowers/specs/2026-07-06-lizhi-kb-brand-cat.md) |
| M0 Spike 计划 | [docs/superpowers/specs/2026-07-06-lizhi-kb-vue-m0.md](./docs/superpowers/specs/2026-07-06-lizhi-kb-vue-m0.md) |
| v1 交付计划 | [docs/superpowers/plans/2026-07-06-lizhi-kb-v1-delivery.md](./docs/superpowers/plans/2026-07-06-lizhi-kb-v1-delivery.md) |
| 原始 PRD | [docs/design/初版设计.md](./docs/design/初版设计.md) |
| 交互原型 | [prototype/index.html](./prototype/index.html) |

## AI Agent 工作流

双轨配置（Claude Code + Cursor）：

- [AGENTS.md](./AGENTS.md) — 通用 Agent 指令
- [CLAUDE.md](./CLAUDE.md) — Claude Code 入口
- [工作流文档](./docs/agent-workflow/README.md) — 角色、模板、同步策略

校验：`node scripts/sync-agent-config.mjs --check`

## 版本路线

| 版本 | 代号 | 重点 |
|------|------|------|
| v1.0 | Vault | 加密库、编辑器、热力图 |
| v1.5 | Network | 双链、图谱、App Lock |
| v2.0 | Shadow | 诱饵库、盲水印 |
