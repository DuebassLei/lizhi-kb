# 计划 · 微信公众号主题预览与复制

**日期**: 2026-07-07  
**类型**: feature（spec 未预定义，v1.x 扩展）  
**Spec 引用**: `docs/superpowers/specs/2026-07-06-lizhi-kb-complete-design.md` §3.1 导出、§4 ExportService  
**参考项目**: `D:\codes\md-wechat-editor`（墨韵简排）  
**模板**: `docs/agent-workflow/templates/export.md` + `feature.md`  
**状态**: v2 已确认并实现（2026-07-07）

---

## v2 架构决策（已确认）

| 决策 | 结论 |
| --- | --- |
| 编辑器 | **全项目统一 CodeMirror 6**，彻底去掉 TipTap / WYSIWYG |
| 工作区模式 | `edit`（CM 源码编辑）\| `preview`（GFM 阅读预览） |
| 公众号排版 | **独立顶级路由** `/wechat-studio`，非工作区 Tab |
| 目录树 | 与工作区共用 `Sidebar` + `documents`/`folders` store |
| 持久化 | 同一 `documents.content`，autosave 写回 SQLite |
| 渲染管线 | `src/services/wechatExport/`（marked + juice + 主题 registry） |
| 排版块 | 支持 `:::module` 基础解析（MVP 卡片渲染） |
| 参考 | 算法借鉴 `md-wechat-editor`，代码自研（许可方案 B） |

## v3 扩展（2026-07-07）

| 项 | 状态 |
| --- | --- |
| 工作区分栏预览 | 工具栏「分栏预览」开关，默认关闭，localStorage 持久化 |
| 公众号主题 | **15 套**（见下表），按分类 optgroup 分组 |
| 排版块 | 16 种模块类型（见语法表） |
| 公众号工作室 | 模块片段插入下拉（15 个模板） |

### v4 扩展 · 工作区公众号分栏预览（Plan A，2026-07-07）

| 项 | 状态 |
| --- | --- |
| 分栏预览类型 | 工具栏「阅读 / 公众号」切换，`splitPreviewKind` localStorage 持久化 |
| 右栏组件 | GFM → `MarkdownPreview`；公众号 → `WechatPreviewPanel` + 主题 + 复制 |
| 共享组件 | `WechatThemeSelect`、`WechatCopyButton`、`WechatModuleSelect` |
| 数据 | 同一 `documents.content`，微信主题仍用 `lizhi-kb-wechat-theme` |
| 独立路由 | `/wechat-studio` 保留，共用 `useWechatTheme()` |

**布局（分栏预览开启时）**：

```
[ CodeMirror ] | [ GFM 预览 | 公众号预览 ]
```

### 主题列表（15 套）

| ID | 名称 | 分类 | 强调色 |
| --- | --- | --- | --- |
| lizhiClassic | 经典狸知 | 经典 | #e07a5f |
| lizhiForest | 森林绿意 | 经典 | #059669 |
| lizhiClean | 极简留白 | 极简 | #64748b |
| lizhiMint | 薄荷清新 | 极简 | #14b8a6 |
| lizhiTech | 科技靛蓝 | 科技 | #4f46e5 |
| lizhiOcean | 海洋青蓝 | 科技 | #0d9488 |
| lizhiPurple | 凝夜紫韵 | 典雅 | #7c3aed |
| lizhiRose | 玫瑰绯红 | 典雅 | #e11d48 |
| lizhiCoral | 珊瑚暖阳 | 典雅 | #fb7185 |
| lizhiAmber | 琥珀暖光 | 暖色 | #d97706 |
| lizhiWarm | 暖棕书卷 | 暖色 | #92400e |
| lizhiInk | 墨韵深灰 | 深色强调 | #334155 |
| lizhiSlate | 石板亮蓝 | 深色强调 | #0ea5e9 |
| lizhiMidnight | 午夜蓝调 | 深色强调 | #4338ca |
| lizhiEditorial | 报刊质感 | 报刊 | #b45309 |

### 排版块语法表

