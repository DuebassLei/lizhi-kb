# 狸知知识库 · 编辑页写作卡顿优化

**文档版本**：v1.0.0  
**更新日期**：2026-07-17  
**状态**：已实现（v1 降载）  
**策略**：方案 1 — 先度量可归因，默认落地高收益修复（预览 idle、Pinia 同步 debounce、保存/onSaved 降载、revision 节流）

## 1. 问题

桌面端（Tauri vault）工作区写文章卡顿。常用源码 + GFM 分栏；公众号/卡片也会用。长短文均可出现，时机可能是连续输入、停键预览重绘或自动保存尖峰。

## 2. 成功标准

1. 源码 + GFM 分栏下连续输入明显更跟手  
2. 停键后预览最终与源码一致；切文档 / 手动保存不丢字  
3. 自动保存仍落盘；FTS/双链最终一致（可短窗口延迟）  
4. DEV 下可用 Performance 标记区分 content-update / preview / autosave  
5. `pnpm verify` 通过

## 3. 实现要点

| 项 | 做法 |
|----|------|
| GFM 预览 | idle ~500ms；generation 取消过期渲染；DEV measure |
| 公众号 / 卡片 | idle ~600ms / ~500ms |
| Pinia 同步 | 编辑缓冲 + ~120ms debounce；保存/切文档前 flush |
| 自动保存 | debounce 1200ms；IPC 热路径仅落盘+FTS+双链；未链接/revision 后台合并；onSaved 重活 idle 延后 |
| Revision | 同文档最短间隔 30s；且走后台队列 |
| Links IPC | 保存后 patch 本地索引；Rust 三连 IPC 延后 |

## 4. 明确不做（本轮）

虚拟化整篇预览、换编辑器、砍 FTS/双链、改 IA。

## 5. 验收手测

- 样例文 + 源码/GFM：连续打字 → 停 2s → 再打  
- 切文档、Ctrl+S、解锁库加密路径  
- 预览最终一致；历史版本面板仍有版本（可能略疏）
