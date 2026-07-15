# 大纲与思维导图 · 产品设计

> **版本**: 1.1.0  
> **日期**: 2026-07-15  
> **状态**: 已批准接入工作区  
> **来源**: 幕布式大纲方案适配狸知（结合 CodeMirror，不以树 JSON 为本体）

---

## 1. 概述

在工作区现有 Markdown 编辑之上，提供**幕布式大纲思维导图**：解析标题、段落正文与列表（含缩进嵌套），升级编辑侧「大纲」TOC 为标题树导航。正文编辑仍由 CodeMirror 完成。

### 1.1 与「图谱」的边界

| 项 | 局部图谱 `graph` | 思维导图 `mindmap` |
|----|------------------|-------------------|
| 数据 | `[[wiki]]` 双链关系 | 当前文档大纲（标题 + 正文 + 列表） |
| 语义 | 文档网络 | 文档大纲结构（贴近幕布） |
| 入口文案 | 「图谱」 | 「导图」 |

二者互不替代，勿混用数据源。

### 1.2 入口（IA）

| 项 | 说明 |
|----|------|
| 路由 | `/workspace`（无独立路由） |
| 工具栏 | `编辑 \| 图谱 \| 导图`（`workspaceViewMode`） |
| 导图内 | `思维导图 \| 大纲笔记`（同数据源；折叠/选中共享） |
| 正文 SSOT | `documents.content`（vault `.md` / `.md.enc`） |
| 大纲面板 | 编辑模式下右侧 TOC（标题树导航） |

### 1.3 核心能力（v1）

- `buildOutlineTree`（导图，对齐幕布）：**主题** = `#` 标题 / 列表项 / 根级段落；**备注** = 主题下段落（`note`，不单独成气泡）；列表缩进 = 子主题
- `buildHeadingTree`（TOC）：仍仅标题导航
- 导图：**左根右展**；默认曲线连线、暮紫**实心胶囊根**；一级主题浅色描边卡片；**二级及以下无框底线**（幕布分层）
- `#标签`：主题文案中的 `#xxx` 渲染为芯片（导图与大纲笔记一致）
- **大纲笔记**：分层列表 + 竖向引导线 + 折叠徽章；与思维导图切换，不另存树
- 导出：PNG（2x，含当前样式；仅思维导图 pane）
- 选中后「回编辑」或双击 → 回写对应行 / 滚到行
- 会话：`workspaceViewMode` 含 `mindmap`；样式偏好 localStorage（`lizhi-kb-mindmap-style`）

### 1.4 不做（v1）

- 独立树 JSON / appData `documents.json`
- 幕布式 Tab/Enter 节点大纲编辑器（替代 CodeMirror）
- 节点拖拽改层级
- 大纲笔记独立导出
- 与双链图谱共用渲染组件或数据源

### 1.5 二期（可选）

- 大纲笔记内联改标题文案 → 回写 Markdown 对应行
- 拖拽调整标题层级并重排 `#` 前缀

---

## 2. 数据流

```
documents.content
  → buildHeadingTree → DocumentToc（编辑侧，仅标题）
  → buildOutlineTree → MindMapView
       ├─ pane=map   → SVG 思维导图
       └─ pane=notes → OutlineNotesView（大纲笔记）
  → 选中节点 → edit + requestHeadingScroll / requestLineScroll
```

折叠状态仅会话内存（按文档），在导图 / 大纲笔记间共享，不进 vault。

---

## 3. 模块落点

| 路径 | 职责 |
|------|------|
| `src/utils/headings.ts` | `HeadingTreeNode` / `kind`、`buildHeadingTree`（TOC） |
| `src/utils/outlineTree.ts` | `buildOutlineTree`（导图大纲） |
| `src/utils/mindmap/parseTopicLabel.ts` | 拆 `#标签` |
| `src/composables/useOutlineTree.ts` | debounce 派生大纲树 |
| `src/composables/useHeadingTree.ts` | debounce 派生标题树（TOC） |
| `src/composables/mindmap/useMindmapLayout.ts` | 水平树布局 |
| `src/components/mindmap/MindMapView.vue` | 导图主视图 + pane 切换 |
| `src/components/mindmap/OutlineNotesView.vue` | 大纲笔记列表 |
| `src/components/editor/DocumentToc.vue` | 树形大纲 |
| `src/stores/ui.ts` | `WorkspaceViewMode` 含 `mindmap` |

---

## 4. 安全

- 仅解锁后可读正文；导图不落明文旁路文件
- 回写（若启用）经 `documents.updateContent` + 既有 autosave
- 密钥/DEK 不进日志

---

## 5. 验收

- 工具栏可切「导图」；导图内可切「思维导图 / 大纲笔记」
- 有标题文档渲染树；无标题显示根+空态提示
- `#标签` 在两端视图均显示为芯片；根节点实心强调色
- 折叠状态两端共享；选中后回编辑定位正常
- 编辑改 `#` 标题后导图同步（debounce）
- 「图谱」行为不变
- `pnpm verify` 通过
