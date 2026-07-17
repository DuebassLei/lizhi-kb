# 备份扩展与合并恢复设计

> 状态：v2 完整实现（Tier 2 UI 状态 + `merge-documents` 文档合并）  
> 关联：`src-tauri/src/backup/archive.rs`、`src-tauri/src/prefs/`

## 背景

当前 `.lizhi` 完整备份（format v1）仅包含 vault 核心：

- `vault.meta.json`、`keys.enc`
- `vault.db` / `lizhi-kb.db`
- `workspace/`、`assets/`

大量用户数据存于 `~/.lizhi-kb/` 其他文件或 WebView `localStorage`，换机恢复后会丢失。

## 数据分级

### Tier 1 — 必须纳入备份（知识库完整性）

| 数据 | 当前位置 | v2 方案 |
|------|----------|---------|
| 文档元数据 + 正文 | DB + `workspace/` | 已有 |
| 资源文件 | `assets/` | 已有 |
| 需求看板 | DB `requirements` | 已有 |
| 每日小记 | DB `journal_entries` | 已有 |
| 编辑热力图 | DB `edit_activity` | 已有 |
| **密码本** | DB `credential_entries` | 已有（随 vault.db） |
| **上线记录** | DB `launch_records` | 已有（随 vault.db） |
| **幕布** | DB `mubu_docs` + `mubu_nodes` | 已有（随 vault.db；`merge-documents` 整树合并） |
| 链接图谱 / 搜索索引 | DB | 已有（可重建） |
| **文件夹树 + 文档排序** | `localStorage` `lizhi-kb-folders` | → `vault-ui-state.json` |
| **文档标签** | `localStorage` `lizhi-kb-doc-tags` | → `vault-ui-state.json` |
| **AI 配置** | `ai-config.json` | 纳入备份（可选文件） |
| **AI 密钥** | `ai-secrets.json(.enc)` | 纳入备份（可选；加密库密封） |
| **CC 工作台配置** | `cc-workbench.json` | 纳入备份（可选文件） |
| **CC 工作台密钥** | `cc-secrets.json(.enc)` | 纳入备份（可选；加密库密封） |
| **MCP 配置** | `mcp-config.json` | 纳入备份（可选文件；token 仍为明文） |
| **文档历史版本** | `revisions/` | 纳入备份 |

### Tier 2 — 建议纳入（体验连续）

| 数据 | 当前位置 | 建议 |
|------|----------|------|
| AI 对话历史 | `localStorage` `lizhi-kb-chat-sessions-v1` | 后续写入 `vault-ui-state.json` |
| 看板背景图 | `localStorage` `lizhi-kb-insights-hero-bg` | 体积大，可迁 `assets/` 或单独字段 |
| 图谱节点坐标 | `localStorage` `lizhi-kb-graph-node-pos` | 可并入 `vault-ui-state.json` |
| 置顶 / 最近文档 | `localStorage` | 可并入 `vault-ui-state.json` |

### Tier 3 — 不纳入（设备本地偏好）

| 数据 | 原因 |
|------|------|
| 主题、侧边栏宽度、分栏比例 | 纯 UI 布局，换机默认值即可 |
| 自动锁定分钟数、失焦锁定 | 安全策略宜按设备重设 |
| 水印设备后缀 | 应随设备重新生成 |
| 微信导出主题选择 | 导出偏好，非知识库数据 |
| `lizhi-kb-data`（浏览器模式） | 仅 `pnpm dev` 预览用 |

## `.lizhi` format v2

`manifest.formatVersion` 升为 `2`。v1 备份仍可导入。

### 新增可选条目

```
ai-config.json
ai-secrets.json / ai-secrets.json.enc
mcp-config.json
cc-workbench.json
cc-secrets.json / cc-secrets.json.enc
vault-ui-state.json
revisions/
writing-styles/
```

收集规则：文件/目录存在则打包并写入 manifest；不存在则跳过（兼容旧库）。

### `vault-ui-state.json` 结构

```json
{
  "schemaVersion": 1,
  "folders": {
    "expanded": {},
    "order": {},
    "folderOrder": {},
    "folders": []
  },
  "documentTags": {
    "doc-id": ["标签1"]
  }
}
```

Tauri 运行时双写：`localStorage`（即时 UI）+ 磁盘文件（备份 SSOT）。启动时磁盘 → localStorage 覆盖（hydrate）。

## 恢复模式

### `replace`（默认，已有）

整库替换 `~/.lizhi-kb/` 中备份包含的全部文件；备份外文件在目标目录内被清空。  
成功后 **必须重启**。

适用：灾难恢复、换机全量迁移。

### `merge`（v2 新增 — 设置合并）

**不修改** `workspace/`、数据库、密钥；仅从备份解压并合并：

