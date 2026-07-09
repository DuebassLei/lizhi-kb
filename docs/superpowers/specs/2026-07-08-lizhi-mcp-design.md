# 狸知知识库 MCP 集成设计

**文档版本**：v1.2.0  
**更新日期**：2026-07-09  
**状态**：Phase 1 + Phase 2 + 完整知识库操作已实现  

---

## 1. 目标

为狸知知识库提供 **opt-in 本地 MCP 能力**，使 Cursor / Claude Desktop 等 AI 工具在 vault 已解锁时可**搜索、读取、整理、写入**笔记。

## 2. 架构（Hybrid）

```
AI Tool (stdio) → packages/lizhi-mcp → HTTP Bearer → Bridge(13721) | Sidecar(13722) → DocumentService
```

## 3. 安全约束

| 规则 | 说明 |
|------|------|
| 默认关闭 | MCP 总开关默认 `false` |
| 仅 loopback | 禁止绑定 `0.0.0.0` |
| Bearer token | 存于 `~/.lizhi-kb/mcp-config.json` |
| Vault gate | 锁定态返回 `403 VAULT_LOCKED` |
| 写保护 | `writeEnabled` 默认 `false` |

## 4. HTTP 端点

| Method | Path | 说明 |
|--------|------|------|
| GET | `/status` | vault + MCP 状态 |
| GET | `/documents` | 文档元数据列表 |
| GET | `/documents/:id` | 读取正文 |
| GET | `/documents/:id/backlinks` | wiki 反向链接 |
| GET | `/documents/:id/unlinked-mentions` | 未链接纯文本提及 |
| GET | `/documents/:id/outbound-links` | 出站 wiki 链接 |
| GET | `/documents/:id/tags` | 文档标签 |
| GET | `/folders` | 有文档的文件夹路径 |
| GET | `/folder-tree` | UI 文件夹树 |
| GET | `/tags` | 全局标签 |
| GET | `/graph/:id?depth=` | 局部图谱（1–3） |
| GET | `/links/stats` | 链接统计 |
| GET | `/stats/dashboard` | 看板统计 |
| GET | `/stats/edit-activity?days=` | 编辑活动 |
| POST | `/search` | FTS5 + 拼音搜索 |
| POST | `/documents` | 创建（writeEnabled） |
| POST | `/documents/batch-read` | 批量读正文 |
| POST | `/documents/:id/convert-mention` | 纯文本 → wiki 链接 |
| POST | `/folders/migrate` | 文件夹前缀迁移 |
| PUT | `/documents/:id` | 保存（可选 syncTitleFromH1） |
| PUT | `/documents/:id/tags` | 设置标签 |
| PATCH | `/documents/:id/rename` | 重命名 + 传播链接 |
| PATCH | `/documents/:id/move` | 移动文件夹 |
| DELETE | `/documents/:id` | 删除 |

## 5. MCP Tools（24）

详见 `packages/lizhi-mcp/README.md`。

## 6. MCP Resources

| URI | 说明 |
|-----|------|
| `lizhi://documents` | 全部元数据 |
| `lizhi://document/{id}` | Markdown 正文 |
| `lizhi://folder-tree` | 文件夹树 |
| `lizhi://tags` | 全局标签 |

## 7. MCP Prompts

| Prompt | 说明 |
|--------|------|
| `search-knowledge-base` | 检索 + 阅读 + 回答 |
| `organize-notes` | 整理笔记工作流 |

## 8. 索引

- **FTS5**：`documents_fts`，含拼音 fallback
- **双链**：`document_links`（`[[wiki link]]`）
- **Unlinked mentions**：`document_unlinked` + `document_stripped`（增量维护）

## 9. 配置 Schema

```json
{
  "enabled": false,
  "writeEnabled": false,
  "port": 13721,
  "standalonePort": 13722,
  "sessionTimeoutMinutes": 30,
  "token": "<uuid-v4>"
}
```

路径：`~/.lizhi-kb/mcp-config.json`

## 10. 验收标准

1. Settings 开启 MCP 后 `/status` 返回 unlocked
2. Cursor 可 search / read / backlinks / unlinked / rename / move / tags（写操作需 writeEnabled）
3. Rust 索引含 unlinked mentions，与 UI BacklinksPanel 语义一致
4. `pnpm build` 与 `cargo test link_index handlers` 通过

## 11. 后续

- 资产（图片）读写 MCP 端点
- Playwright MCP smoke E2E
- 前端搜索/双链统一走 Rust IPC（双索引一致）
