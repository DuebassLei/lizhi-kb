# 设置页视觉对齐 · Claude Agent 工作台

**文档版本**：v1.0.0  
**更新日期**：2026-07-15  
**状态**：已实现  
**范围**：仅视觉语言对齐；保留设置页「长页 + 右侧锚点」IA  
**参考**：`CcWorkbenchSettingsShell` / `CcSettingsSidebar` / `AiSettingsShell`

---

## 1. 背景与目标

设置页（`/settings`）与 Claude Agent 工作台设置共用 `tokens.css`，但组合方式不一致：

| 维度 | 设置页（现状） | CC 工作台设置 |
|------|----------------|---------------|
| 区块标题 | `uppercase tracking-wide` | sentence-case `font-semibold` |
| 侧栏激活 | `bg-surface-2` 灰底 | link 字色 + `color-mix(link 12%)` |
| 表面 | 实底 `bg-surface-0` + `rounded-lg` | 半透明 mix + 径向光晕 |
| 选中态 | 部分 `bg-paw/10` | link tint / chip |

同页已嵌入 `AiSettingsShell` / `CcWorkbenchSettingsShell`，与周围 UPPERCASE 区块并置时「两套皮肤」最明显。

**目标**：在**不改 IA、不改业务逻辑**的前提下，让设置原生区块的标题层级、目录激活色、卡片表面、选中态与工作台一致。

**明确不做**：

- 改为左侧图标 Tab（方案 B/C 已否决）
- 修改 CSS token 色值本身
- 改造 CC 业务面板内部复杂布局（Agents/Skills 等），除非控件语义明显不一致（如 checkbox）
- 改动滚动锚点 / scroll-spy / 存取盘逻辑

---

## 2. 方案选型

| 方案 | 做法 | 结论 |
|------|------|------|
| **1. 抽共享 settings UI class（采用）** | 在全局样式抽 `.settings-panel__*` / `.settings-nav__*` / `.settings-list-card` / `.settings-chip--active`，数值对齐 CC | ✅ 可维护、最小业务风险 |
| 2. 逐文件手改 Tailwind | 各 panel 直接改 class | 易残留不一致 |
| 3. 原生区块套假 shell | 每段包 `cc-settings-shell` | 长页过重 |

用户确认：**方案 A（IA）+ 方案 1（落地）**。

---

## 3. 视觉规范（对齐数值）

以 CC shell 现网数值为准：

### 3.1 面板标题

| Token class | 规则 |
|-------------|------|
| `.settings-panel__title` | `font-size: 0.875rem; font-weight: 600;`；sentence-case；**禁止** `uppercase` / `tracking-wide` |
| `.settings-panel__desc` | `font-size: 0.75rem; color: var(--color-muted);` |

对齐：`.cc-settings-panel__title` / `__desc`（`CcWorkbenchSettingsShell.vue`）。

### 3.2 目录导航（右侧锚点保留）

| 状态 | 规则 |
|------|------|
| 默认 | `text-muted`；hover → `bg-surface-1` + 正文色 |
| 激活 `.settings-nav__item--active` | `color: var(--color-link)`；`background: color-mix(in srgb, var(--color-link) 12%, transparent)` |

对齐：`.cc-settings-sidebar__item--active`（`CcSettingsSidebar.vue`）。  
保留：右侧、`w-44`、文字项、lg 以下隐藏；可选后续加图标（本版不加，避免范围膨胀）。

### 3.3 列表卡 / 分组面

| class | 规则 |
|-------|------|
| `.settings-list-card` | `border: 1px solid var(--color-border); border-radius: var(--radius-lg);`；背景可用 `color-mix(in srgb, var(--color-surface-1) 40%, transparent)` 或实底 `surface-0`（按密度选一，**同页内统一**） |
| 行分割 | `border-divider` |

### 3.4 芯片 / 可选中行