| 模块 | 语法 | 说明 |
| --- | --- | --- |
| tip | `:::tip[提示]` … `:::` | 绿色提示框 |
| note | `:::note[说明]` + `title:` / 正文 | 灰色说明框 |
| info | `:::info[信息]` … `:::` | 蓝色信息框 |
| warning | `:::warning[注意]` … `:::` | 橙色警告框 |
| danger | `:::danger[危险]` … `:::` | 红色危险框 |
| success | `:::success[成功]` … `:::` | 绿色成功框 |
| highlight | `:::highlight` + `title:` + 正文 | 主题色强调框 |
| quote-card | `:::quote-card` + `body:` / `author:` | 引用卡片 |
| steps | `:::steps` + `title:` + `步骤 \| 说明` 行 | 编号步骤 |
| timeline | `:::timeline` + `日期 \| 事件 \| 描述` 行 | 时间轴 |
| compare | `:::compare[对比]` + `left-title:` / `right-title:` + `左 \| 右` 行 | 双列对比 |
| columns | `:::columns` + `列1 \| 列2 \| …` 行 | 多列布局 |
| divider | `:::divider` + 可选标题文字 | 分隔线 |
| code-card | `:::code-card` + `title:` + fenced code + `caption:` | 代码卡片 |
| table-card | `:::table-card` + `title:` + Markdown 表格 | 表格卡片 |
| 未知模块 | `:::任意名称` … `:::` | fallback 卡片，显示模块名 |

**示例（测试用）**：

```markdown
:::tip[提示]
操作前请先备份数据
:::

:::steps
title: 三步流程
步骤一 | 准备环境
步骤二 | 执行操作
步骤三 | 验证结果
:::

:::compare[对比]
left-title: 方案A
right-title: 方案B
优点A | 优点B
:::

:::timeline
2024-01 | 项目启动
2024-06 | 正式发布
:::
```

---


## 背景与核心问题

用户希望在狸知知识库中实现：

1. **主题预览** — 多种微信公众号排版主题，所见即所得
2. **复制微信格式** — 生成内联样式 HTML，粘贴到微信公众平台编辑器

**核心架构问题（v1）**：是否要与 TipTap 编辑器分开？

**v1 结论（已废弃）**：工作区 Tab `wechat` 模式，保留 TipTap。

**v2 结论（当前）**：**统一 CodeMirror + 独立公众号工作室**。编辑与排版分离；工作区专注知识写作（Markdown 源码 + GFM 阅读预览），公众号视图为权威排版预览与复制入口。

---



## A. 参考项目调研 · md-wechat-editor



### A.1 架构概览


| 层   | 技术                                | 说明                          |
| --- | --------------------------------- | --------------------------- |
| UI  | Vue 3 + CodeMirror 6              | 独立 Markdown 编辑器，非富文本        |
| 路由  | `/` 排版工作室、`/cards`、`/handwriting` | 多工作室并列                      |
| 引擎  | `src/engine/`                     | Markdown → 微信 HTML 管线（核心资产） |
| 主题  | `src/engine/themes/`              | 39 套 CSS 字符串，`#nice` 选择器    |
| 复制  | `juice` + Clipboard API           | CSS 内联 → `text/html` 剪贴板    |
| 图片  | `src/engine/image-pipeline/`      | 本地 token → base64；可选图床外链    |


依赖：`marked`、`juice`、`katex`（公式）、`html-to-image`（图导出）。**无 Tauri**，纯浏览器 localStorage。

### A.2 主题系统实现

- 每个主题为 **TypeScript 模块导出的 CSS 字符串**（源自 mdnice 社区主题）
- 选择器统一 `#nice h1 .content`、`#nice blockquote` 等
- `getThemeCss(themeId)` 将 `#nice` 替换为预览容器选择器
- 部分「草案主题」额外有 `DRAFT_WECHAT_DECOR` DOM 装饰 + `sanitizeDraftThemeCssForWechat`
- 预览：`usePreviewHtml` composable，**280ms debounce** 重渲染



### A.3 「复制到微信」技术方案

管线（`buildWechatArticleHtml` → `copyRichText`）：

