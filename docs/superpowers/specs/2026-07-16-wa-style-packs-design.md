# 写作助手 · 风格包与配置完善

> **版本**: 1.0.0  
> **日期**: 2026-07-16  
> **状态**: 已实现  
> **关联**: [AI 写作小助手](./2026-07-15-ai-writing-assistant-design.md)

---

## 1. 目标

完善写作助手**配置面**：用可扩展「风格包」替换旧 4 种标签式预设；迁入 wechat-article-writer 的 9 种完整写作规范；配置 UI 卡片化；支持 vault 内覆盖/自定义落盘与 `.lizhi` 备份；生成时向选题/正文/去 AI 味注入完整风格规范。

### 1.1 成功标准

1. 配置抽屉展示 9 张内置风格卡，无 `clear/story/rigorous/casual`。
2. 选「高流量/爆款」生成时，prompt 含完整规范（非仅标签名）。
3. 可编辑覆盖、另存自定义、恢复内置、删除自定义；文件位于 `~/.lizhi-kb/writing-styles/`。
4. 旧 localStorage `stylePreset` 迁移为 `stylePackId: "default"`。
5. 浏览器预览：仅内置可选，写操作禁用。
6. `.lizhi` 备份含 `writing-styles/`（存在则打包）。

### 1.2 非目标

联网调研、风格提取向导、drawio/AI 文生图、:::module 进写作助手、公众号上传、迁入 `ai-config.json`。

---

## 2. 数据模型

```ts
type WaStylePackSource = "builtin" | "vault";

interface WaStylePack {
  id: string;              // 英文 slug
  label: string;
  hint: string;
  wordRange?: string;
  order: number;
  promptMarkdown: string;
  source: WaStylePackSource; // 合并后：纯内置 | vault 覆盖或自定义
  hasBuiltin: boolean;       // 是否存在同名内置（用于「恢复内置」）
}

interface WaConfig {
  // …
  stylePackId: string;       // 替代 stylePreset
  styleExtra?: string;
}
```

### 内置 9 包 id

| order | id | label |
|------|-----|--------|
| 1 | `default` | 默认 |
| 2 | `viral` | 高流量/爆款 |
| 3 | `checklist` | 清单体/方法论 |
| 4 | `resourceRoundup` | 资源盘点 |
| 5 | `toolReview` | 个人实测推荐 |
| 6 | `contrarian` | 认知颠覆 |
| 7 | `identity` | 身份共鸣/逆袭 |
| 8 | `storyEmotional` | 故事化/情感共鸣 |
| 9 | `personalEssay` | 深度随笔 |

专有名词策略：保留结构与语气，明显品牌名改为 `{author}` / `{publication}`；注入时默认替换为「作者」/「本公众号」。

---

## 3. Vault 落盘

路径：`{data_dir}/writing-styles/{id}.md`（不进 `workspace/`）。

```markdown
---
id: viral
label: 高流量/爆款
hint: 概念科普、行业观察
wordRange: 2500–4000 字
order: 2
---

（风格规范正文）
```

合并：同 id 时 vault 覆盖内置。角标：内置 / 已覆盖 / 自定义。

### Tauri IPC

- `list_writing_style_packs`
- `get_writing_style_pack`
- `save_writing_style_pack`
- `delete_writing_style_pack`（仅 vault 文件）
- `reset_writing_style_pack`（删覆盖，恢复内置）

校验：`id` 匹配 `^[a-z][a-zA-Z0-9_-]*$`；正文 ≤ 12000 字符；路径禁止 `..`。

---

## 4. 配置 UX

`WaConfigPanel`：风格卡片区置顶（复用 framework 卡片视觉）→ 大纲框架 → 写作（格式 + styleExtra）→ 篇幅与改写 → 封面与配图。

选中后操作：查看规范 / 编辑并覆盖 / 另存为自定义 / 恢复内置 / 删除。

---

## 5. Prompt 注入

- **注入**：选题、正文、去 AI 味  
- **不注入**：大纲、配图提示词  
- 注入截断上限：8000 字符（查看仍全文）  
- 去 AI 味三档附短指令（轻/中/重）

---

## 6. 迁移与备份

- `stylePreset: clear|story|rigorous|casual` → `stylePackId: "default"`  
- defaults 仍 `localStorage`  
- `.lizhi` v2：打包 `writing-styles/`；merge 按文件名覆盖本地同名，本地独有保留  

---

## 7. 验收

见 §1.1；另：`pnpm verify`；单测覆盖 migrate、占位符、截断、frontmatter 解析。
