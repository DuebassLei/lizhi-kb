# 知识卡片 · 产品设计

> **版本**: 1.0.0  
> **日期**: 2026-07-15  
> **状态**: 已批准接入工作区  
> **来源**: `d:\codes\test\DESIGN.md`（独立原型设计）适配狸知知识库

---

## 1. 概述

将当前工作区 Markdown 文档解析为多张视觉知识卡片（小红书/微信贴图/方形等），支持主题、智能分页与 PNG/PDF/ZIP 导出。

与**公众号排版**预览并列：分栏预览类型为 `gfm | wechat | card`，主题体系**不合并**。旧计划「不做小红书」仅约束公众号主题管线，不阻塞本功能的小红书卡片格式。

### 1.1 入口（IA）

| 项 | 说明 |
|----|------|
| 路由 | `/workspace?preview=card`；短链 `/knowledge-cards` → 同上 |
| 工具栏 | 「阅读 \| 公众号 \| 知识卡片」 |
| 正文 | `documents.content`（当前打开文档） |
| 不新开 | 独立侧栏顶级路由、独立 Tauri 应用壳 |

### 1.2 核心能力

- Markdown 解析（markdown-it；`---` → 强制分页）
- DOM 测量 + 贪心分页（标题防孤行、原子块、尾部空间阈值）
- 格式：小红书 3:4、微信贴图、方形、竖屏故事、自定义
- 13+ 套内置主题（分组：社交 / 信笺 / 复古 / 现代 / 技术 / 极简），含 chrome 布局（信笺、窗口、Nebula、技术顶栏）+ 自定义主题编辑器
- 导出：PNG / PDF / ZIP（1x/2x/3x）；Tauri `write_export_binary`

### 1.3 不做

- 把生成卡片写回 vault 文档
- 与公众号主题/CSS 共用
- 云同步

---

## 2. 数据流

```
documents.content
  → embedAssets（可选）
  → parse → measure → paginate
  → knowledgeCards store
  → CardRenderer × N（CSS 变量主题）
  → 导出 PNG/PDF/ZIP
```

---

## 3. 模块落点

见实现目录：`src/types/knowledgeCards.ts`、`src/themes/knowledgeCards/`、`src/composables/knowledgeCards/`、`src/components/knowledgeCards/`、`src/stores/knowledgeCards.ts`、`src/stores/knowledgeCardTheme.ts`。

---

## 4. 安全

- 仅解锁后使用文档内容；导出不进 vault
- markdown-it `html: false`；自定义 CSS 限制作用域
- 密钥/DEK 不进日志

---

## 5. 验收

- 工作区可切知识卡片分栏并预览多张卡片
- `---` 强制分页 + 智能分页防割裂
- 5 格式 + 6 主题可切换
- PNG/PDF/ZIP 可导出
- 主题编辑器可保存/导入/导出自定义主题
- `pnpm verify` 通过
