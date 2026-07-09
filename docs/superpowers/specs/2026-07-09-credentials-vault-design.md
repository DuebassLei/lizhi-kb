# 狸知知识库 · 密码本（凭据便签）功能设计

**文档版本**：v1.0.0  
**更新日期**：2026-07-09  
**状态**：待实现  
**定位**：方案 A — 轻量凭据便签（非完整密码管理器）

---

## 1. 目标

在 vault 解锁态下，提供专用「密码本」模块，用于记录常见系统账号、密码与登录地址，支持**快速查看、掩码展示、一键复制**。

**核心用户场景**：

- 运维/开发切换多套环境（测试、生产、本地、公网）时快速找到对应凭据
- 复制 SSH / 数据库 / 后台登录信息，无需在工作区 Markdown 中明文编辑
- 侧栏或 Cmd+K 直达，不打断主写作流

**明确不做（v1）**：

- TOTP / 2FA、密码生成器、浏览器自动填充
- 1Password / Bitwarden 导入导出
- 凭据与 Markdown 双链互引

---

## 2. 信息架构

### 2.1 路由与导航

| 项 | 值 |
|----|-----|
| 路由 | `/credentials` |
| 页面标题 | 密码本 |
| QuickNav id | `credentials` |
| 默认可见 | 是（设置 → 快速导航可关闭） |

侧栏顺序建议：看板 → 工作区 → 每日小记 → **密码本** → 需求看板 → AI 助手 → 设置

### 2.2 页面结构

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔐 密码本              [搜索…]     [环境筛选 chips]    [+ 新建凭据] │
├──────────────┬───────────────────────────────────────────────────────┤
│ 分类         │  ★ 收藏                                               │
│ ─────────    │  ┌─────────────────────────────────────────────────┐  │
│ ★ 收藏       │  │ [生产] 生产 MySQL                    [复制▼][···]│  │
│ 系统         │  │ root · •••••••• · db.prod.internal:3306         │  │
│ 数据库       │  └─────────────────────────────────────────────────┘  │
│ 云服务       │  ┌─────────────────────────────────────────────────┐  │
│ 内网         │  │ [测试] Jenkins 后台                    [复制▼][···]│  │
│ 其他         │  │ deploy · •••••••• · https://jenkins.test...     │  │
│              │  └─────────────────────────────────────────────────┘  │
│ [+ 分类]     │                                                       │
└──────────────┴───────────────────────────────────────────────────────┘
```

---

## 3. 数据模型

### 3.1 TypeScript 类型

```typescript
/** 部署环境标签（固定四类，不可自定义） */
export type CredentialEnvironment = "test" | "prod" | "local" | "public";

