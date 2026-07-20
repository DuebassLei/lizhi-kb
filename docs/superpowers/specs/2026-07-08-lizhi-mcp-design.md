# 狸知知识库 MCP 集成设计

**文档版本**：v1.3.0  
**更新日期**：2026-07-14  
**状态**：Bridge-only；stdio adapter 随安装包分发  

---

## 1. 目标

为狸知知识库提供 **opt-in 本地 MCP 能力**，使 Cursor / Claude Desktop 等 AI 工具在 vault 已解锁时可**搜索、读取、整理、写入**笔记。

## 2. 架构（Bridge）

```
AI Tool (stdio) → resources/lizhi-mcp/index.js → HTTP Bearer → Bridge(13721) → DocumentService
```

- 狸知进程内嵌 Bridge；关闭应用后 MCP 不可用
- 适配器以 esbuild 单文件打入 `src-tauri/resources/lizhi-mcp/`，随安装包分发
- 本机需 Node.js；设置页「复制 Cursor 配置」写入绝对路径

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
| POST | `/folders/migrate` | 文件夹前缀迁移（同步侧栏树；清理空祖先） |
| POST | `/folders/ensure` | 确保侧栏文件夹路径存在（可空夹；writeEnabled） |
| POST | `/folders/delete` | 删除侧栏文件夹（含子夹；夹内文档迁上级；writeEnabled） |
| PUT | `/documents/:id` | 保存（可选 syncTitleFromH1） |
| PUT | `/documents/:id/tags` | 设置标签 |
| PATCH | `/documents/:id/rename` | 重命名 + 传播链接 |
| PATCH | `/documents/:id/move` | 移动文件夹 |
| DELETE | `/documents/:id` | 删除 |

## 5. MCP Tools（30）

详见 `packages/lizhi-mcp/README.md`。

`create` / `move` / `ensure` / `migrate` 会同步 upsert `vault-ui-state.json` 的 folders 注册表（祖先链），避免侧栏将未登记路径归一到「收件箱」。可省略 `projects/` 前缀。

`lizhi_delete_folder`（`POST /folders/delete`）从侧栏树移除目录及子孙；夹内文档先迁往上级（或 `moveDocumentsTo`）；可向上 prune 空祖先。不可删 `inbox` / `projects`。`migrate` 后也会 prune 旧前缀的空祖先链。

回收站：`lizhi_delete_document` 为软删；另提供 `lizhi_restore_document`、`lizhi_list_trashed_documents`、`lizhi_purge_document`（永久删除）、`lizhi_empty_trash`。

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
  "token": "<uuid-v4>"
}
```

路径：`~/.lizhi-kb/mcp-config.json`（旧文件中的 `standalonePort` / `sessionTimeoutMinutes` 读取时忽略）

## 10. 验收标准

1. Settings 开启 MCP 后 `/status` 返回 unlocked、`mode=bridge`
2. Cursor 可 search / read / backlinks / unlinked / rename / move / tags（写操作需 writeEnabled）
3. 安装包 / 开发态均可解析 `lizhi-mcp/index.js`；复制配置为绝对路径
4. 无 Sidecar / `lizhi-mcpd` 入口
5. `pnpm verify` 通过

## 11. 后续

- Playwright MCP smoke E2E
- 前端搜索/双链统一走 Rust IPC（双索引一致）
