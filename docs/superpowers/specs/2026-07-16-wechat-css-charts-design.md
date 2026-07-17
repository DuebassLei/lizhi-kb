# 设计 · 公众号 CSS 图表模块

**日期**: 2026-07-16  
**状态**: 已实现（方案 B）  
**范围**: `src/services/wechatExport/layoutModulesCharts.ts` + 插入菜单「图表」分组

## 模块

| 语法 | 说明 |
|------|------|
| `:::bar-chart` | 横向条形 |
| `:::column-chart` | 纵向柱状 |
| `:::progress` | 0–100 进度 |
| `:::donut` / `:::pie-chart` | 环形占比（conic-gradient） |
| `:::line-chart` | 折线趋势（圆点 + 趋势摘要） |
| `:::radar-chart` | 多维度雷达；支持「维度 \| A \| B」多系列 |
| `:::stack-bar` | 横向堆叠条 |

## 约束

- 纯 HTML/CSS，不引入 Chart.js
- 主题色取自当前公众号主题 accent
- 复制到微信为静态样式；不做交互动画

---

## 补充 · 实用排版模块（同日）

见 `layoutModulesPractical.ts`，插入菜单「实用增强」+ 图表扩展：

| 语法 | 说明 |
|------|------|
| `:::before-after` | 前后对比 |
| `:::pros-cons` | 优缺点 |
| `:::number-callout` | 大数字结论 |
| `:::quote-thread` | 对话访谈 |
| `:::checklist-done` | 完成 / 待办 |
| `:::footnote-box` | 文末备注 |
| `:::chapter-nav` | 章节导读 |
| `:::key-takeaway` | 读完带走 |
| `:::alert-banner` | 通知条 |
| `:::score-card` | 评分卡 |
| `:::recipe-meta` | 难度 / 耗时信息条 |
| `:::image-caption` | 配图图注 |
| `:::heatmap` | 热力表 |
| `:::grouped-bar` | 分组柱状 |
| `:::waterfall` | 瀑布增减 |