| class | 规则 |
|-------|------|
| `.settings-chip--active` / 选中行 | link 边框或 `color-mix(link 12%)` 底；**不再**用 `bg-paw/10` 作为选中底 |

### 3.5 页内容氛围

主滚动内容区：与 `.cc-settings-shell` 同级的极淡径向光晕  
`radial-gradient(... var(--color-link) 约 6% ...)` + `surface-0` / `canvas` 基底。  
`PageHeader`、`HintBanner` 保留。

### 3.6 控件

- Checkbox 统一 `accent-link`（含设置页内嵌 CC basic 中非 `accent-link` 的个别项，若存在则顺手改）。
- 输入优先 `Input` / 全局 `field-input`，避免再叠冲突的 `bg-surface-1`。

---

## 4. 改动文件（最小 diff）

### Phase A — 共享样式

| 文件 | 改动 |
|------|------|
| `src/styles/components.css`（或新建 `src/styles/settings-ui.css` 并在入口导入） | 定义 `.settings-panel__title/desc`、`.settings-nav__item` / `--active`、`.settings-list-card`、`.settings-chip--active`、`.settings-page__body`（径向光晕） |

### Phase B — 设置页与面板

| 文件 | 改动 |
|------|------|
| `src/views/SettingsView.vue` | section `h2` → panel title；内容区挂 body 氛围；主题 tile 选中态 |
| `src/components/settings/SettingsAnchorNav.vue` | 激活态改用 `.settings-nav__item--active` |
| `src/components/settings/QuickNavSettingsPanel.vue` | 标题/描述 |
| `src/components/settings/DocumentTemplatesSettingsPanel.vue` | 标题/描述；选中行去 paw |
| `src/components/settings/BackupRestorePanel.vue` | 标题/卡片 |
| `src/components/settings/McpSettingsPanel.vue` | 标题去 uppercase；列表卡 |
| `src/components/settings/AiSettingsPanel.vue` | 外层标题与全局统一（避免与嵌入 shell 双重标题风格冲突） |
| `src/components/settings/CcWorkbenchSettingsPanel.vue` | 同上 |

### Phase C — 可选微调

| 文件 | 改动 |
|------|------|
| `src/components/cc/CcWorkbenchSettingsShell.vue` | basic 区 checkbox → `accent-link`（若尚未） |

**不改**：`constants/settingsSections.ts` 逻辑、`useScrollSpy`、各 panel 的 store/IPC。

---

## 5. 验收标准

1. 设置页所有一级区块标题为 sentence-case、`font-semibold` ~0.875rem，无 `uppercase tracking-wide`。
2. `SettingsAnchorNav` 当前项为 link 色 + link 12% 底，与 `CcSettingsSidebar` 激活语义一致。
3. 安全开关 / 快速导航 / 备份等列表卡圆角与边框一致；选中态为 link 语义，无 paw 选中底。
4. 嵌入 `#settings-ai` / `#settings-cc-workbench` 与周围原生区块不再明显「两套皮」。
5. Hash / 目录锚点跳转与 scroll-spy 行为不变。
6. `pnpm verify:fe` 通过；无业务逻辑变更。

---

## 6. 实现顺序

1. 落地共享 CSS class  
2. `SettingsAnchorNav` + `SettingsView` 标题与氛围  
3. 各 settings panel 批量替换  
4. checkbox / 选中态收尾  
5. `pnpm verify:fe` + 目视对照工作台设置  

---

## 7. 风险与回退

| 风险 | 缓解 |
|------|------|
| 半透明在部分主题对比不足 | 优先复用已在 CC 验证的 mix 比例；必要时退回实底 `surface-0` |
| 标题 class 抽取遗漏个别手写 h2 | 验收时全文搜 `uppercase` + `settings` |
| 嵌入 shell 双层边框仍略沉 | 仅在外层 wrapper 去多余 `rounded-xl border`，不改 shell 内部 |