```
Markdown
  → marked / 富排版 parseLayoutMarkdown（:::module）
  → postProcessForWechat（li 包 section、h 包 span.content/prefix/suffix）
  → getThemeCss + WECHAT_BASE_CSS
  → juice.inlineContent（内联样式）
  → fixWechatBlackColor（#000 → #010101，防微信吞色）
  → prepareWechatPasteHtml（富排版场景）
  → navigator.clipboard.write([ClipboardItem text/html])
```

**特殊处理**：


| 元素        | 处理                                         |
| --------- | ------------------------------------------ |
| 列表 `<li>` | 内容包 `<section>`（微信会剥 li 样式）                |
| 标题        | 文字包 `<span class="content">`               |
| 代码块       | 主题 CSS 控制；高亮颜色内联                           |
| 图片        | 复制前 `resolveImageSourcesInHtml` 转 data URL |
| 纯黑文字      | 替换为 `#010101`                              |
| 双链 / 外链   | 标准 `<a>` 保留                                |




### A.4 可复用 vs 需重写


| 可复用（逻辑层面）                   | 不可直接依赖 npm 包                       | 需重写/适配                                                     |
| --------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| `postProcessForWechat` 思路   | 整个 `md-wechat-editor` 包（**非商业许可**） | Markdown 解析入口（lizhi-kb 用自研 `markdownToPreviewHtml`）        |
| `juice` 内联管线                | 53 种 `:::module` 排版组件              | `asset://` → base64（已有 `embedAssetsInMarkdown`）            |
| mdnice 主题 CSS（需署名）          | CodeMirror 编辑器                     | WikiLink `[[...]]` 降级为纯文本/下划线                              |
| `copyRichText` Clipboard 写法 | 图床 publish 流程（云上传，违反 NetworkGuard） | Tauri 剪贴板 fallback（`@tauri-apps/plugin-clipboard-manager`） |
| 手机框预览 UI 模式                 | AI / 小程序 / 卡片工作室                   | 与 Pinia documents 同步                                       |




### A.5 许可证风险 ⚠️

`md-wechat-editor` 采用**源代码非商业许可**（非 MIT）。集成到狸知知识库（潜在商业产品）需：

- **方案 A**：向版权人取得书面商用授权
- **方案 B**：仅借鉴公开算法（juice + mdnice DOM 结构），**自写引擎 + 自研/开源主题 CSS**
- **方案 C**：若产品确认为纯个人非商用，可按同协议 Fork 引擎子集

**默认建议方案 B**（MVP 移植核心算法 + 5 套主题），避免许可阻塞。

---



## B. 当前 lizhi-kb 调研



### B.1 编辑器与预览


| 组件                      | 路径                                          | 职责                                |
| ----------------------- | ------------------------------------------- | --------------------------------- |
| `TipTapEditor`          | `src/components/editor/TipTapEditor.vue`    | WYSIWYG 主编辑器                      |
| `SourceEditor`          | `src/components/editor/SourceEditor.vue`    | 源码模式                              |
| `MarkdownPreview`       | `src/components/editor/MarkdownPreview.vue` | 阅读预览（`editor.mode === 'preview'`） |
| `markdownToPreviewHtml` | `src/utils/markdownPreview.ts`              | 轻量 MD→HTML，支持 WikiLink、代码高亮       |
| `EditorPane`            | `src/components/editor/EditorPane.vue`      | 按 `editor.mode` 切换三者              |


**阅读预览主题**（`previewTheme`）：`classic` / `document` / `compact` / `mono` —— 面向**知识库阅读**，非微信排版，与公众号主题**正交**。

### B.2 工作区视图切换

```
ui.workspaceViewMode: 'edit' | 'graph' | 'mindmap'
```

- `WorkspaceView.vue` 通过 `computed` 切换 `EditorPane` / `LocalGraphView` / `MindMapCanvas`
- Toolbar：`编辑 | 图谱` 分段 + 脑图 toggle 按钮
- 会话持久化：`workspaceSession.ts` 保存 viewMode

