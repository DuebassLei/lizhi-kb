# Word 导出样式优化（Styles + Numbering）

> 状态：已实现  
> 日期：2026-07-17  
> 范围：工作区单文档导出为 `.docx`

## 1. 背景与目标

当前 `exportDocx.ts` 为最小 Markdown→DOCX：未定义 Word 样式表、无真正列表编号、无表格、代码块无底色，中文字体依赖 Word 默认，观感偏「纯文本」。

**目标**：导出结果打开后像正式文档；提供三套可切换模板；默认「技术文档」并记住上次选择。

## 2. 方案

采用 **完整 Word `styles` + `numbering`**（brainstorming 方案 2）：

- 每套模板覆盖：`Normal` / `Title` / `Heading1–6` / 正文旁白样式（引用、代码）
- 无序/有序列表走 `numbering` 引用，非手打 `•` / `1.`
- GFM 表格 → `docx` Table API
- 代码块段落使用带底色的段落样式

## 3. 模板

| ID | 名称 | 定位 | 默认 |
|----|------|------|------|
| `tech` | 技术文档 | 雅黑正文、层级清晰、代码底色醒目 | **是** |
| `office` | 办公报告 | 宋体正文、黑体标题、公文边距 | |
| `proposal` | 方案书 | 更大标题、更宽留白、强调色标题 | |

偏好键：`localStorage` → `lizhi-kb-docx-theme`（与水印等设置同模式）。

## 4. 模块

| 文件 | 职责 |
|------|------|
| `src/utils/docxThemes.ts` | 主题元数据 + `styles` / `numbering` / 页边距构建 |
| `src/utils/docxThemeSetting.ts` | 读写上次模板 |
| `src/utils/exportDocx.ts` | MD 解析增强；套用 style/numbering；表格 |
| `src/utils/exportFile.ts` | `exportDocument` / `exportWord` 传入 `themeId` |
| `ExportMenu.vue` | 选 Word 后展示模板；确认时持久化并导出 |

## 5. 内容能力（本迭代）

- 已有：标题、段落、引用、行内粗斜体删除线代码、链接/wiki 色、图片、分割线（底边框）
- 新增：真列表、代码块底色样式、GFM 表格（简单 `|` 表，无合并单元格）
- 不做：脚注、任务列表、深嵌套列表、PDF 共用主题、水印/加密

## 6. UI

导出菜单选「Word」→ 确认面板增加三选一模板（高亮当前/上次）→「确认导出」写入偏好并生成文件。

## 7. 验收

1. 三种模板导出的 docx 打开后标题样式可在 Word「样式」窗格识别（Heading 1 等）。
2. 连续有序列表为 Word 自动编号；中断后再开新列表可从 1 重计。
3. 代码围栏有浅色底；表格至少两列可读。
4. 默认选中「技术文档」；再次打开菜单仍为上次选择。
5. `pnpm verify` 通过；既有 Word 导出 e2e 仍绿（确认步兼容主题选择）。

## 8. 非目标

- 不改 PDF/HTML 导出观感
- 不引入第三方 MD→DOCX 转换器
