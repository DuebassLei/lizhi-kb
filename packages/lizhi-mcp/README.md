# 狸知知识库 MCP（Phase 1 + Phase 2 Sidecar）

stdio MCP 服务，支持 **Bridge**（狸知运行中）与 **Standalone**（`lizhi-mcpd`）两种后端。

## 快速开始

1. 狸知 → **设置 → AI 集成 / MCP** → 开启桥接 → 复制 Cursor 配置
2. 构建 adapter：`pnpm --dir packages/lizhi-mcp build`
3. 重启 Cursor MCP

## Tools（24 个）

### 只读

| Tool | 说明 |
|------|------|
| `lizhi_status` | 桥接 / vault 状态 |
| `lizhi_list_documents` | 文档元数据列表 |
| `lizhi_list_folders` | 已有文档的文件夹路径 |
| `lizhi_get_folder_tree` | UI 文件夹树（含空文件夹） |
| `lizhi_list_tags` | 全局标签 |
| `lizhi_read_document` | 读单篇正文 |
| `lizhi_read_documents` | 批量读正文 |
| `lizhi_search` | FTS5 + 拼音搜索 |
| `lizhi_get_backlinks` | wiki 反向链接 |
| `lizhi_get_unlinked_mentions` | 未链接的纯文本提及 |
| `lizhi_get_outbound_links` | 出站 wiki 链接 |
| `lizhi_get_graph` | 局部知识图谱 |
| `lizhi_get_link_stats` | 链接统计 / 孤儿 / 枢纽 |
| `lizhi_get_dashboard_stats` | 看板统计 |
| `lizhi_get_edit_activity` | 编辑活动 |
| `lizhi_get_document_tags` | 文档标签 |

### 写入（需设置中开启 MCP 写入）

| Tool | 说明 |
|------|------|
| `lizhi_create_document` | 创建（默认 folder=`inbox`） |
| `lizhi_save_document` | 保存（默认从 H1 同步标题） |
| `lizhi_rename_document` | 重命名 + 可选传播 `[[链接]]` |
| `lizhi_move_document` | 移动文件夹 |
| `lizhi_set_document_tags` | 设置标签 |
| `lizhi_convert_unlinked_mention` | 纯文本提及 → wiki 链接 |
| `lizhi_migrate_folder_prefix` | 批量迁移文件夹前缀 |
| `lizhi_delete_document` | 删除 |

## Resources

| URI | 说明 |
|-----|------|
| `lizhi://documents` | 全部元数据 JSON |
| `lizhi://document/{id}` | Markdown 正文 |
| `lizhi://folder-tree` | 文件夹树 |
| `lizhi://tags` | 全局标签 |

## Prompts

- `search-knowledge-base` — 检索 + 阅读 + 回答
- `organize-notes` — 整理笔记工作流

## Sidecar

```bash
cd src-tauri
cargo run --bin lizhi-mcpd
```

环境变量见下方表格。数据目录可用 `LIZHI_KB_DATA_DIR` 覆盖 `~/.lizhi-kb`。

## 环境变量

| 变量 | 说明 |
|------|------|
| `LIZHI_MCP_BACKEND` | `http_bridge`（默认）或 `standalone` |
| `LIZHI_MCP_URL` | Bridge URL，默认 `http://127.0.0.1:13721` |
| `LIZHI_MCP_STANDALONE_URL` | Sidecar URL，默认 `http://127.0.0.1:13722` |
| `LIZHI_MCP_TOKEN` | Bearer token（必填） |
| `LIZHI_KB_DATA_DIR` | 可选，覆盖数据目录 |
| `LIZHI_MCP_SCRIPT` | 可选，adapter 脚本路径 |

## 互斥

狸知桌面应用与 `lizhi-mcpd` 通过 `~/.lizhi-kb.lock` 互斥，不可同时运行。