**模式**：图谱/脑图与编辑**互斥全屏**，共享 `documents.content` 数据源。

### B.3 导出流程

- 入口：`ExportMenu.vue`（Toolbar）+ `CommandPalette`
- 实现：`exportFile.ts` — MD / HTML / PDF
- HTML 导出已具备 `embedAssetsInMarkdown`（`asset://` → data URL）
- **无剪贴板富文本复制**，无 juice 内联



### B.4 Spec 覆盖情况


| 项     | spec 状态                       |
| ----- | ----------------------------- |
| 公众号排版 | **未定义**                       |
| 导出    | v1.0：MD + PDF；现已有 HTML        |
| 水印    | v1.5 导出水印（未实现于 HTML 复制场景）     |
| 网络    | Rust NetworkGuard 默认 deny all |




### B.5 安全约束（微信场景）


| 约束              | 影响                                                        |
| --------------- | --------------------------------------------------------- |
| `asset://` 加密图片 | 复制前**必须**转 base64 data URL（微信无法访问本地协议）                    |
| 无云图床            | 不引入 md-wechat-editor 的 publish-with-host 流程               |
| WikiLink        | 微信中无跳转语义 → 导出为可见文本或 `<span>` 样式                           |
| 剪贴板             | Tauri WebView 需验证 `navigator.clipboard.write`；不行则用 plugin |
| 内容泄露            | 复制行为在用户主动触发后进行，符合「用户显式导出」                                 |


---



## C. 方案对比



### 方案 1：工作区内嵌「公众号」视图（推荐）

与 `mindmap` / `graph` 同级，新增 `workspaceViewMode: 'wechat'`。


| 维度                   | 设计                                                                   |
| -------------------- | -------------------------------------------------------------------- |
| **IA 入口**            | Toolbar「编辑 | 图谱」旁增「公众号」；或 Export 旁「公众号预览」toggle                      |
| **与编辑器关系**           | **只读派生视图**，TipTap 仍是唯一编辑入口；切换前 `syncFromWysiwyg`                     |
| **同步策略**             | `documents.content` 变更 → **300ms debounce** 重渲染（对齐 md-wechat-editor） |
| **主题 UX**            | 预览区顶栏：主题下拉/色卡 + 「复制公众号 HTML」主按钮                                      |
| **布局**               | 桌面：左侧主题栏 + 右侧手机框预览；移动：全屏预览 + 底部复制                                    |
| **复制流程**             | 预览 HTML 经 juice 内联 → 图片 base64 → 剪贴板                                 |
| **md-wechat-editor** | **移植核心算法**（方案 B 许可），不 npm 依赖                                         |
| **优点**               | 上下文连贯、复用文档选择/侧栏、与图谱模式一致                                              |
| **缺点**               | 工作区 Toolbar 略拥挤；长文 juice 可能卡顿                                        |




### 方案 2：独立顶层「公众号排版」路由

类似 `/requirements`，新增 `/wechat-studio`。


| 维度                   | 设计                                  |
| -------------------- | ----------------------------------- |
| **IA 入口**            | AppShell 顶层「公众号」                    |
| **与编辑器关系**           | **完全分开**；从工作区「发送到公众号排版」导入 MD        |
| **同步策略**             | 手动导入 / 打开文档副本；可做双向但复杂               |
| **主题 UX**            | 全屏工作室：左编辑 + 右预览（类 md-wechat-editor） |
| **复制流程**             | 同方案 1                               |
| **md-wechat-editor** | 可更大程度复用 UI 模式，但仍受许可限制               |
| **优点**               | 功能边界清晰、可塞入 :::module 等高级排版          |
| **缺点**               | 与知识库写作流程割裂；需重复文档选择；IA 膨胀            |




### 方案 3：ExportMenu 轻量扩展（MVP-0）

不增视图，仅在导出菜单加「复制微信格式」。


