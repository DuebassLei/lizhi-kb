# 任务模板 · UI/UX

## 元信息

| 字段 | 值 |
|------|-----|
| 类型 | ui |
| 参考 | `prototype/index.html` / Figma / spec 章节 |
| 路由/视图 | Welcome / Unlock / Insights / Workspace / Settings |

## 设计约束

- 品牌：猫系、安静、加密知识库（见 brand spec）
- Token：`src/styles/tokens.css`
- 暗色/亮色：`utils/theme.ts`
- **原型 ≠ IA**：以 complete-design spec 路由为准

## 验收标准

- [ ] 视觉与交互符合 spec / 原型参考
- [ ] 键盘可达性（Command Palette、快捷键）
- [ ] 响应式（最小宽度 …）
- [ ] 无 layout shift / 控制台 error

## 文件范围

| 区域 | 典型路径 |
|------|----------|
| 布局 | `src/components/layout/` |
| 工作区 | `src/components/workspace/` |
| 编辑器 | `src/components/editor/` |
| 看板 | `src/components/insights/` |
| Vault | `src/components/vault/` |

## Agent 编排

```
Planner（对照 spec + 原型）→ Implementer（组件）→ Reviewer（a11y + 品牌）
```

## 验证

```bash
pnpm dev
# 截图对比原型；检查 Workspace 三视图切换
```
