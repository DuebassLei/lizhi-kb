# 资产库浏览体验优化

**文档版本**：v1.0.0  
**更新日期**：2026-07-14  
**状态**：已实现  
**平台**：Desktop（Tauri + Vue 3）  
**关联**：侧栏 `AssetLibraryPanel`、`Sidebar`、编辑器插入

---

## 1. UI 概念 + 布局

### 1.1 视觉方向

侧栏「资产速查」而非画廊：优先扫读与插入，放大预览走灯箱。沿用狸知 surface 层级与 link 强调色，避免独立紫系/卡片阴影堆叠。

### 1.2 信息架构（侧栏底部区）

```
┌─ 资产库 N ──────── [列表|网格] [刷新] ─┐
│ 🔍 搜索资产 ID…                        │
│ ○ 选择模式时：已选 k · 删除             │
│                                        │
│ 今天                                   │
│ [thumb] shortId…  size · 时间  [操作]  │
│ …                                      │
│ 更早                                   │
│ …                                      │
└────────────────────────────────────────┘
```

- **默认列表**：44px 缩略图 + 短 ID + meta + 操作（侧栏主路径）  
- **网格**：2 列、4:3、`object-contain`（辨认截图）  
- **区域高度**：`min(50vh, 22rem)`，列表区内滚动  

### 1.3 字体层级

| 角色 | Token | 用途 |
|------|-------|------|
| 标题 | `--text-xs` / 600 | 「资产库」 |
| 正文 ID | `--text-xs` + `--font-mono` | 短 ID |
| 辅助 | `0.625rem` + `--color-muted` | 体积/时间/空态 |

---

## 2. UX 流程

### 2.1 关键路径

1. 展开资产库 → 默认列表、按时间倒序  
2. 搜索过滤 ID → 无结果给 hint  
3. 单击缩略图 → 灯箱预览；Esc / 遮罩关闭  
4. **插入** → 优先光标处；无编辑器则追加文末  
5. 复制引用 / 单条删除  

### 2.2 进阶路径

- 多选 → 批量删除（确认文案含数量）  
- 列表/网格切换（localStorage 记忆）  
- 按「今天 / 近 7 天 / 更早」分组（仅列表）  

### 2.3 状态

| 状态 | 表现 |
|------|------|
| Loading | 居中「加载中…」 |
| Empty | 引导粘贴图片入库 |
| No results | 「无匹配」+ 缩短关键词 |
| Error（单图失败） | 该条用占位图标，不阻断列表 |
| Preview | 灯箱；支持插入 / 关闭；焦点可键盘 Esc |

### 2.4 无障碍

- 搜索、视图切换、操作按钮具备 `aria-label` / `title`  
- 交互控件 `:focus-visible` 使用全局 `focus-ring`  
- `prefers-reduced-motion` 继承全局 tokens  

---

## 3. Design System（资产库子集）

复用全局 `tokens.css`，组件级约定如下（ASCII token 名）：

### 3.1 Color

| Token | 用途 |
|-------|------|
| `--color-surface-0/1/2` | 面板底、行 hover、缩略图底 |
| `--color-text` / `--color-muted` | 主/辅文案 |
| `--color-link` | 插入 chip、视图激活、搜索强调 |
| `--color-danger` | 删除 hover |
| `--color-border` | 分隔与描边 |
| overlay | `color-mix(in srgb, black 55%, transparent)` 灯箱 |

### 3.2 Spacing / Radius / Type

| Scale | Value |
|-------|-------|
| thumb-sm | 2.75rem |
| gap-row | `--space-1`–`--space-2` |
| panel-max-h | `min(50vh, 22rem)` |
| radius | `--radius-sm` / `--radius-md` / `--radius-lg` |
| fonts | `--font-ui` + `--font-mono`（ID） |

### 3.3 Component rules

- **Thumb**：默认可点击放大；`object-cover`（列表小图）/ `object-contain`（网格/灯箱）  
- **Chip「插入」**：link 浅底，高度紧凑  
- **Icon btn**：正方形热区 ≥ 24px；danger 仅 hover 变红  
- **Count pill**：muted 小胶囊，非营销蓝角标  

### 3.4 字体配对（与产品一致）

1. UI：Inter / Noto Sans SC（`--font-ui`）  
2. Mono：JetBrains Mono（`--font-mono`）  
3. 不新增第三展示字体  

---

## 4. 实现计划

| # | 文件 | 改动 |
|---|------|------|
| 1 | `docs/.../2026-07-14-asset-library-browse-design.md` | 本 spec |
| 2 | `src/stores/ui.ts` | `pendingEditorInsert` + request/clear |
| 3 | `src/components/editor/EditorPane.vue` | watch 插入光标；失败则文末 |
| 4 | `src/components/workspace/Sidebar.vue` | 走 `requestEditorInsert`；高度 token |
| 5 | `src/components/workspace/AssetLibraryPanel.vue` | 分组、多选删除、密度持久化、token 化样式 |
| 6 | `src/utils/assetLibraryUi.ts` | shortId / formatSize / formatWhen / groupByDate（可测） |

### 验收

- [x] 列表默认可扫读：短 ID + 体积 + 相对时间  
- [x] 搜索 / 空态 / 无结果可用  
- [x] 灯箱预览 + Esc  
- [x] 插入落到光标（有编辑器时）  
- [x] 多选批量删除需确认  
- [x] 列表/网格记忆刷新后仍在  
- [x] 对比度与 focus 不破坏现有 sidebar  

---

## 5. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-07-14 | 四件套：UI/UX/DS/实现；含光标插入与批量删除 |