export interface CredentialEntry {
  id: string;
  title: string;
  category: string;           // 业务分类，见 3.3
  environment: CredentialEnvironment;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

/** 列表卡片展示用；password 可为掩码占位，详情/复制时再取明文 */
export interface CredentialEntryMeta extends Omit<CredentialEntry, "password"> {
  passwordMasked: string;
}
```

### 3.2 环境标签

| 值 | 中文 | 用途说明 | 徽章色（token） |
|----|------|----------|-----------------|
| `test` | 测试 | 测试 / staging 环境 | `--color-warning` 底 + 深字 |
| `prod` | 生产 | 线上生产，操作需谨慎 | `--color-danger` 底 + 深字 |
| `local` | 本地 | 本机 / localhost / 开发机 | `--color-secure`  muted 底 |
| `public` | 公网 | 对外可访问的公网服务 | `--color-link` muted 底 |

- 新建凭据**必选**环境，默认 `local`
- 卡片左上角展示环境徽章；列表可按环境 chip **单选筛选**（「全部」+ 四类）
- 生产环境凭据复制前可选二次确认（v1.1，v1 仅 toast 提示「已复制生产环境凭据」）

### 3.3 业务分类（category）

默认分组（可扩展为自定义字符串，v1 先用预设）：

| 值 | 中文 |
|----|------|
| `system` | 系统 |
| `database` | 数据库 |
| `cloud` | 云服务 |
| `intranet` | 内网 |
| `other` | 其他 |

侧栏按 category 筛选；与 environment 筛选**叠加**（AND）。

### 3.4 数据库（vault.db 迁移）

```sql
CREATE TABLE credential_entries (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  environment TEXT NOT NULL DEFAULT 'local',
  username TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  url TEXT,
  notes TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_credential_env_updated
  ON credential_entries (environment, updated_at DESC);

CREATE INDEX idx_credential_category_sort
  ON credential_entries (category, sort_order, updated_at DESC);

CREATE INDEX idx_credential_favorite
  ON credential_entries (is_favorite DESC, updated_at DESC);
```

`environment` 在 Rust 层校验，仅允许 `test|prod|local|public`。

---

## 4. 安全

| 原则 | 实现 |
|------|------|
| 落盘加密 | 与其他 vault 表相同，SQLCipher + DEK |
| 前端不落盘明文 | 生产 Tauri 走 IPC；`pnpm dev` localStorage fallback 带 dev 警告 |
| 列表掩码 | 默认 `passwordMasked = "••••••••"`；点击「显示」才请求/展示明文 |
| 自动 re-mask | 显示密码 30 秒后自动隐藏 |
| 锁定清零 | `lock_vault` 时 `credentials` store 调用 `clear()` |
| 剪贴板 | 复制后 toast；可选 Rust 30s 清剪贴板（v1.1） |
| 审计 | `audit_logs` 记录 `CREDENTIAL_COPY`（id + field，不含密码值） |
| 生产提示 | 复制 `prod` 环境凭据时 toast：「已复制生产环境凭据」 |

密钥与主密码**绝不**进入前端持久化或日志。

---

## 5. 交互规格

### 5.1 列表与卡片

- 排序：收藏置顶 → `updated_at` 降序
- 卡片信息：环境徽章 + 标题 + 用户名 + 掩码密码 + url（截断）
- 主操作「复制」：默认复制密码；下拉：用户名 / 地址 / `用户名:密码` / 全部（制表符分隔，便于粘贴到表格）
- 次要操作 `···`：编辑、收藏/取消、删除（删除需 confirm）

### 5.2 抽屉（新建 / 编辑）

| 字段 | 控件 | 校验 |
|------|------|------|
| 名称 | text | 必填，1–120 字 |
| 环境 | 四选一 segmented / select | 必填，默认 local |
| 分类 | select | 必填，默认 other |
| 用户名 | text | 可选 |
| 密码 | password input + 显示切换 | 可选（仅地址类可为空） |
| 地址 | url input + 「打开」 | 可选，合法 URL 或 host:port |
| 备注 | textarea | 可选，≤ 2000 字 |

保存后关闭抽屉并刷新列表；Esc 关闭未保存时 confirm。

### 5.3 搜索与筛选

- **搜索**：title、username、url、notes、category 中文名、environment 中文名
- **环境 chips**：全部 | 测试 | 生产 | 本地 | 公网（单选）
- **分类侧栏**：全部 + 各 category + 收藏

### 5.4 Command Palette（P2，可随 v1 一并做）

- `复制凭据: {title}` — 匹配标题，Enter 复制密码
- 需 vault 已解锁

### 5.5 空 / 加载 / 错误

- **空**：「还没有凭据，添加第一条常用系统登录」+ 新建按钮
- **加载**：3 条卡片骨架
- **错误**：顶栏 banner + 重试

---

## 6. 技术架构

```
CredentialsView.vue
  └── CredentialLayout
        ├── CredentialCategoryNav   # 左栏分类
        ├── CredentialToolbar       # 搜索 + 环境 chips + 新建
        ├── CredentialList
        │     └── CredentialCard    # 徽章 + 复制菜单
        └── CredentialDrawer        # 表单

stores/credentials.ts  →  credentialService.ts  →  Tauri IPC
                                                      └── credentials.rs (Rust)
                                                            └── vault.db
```

### 6.1 Tauri Commands

| Command | 说明 |
|---------|------|
| `list_credential_entries` | 可选 filter：`category`, `environment`, `query`；返回含 `passwordMasked` |
| `get_credential_entry` | 按 id 返回完整条目（含明文 password，仅解锁态） |
| `create_credential_entry` | 创建 |
| `update_credential_entry` | 部分更新 |
| `delete_credential_entry` | 删除 |

### 6.2 前端文件清单

```
src/views/CredentialsView.vue
src/components/credentials/CredentialCategoryNav.vue
src/components/credentials/CredentialToolbar.vue
src/components/credentials/CredentialList.vue
src/components/credentials/CredentialCard.vue
src/components/credentials/CredentialDrawer.vue
src/components/credentials/CredentialCopyMenu.vue
src/components/credentials/CredentialEnvBadge.vue
src/stores/credentials.ts
src/services/credentialService.ts
src/types/credential.ts
src/constants/credentialCategories.ts
src/constants/credentialEnvironments.ts
src/constants/quickNav.ts          # 新增 credentials
src/router/index.ts                # /credentials
src-tauri/src/credentials.rs
src-tauri/src/db.rs                # migration
src-tauri/src/commands.rs
```

### 6.3 浏览器 dev fallback

与 `journalService` 相同：`localStorage` key `lizhi-kb-credentials`，Tauri 首次启动时迁移到 vault.db。

---

## 7. 视觉规范

沿用 `tokens.css`（Vault Noir）：

| 元素 | 类 / token |
|------|------------|
| 页面底 | `bg-canvas` |
| 卡片 | `bg-surface-0 border-border`，hover `bg-surface-1` |
| 密码 | `font-mono text-muted` |
| 导航图标 | Lucide `KeyRound` |
| 页脚提示 | `text-xs text-muted`：「凭据保存在本地加密库，锁定后内存清零」 |

环境徽章组件 `CredentialEnvBadge` 统一封装颜色与中文标签。

---

## 8. 验收标准

1. 解锁后可 CRUD 凭据，含环境标签四类；重启应用数据仍在 vault.db
2. 环境 chip 与分类侧栏可叠加筛选，搜索实时生效
3. 列表默认掩码；显示密码 30 秒后自动隐藏
4. 复制密码/用户名/URL 有 toast；复制生产环境有额外提示文案
5. 锁定 vault 后 credentials store 为空，重新解锁需重新 fetch
6. QuickNav 可隐藏「密码本」；E2E：`credentials.spec.ts` 覆盖新建 + 复制 + 筛选

---

## 9. 实现分期

| 阶段 | 交付 |
|------|------|
| **P1** | DB 迁移 + Rust CRUD + 列表/抽屉/复制 + 环境徽章与筛选 |
| **P2** | Command Palette 快捷复制 + 审计日志 |
| **P3** | 剪贴板自动清除、生产环境二次确认（可选） |

---

## 10. 与产品 spec 关系

- 符合「本地加密知识库」叙事：凭据与笔记同级保护，零默认外联
- 不冲突 v1.x Won't：无云同步、无协作
- 对标差异：Obsidian 无内置凭据 UI；Standard Notes 无结构化凭据 — 狸知在加密壳内提供**轻量运维便签**