| 维度         | 设计                          |
| ---------- | --------------------------- |
| **IA 入口**  | `ExportMenu` 新增一项           |
| **与编辑器关系** | 无预览，一键复制                    |
| **同步策略**   | 点击时读取当前 `documents.content` |
| **主题 UX**  | 设置页默认主题 / 复制前弹窗选主题          |
| **复制流程**   | 同方案 1                       |
| **优点**     | 最小 diff、最快交付                |
| **缺点**     | **无法所见即所得**，主题选择体验差，难迭代     |




### 对比矩阵


| 维度            | 方案 1 工作区视图 | 方案 2 独立路由 | 方案 3 仅导出 |
| ------------- | ---------- | --------- | -------- |
| 与 TipTap 分离   | 渲染分离，编辑不分离 | 完全分离      | 渲染分离     |
| 主题预览 UX       | ★★★★★      | ★★★★★     | ★★       |
| 实现复杂度         | 中          | 高         | 低        |
| 符合知识库 IA      | ★★★★★      | ★★★       | ★★★★     |
| 可扩展 :::module | 后续可加       | 天然适合      | 难        |
| MVP 推荐        | **主路径**    | 不推荐 v1    | 可作切片 0   |


---



## 推荐方案



### 明确推荐：**方案 1 — 工作区** `wechat` **视图模式**

**理由（3-5 句）**：

1. 公众号排版是**当前文档的导出视图**，不是第二种写作体验；与图谱/脑图同属「同一文档的不同呈现」，不应拆到顶层路由。
2. TipTap 保持唯一编辑入口，避免 CodeMirror 双编辑器同步问题；微信管线只消费 Markdown 字符串，边界清晰。
3. 用户可在写作后一键切到「公众号」预览主题、复制，流程短于「导出 → 打开外部工具」。
4. 渲染引擎独立模块即可测试；未来若需高级 :::module，在引擎层扩展，不必改 TipTap。
5. 方案 3 可作为**切片 0** 验证 juice + 剪贴板，但不应作为终态。

**不推荐方案 2**，除非用户明确要做「无关联文档的排版工作室」（偏离知识库定位）。

---



## 验收标准



### AC-1 · 工作区入口

- [ ] 打开任意文档后，Toolbar 可切换到「公众号」视图
- [ ] 切换前自动 flush 编辑器内容到 `documents.content`
- [ ] 切换回「编辑」后内容一致



### AC-2 · 主题预览

- [ ] 至少 **5 套**公众号主题可切换（如：默认、绿意、全栈蓝、凝夜紫、简洁）
- [ ] 预览区手机框宽度约 375px，样式与复制结果一致
- [ ] 正文变更后 **≤500ms** 内预览更新（debounce）



### AC-3 · 复制微信 HTML

- [ ] 点击「复制公众号格式」后，剪贴板含 `text/html`
- [ ] 粘贴到微信公众平台编辑器，标题/段落/列表/引用/代码块/图片样式基本保留
- [ ] `asset://` 图片以 base64 内嵌，无破损图
- [ ] 复制成功/失败有中文 toast



### AC-4 · 知识库特性降级

- [ ] `[[WikiLink]]` 导出为可见文本（保留别名），不尝试跳转
- [ ] 不支持 :::module 时不报错，按 GFM 渲染



### AC-5 · 安全与平台

- [ ] 复制不发起外网请求（纯本地 base64）
- [ ] Tauri 桌面下剪贴板可用；浏览器 dev 模式同效或友好提示
- [ ] `pnpm build` 通过；核心管线有单元测试



### AC-6 · 明确不做（MVP）

- [ ] 不支持 53 种 :::module 排版组件
- [ ] 不支持云图床 / 图片上传外链
- [ ] 不做小红书/掘金/知乎多平台复制
- [ ] 不做顶层 AppShell「公众号」菜单

---



## 垂直切片（1 → 2 → 3）



### 切片 0（可选，1-2 天）：复制管线验证

**目标**：无 UI，ExportMenu 加「复制微信格式（实验）」。

- 新增 `src/services/wechatExport/`：`postProcess.ts`、`inlineTheme.ts`、`copyToClipboard.ts`
- 引入 `juice`、`marked`（或复用现有 markdown 转 HTML 再适配）
- 1 套硬编码主题 + `embedAssetsInMarkdown`
- 验证 Tauri 剪贴板

