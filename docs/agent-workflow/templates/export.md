# 任务模板 · 导出

## 元信息

| 字段 | 值 |
|------|-----|
| 类型 | export |
| 格式 | Markdown / PDF / … |
| Spec | complete-design 导出与水印章节 |

## 功能范围

- 导出入口：`src/components/workspace/ExportMenu.vue`
- 工具：`src/utils/exportFile.ts`
- 水印：`composables/useWatermark.ts`、`WatermarkOverlay.vue`

## 安全要求

- [ ] 导出内容来自已解锁 vault
- [ ] 水印策略符合 spec（界面/导出）
- [ ] 临时文件清理（Tauri 侧如有）

## 验收标准

- [ ] 选定文档可导出为目标格式
- [ ] 文件名、编码正确（中文路径）
- [ ] 大文档不阻塞 UI（异步/进度）

## Agent 编排

```
Planner（spec 导出章节）→ Implementer → Reviewer（水印 + 泄露面）
```

## 验证

```bash
pnpm tauri dev
# 手动：导出 MD/PDF，检查水印与内容完整性
```