- `ai-config.json` — 备份覆盖（提供商列表以备份为准）
- `ai-secrets.json` / `ai-secrets.json.enc` — 备份覆盖（加密库为 AES-GCM 密封文件）
- `mcp-config.json` — 备份覆盖（token 以备份为准，注意 MCP 端口冲突）
- `cc-workbench.json` — 备份覆盖
- `cc-secrets.json` / `cc-secrets.json.enc` — 备份覆盖
- `vault-ui-state.json` — 字段级合并（见下）

成功后 **无需重启**；前端重新 hydrate UI 状态即可。

适用：从旧设备备份恢复 AI/CC 工作台/文件夹/标签，保留当前机器上的文档。

#### `vault-ui-state.json` 合并规则

| 字段 | 规则 |
|------|------|
| `folders.folders` | 按 `id` 并集；同 id 备份 `label` 覆盖 |
| `folders.folderOrder` | 按 key 合并；备份中列出的顺序追加到本地未出现的 id |
| `folders.order` | 同上（每文件夹内文档排序） |
| `folders.expanded` | 本地保留，备份键补充 |
| `documentTags` | 按 docId 合并标签集（去重 union） |

### `merge-documents`（v2 已实现）

文档级合并：按 `documents.id` 并集；`updated_at` 较新者胜；缺失资源按文件名去重复制。  
同时执行与 `merge` 相同的设置合并，并按 `updated_at` 合并 DB 表 `requirements`、`journal_entries`、`edit_activity`、`credential_entries`、`launch_records`、`mubu_docs`/`mubu_nodes`（幕布按篇整树替换；后几项若备份中不存在则跳过）。  
`revisions/` 按文档 id + 版本 id 并集合并：本地已有同 id 快照则保留，缺失则导入（必要时用当前库 DEK 重密封）。  
加密备份需输入主密码以读取备份内容。成功后刷新文档列表，无需重启。

> 注意：历史版本无本地条数上限，频繁编辑的库导出体积可能显著增大。

#### `vault-ui-state.json` 结构（schema v2）

```json
{
  "schemaVersion": 2,
  "folders": { ... },
  "documentTags": { ... },
  "chatSessions": { "workspace": {}, "standalone": {} },
  "insightsHeroBackground": "data:image/...",
  "graphNodePositions": { "doc-id": { "x": 0, "y": 0 } },
  "pinnedDocIds": ["id1"],
  "recentDocIds": ["id2"]
}
```

### `merge-documents`（原规划，已实现见上）

文档级合并：按 `documents.id` 并集导入；`updated_at` 较新者胜；冲突资产按 hash 去重。  
工作量大，单独迭代。→ **已完成 v2**

## 安全注意

- 加密库下 `ai-secrets.json.enc` / `cc-secrets.json.enc` 使用与文档相同的 DEK（AES-256-GCM）密封，导出进 `.lizhi` 后仍为密文；合并加密备份需主密码以解封并重密封到目标库。
- `mcp-config.json`（含 token）、`ai-config.json`、`cc-workbench.json` 仍为 **明文**。用户应妥善保管备份文件。
- 未启用主密码时，AI/CC 密钥在备份内为明文 JSON。

## 验收标准

- [x] 导出 `.lizhi` 含 `ai-config.json` / `ai-secrets.json` / `mcp-config.json`（若存在）
- [x] 导出含 `vault-ui-state.json`（若存在）
- [x] `replace` 恢复后文件夹树、标签、AI 配置与源机一致
- [x] `merge` 恢复后当前文档不变，设置从备份合并
- [x] v1 备份仍可 `replace` 导入
- [x] Tier 2：对话历史、看板背景、图谱坐标、置顶/最近文档纳入 `vault-ui-state.json`
- [x] `merge-documents`：按 `updated_at` 合并文档与资源，并合并设置及密码本/上线记录/幕布
- [x] 幕布：`replace` 随库恢复；`merge-documents` 按篇整树合并
- [x] `launch_records` 合并时若 `record_number` 与本地冲突则跳过该条（不覆盖已有单号）
- [x] 导出含 `revisions/`（若存在）；`merge-documents` 并集合并历史快照
- [x] `merge` 含 `cc-workbench.json` / `cc-secrets.json`
- [x] 加密库下 AI/CC secrets 本地与备份均为 DEK 密封（`.enc`）；MCP config 仍明文并在 UI 提示

## 实现文件

| 层 | 文件 |
|----|------|
| Rust prefs | `src-tauri/src/prefs/mod.rs` |
| Rust backup | `src-tauri/src/backup/archive.rs` |
| IPC | `commands.rs` `get_vault_ui_state` / `save_vault_ui_state` |
| 前端 | `src/services/vaultUiStateService.ts` |
| 设置页 | `BackupRestorePanel.vue` 合并恢复入口 |