**出口**：手动粘贴微信后台成功。

### 切片 1（MVP，3-5 天）：公众号视图 + 5 主题

- `WorkspaceViewMode` 扩展 `'wechat'`
- `WechatPreviewPane.vue`：手机框 + `useWechatPreview` composable
- `WechatThemePicker.vue` + `wechatThemes/`（5 套 CSS）
- Toolbar 入口 + session 持久化 `wechatThemeId`
- 复制按钮 + toast

**出口**：AC-1 ~ AC-5 通过。

### 切片 2（增强，2-3 天）：体验打磨

- 主题扩至 10-15 套（移植 mdnice 经典主题 + 署名）
- 代码块微信兼容（行内样式颜色）
- 表格、任务列表样式
- 命令面板：`复制公众号格式`、`公众号预览`
- 单元测试 + Playwright 冒烟（mock 剪贴板）



### 切片 3（远期）：高级排版

- 评估是否引入子集 :::module（callout、steps 等 5-10 个高频）
- 与 md-wechat-editor 商用授权或合作
- 导出水印叠加（若 v1.5 水印 spec 落地）

---



## 涉及文件（预估）



### 新增

```
src/
├── services/wechatExport/
│   ├── index.ts                 # buildWechatHtml, copyWechatHtml
│   ├── postProcess.ts           # li/heading 包裹
│   ├── themes/
│   │   ├── registry.ts
│   │   ├── normal.ts            # CSS 字符串
│   │   └── ...
│   └── copyToClipboard.ts
├── composables/
│   └── useWechatPreview.ts      # debounce 渲染
├── components/wechat/
│   ├── WechatPreviewPane.vue
│   ├── WechatPreviewFrame.vue   # 手机框
│   └── WechatThemePicker.vue
└── utils/wechatThemeSetting.ts  # localStorage
```



### 修改


| 文件                                              | 变更                                    |
| ----------------------------------------------- | ------------------------------------- |
| `src/stores/ui.ts`                              | `WorkspaceViewMode` + `wechatThemeId` |
| `src/views/WorkspaceView.vue`                   | `case 'wechat'`                       |
| `src/components/workspace/WorkspaceToolbar.vue` | 公众号视图入口                               |
| `src/utils/workspaceSession.ts`                 | 持久化 wechat 视图                         |
| `src/components/workspace/ExportMenu.vue`       | （切片 0）复制入口                            |
| `package.json`                                  | `juice`、`marked`（若未引入）                |




### 不改

- `TipTapEditor.vue` / WikiLink 扩展
- Tauri Rust 层（MVP 纯前端）
- 路由 `router/index.ts`（不增顶层路由）

---



## 风险与待决


| 风险                     | 等级  | 缓解                                    |
| ---------------------- | --- | ------------------------------------- |
| md-wechat-editor 非商业许可 | 高   | 方案 B 自写引擎；或用户申请商用授权                   |
| juice 大文档性能            | 中   | debounce + Web Worker（切片 2）           |
| Tauri 剪贴板 API 差异       | 中   | `plugin-clipboard-manager` fallback   |
| marked vs 自研 parser 差异 | 中   | 微信管线统一用 marked，与阅读预览分离                |
| 微信编辑器样式漂移              | 低   | 参考 md-wechat-editor 回归测试 HTML fixture |
| WikiLink / 双链语义丢失      | 低   | 产品说明 + 导出为文本                          |


---



## 需用户确认的决策点



### 决策 1 · 许可与复用策略（阻塞实现）


| 选项              | 说明                                                   |
| --------------- | ---------------------------------------------------- |
| **A. 商用授权**     | 联系 md-wechat-editor 作者取得集成授权，可较大程度移植引擎+主题            |
| **B. 算法自研（推荐）** | 仅借鉴 juice/postProcess 公开做法，主题 CSS 从 mdnice 开源主题挑选并署名 |
| **C. 非商用 Fork** | 确认狸知知识库为非商业产品，按原协议 Fork 子集                           |




