# 狸知知识库 v1.0 完整交付计划

**日期**: 2026-07-06  
**范围**: v1.0 Vault MVP（默认无密码、看板首页）  
**约束**: 产品 spec 为准，非 prototype demo

## 交付清单

### A. Rust 后端 (`src-tauri/`)
- [ ] `~/.lizhi-kb/` 数据目录初始化
- [ ] SQLite: documents, edit_activity 表
- [ ] Tauri commands: list/read/save/create/delete_document, get_edit_activity, get_dashboard_stats
- [ ] 默认明文落盘；passwordEnabled 时预留加密接口

### B. 前端 UI/UX (`src/`)
- [ ] 看板四 Tab：概览 / 热力图 / 链接 / 审计
- [ ] GitHub 风格热力图组件
- [ ] TipTap 编辑器 + 自动保存
- [ ] 侧边栏文档树 CRUD
- [ ] `useDocumentService` 统一 Tauri / localStorage fallback
- [ ] Vault Noir 视觉 polish（ui-ux-pro-max）

### C. Playwright E2E (`tests/`)
- [ ] `@playwright/test` 配置
- [ ] 场景：首页看板 → 创建工作区文档 → 编辑保存 → 热力图可见
- [ ] `pnpm test:e2e` 可跑

## 用户偏好（必须遵守）
- 默认首页：`/insights` 看板
- 默认无需密码；设置中可选启用
- 图谱在工作区内嵌，非独立路由

## 验收
- `pnpm run build` 通过
- `pnpm test:e2e` 通过（Chromium）
- 浏览器 `pnpm dev` 可完整走通 CRUD + 看板