### 决策 2 · MVP 范围：是否包含 :::module 排版组件


| 选项                   | 说明                                      |
| -------------------- | --------------------------------------- |
| **A. 仅 GFM（推荐 MVP）** | 标题、列表、引用、代码、表格、图片；与现有文档 100% 兼容         |
| **B. 子集 module**     | 额外支持 5-10 个高频围栏（callout、steps…），需独立语法文档 |




### 决策 3 · 入口形态确认


| 选项                              | 说明                     |
| ------------------------------- | ---------------------- |
| **A. 工作区第四视图** `wechat`**（推荐）** | Toolbar「编辑 | 图谱 | 公众号」 |
| **B. 仅 Export 菜单**              | 最小实现，无全屏预览             |
| **C. 顶层** `/wechat-studio`      | 独立工作室，与编辑流程割裂          |


---



## 建议 Agent 下一步（Implementer）

```
按 docs/superpowers/plans/2026-07-07-wechat-theme-preview.md 切片 0 或切片 1 实现。

前置：用户确认决策 1（许可）与决策 3（入口）。

切片 1 任务：
1. 扩展 ui.workspaceViewMode 增加 'wechat'
2. 创建 src/services/wechatExport/ 管线（postProcess + juice + 5 主题）
3. 复用 exportFile.embedAssetsInMarkdown 处理 asset://
4. WechatPreviewPane + Toolbar 入口
5. copyToClipboard + toast
6. pnpm build；为核心函数加 vitest

不要：改 TipTap、增顶层路由、引入云图床、npm 依赖 md-wechat-editor。
```



### 必读文件

- `src/utils/exportFile.ts` — asset base64 模式
- `src/views/WorkspaceView.vue` — 视图切换模式
- `src/components/editor/MarkdownPreview.vue` — 对比阅读预览边界
- `D:\codes\md-wechat-editor\src\engine\render\postProcessHtml.ts` — 参考
- `D:\codes\md-wechat-editor\src\engine\render\wechatCopy.ts` — 参考



### v5 扩展 · 代码块语法高亮（2026-07-07，v5.1 对齐 md-wechat-editor）

| 项 | 状态 |
| --- | --- |
| 高亮引擎 | 复用 `lowlight`，输出 `span.hljs-*` class |
| 微信兼容 | **juice 前**注入 hljs span → `WECHAT_CODE_HLJS_CSS` → juice 内联 color |
| 空格保留 | **juice 后** `preserveCodeBlockWhitespace` 将 pre 内空格转 nbsp |
| 粘贴兼容 | **juice 后** `convertColorSpansToFont` 将 span color 转 `<font>` |
| 调色板 | atom-one-dark token CSS（自写，非复制主题包） |
| 管线 | `postProcess` → `highlightCodeBlocksInHtml` → juice → nbsp → font |
| code-card | 输出标准 `<pre><code class="hljs">`，与 GFM fenced 共用管线 |
| 容器 | `#nice pre` 深色底/圆角/左强调条，对齐 md-wechat-editor wechatBaseCss |
| 行内 code | `#nice p code, #nice li code` 与 pre 分离，避免主题 accent 污染 token |

---

### 验证命令

```bash
pnpm build
pnpm tauri dev
# 手动：工作区 → 公众号视图 → 切换主题 → 复制 → 粘贴 mp.weixin.qq.com 编辑器
# 代码块：```sql 应出现彩色 token（keyword 紫、operator 青等）
```

---



## HANDOFF · Planner → Implementer

**任务 ID**：`TASK-20260707-wechat-theme-preview`  
**交出** Planner · **接收** Implementer（待用户确认决策）

### 上下文摘要

- 推荐 **工作区** `wechat` **视图**，编辑与排版渲染分离，TipTap 不替换
- md-wechat-editor **不可直接 npm 依赖**（非商业许可），默认算法自研 + 主题 CSS 挑选
- 图片必须 base64 内嵌；不做云图床
- 现有 `MarkdownPreview` 阅读主题与公众号主题无关，不复用其 CSS

