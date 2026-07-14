# 狸知知识库 MCP（HTTP Bridge）

stdio MCP 服务：Cursor / Claude Desktop 等通过 **stdio** 拉起本适配器，再经 HTTP 连接狸知进程内 Bridge（默认 `127.0.0.1:13721`）。

## 快速开始

1. 狸知 → **设置 → AI 集成 / MCP** → 开启桥接 → **复制 Cursor 配置**
2. 粘贴到 Cursor MCP 设置（本机需 Node.js）
3. 保持狸知运行且 vault 已解锁

安装包用户无需拉源码：适配器随应用打包在 `resources/lizhi-mcp/index.js`。

## 开发构建

```bash
pnpm --dir packages/lizhi-mcp build   # esbuild 单文件 → dist/index.js
node scripts/sync-lizhi-mcp-resources.mjs
```

`pnpm build` / `pnpm verify` 会自动构建并同步到 `src-tauri/resources/lizhi-mcp/`。

## Tools

详见设置页复制配置后的工具列表，或源码 `src/tools.ts`。

文件夹相关（需 `writeEnabled`）：

- `lizhi_ensure_folder` — 注册侧栏路径（可空夹）
- `lizhi_delete_folder` — 删除侧栏夹（含子夹；文档先迁上级；可清理空祖先）
- `lizhi_migrate_folder_prefix` — 批量迁前缀（同步树并 prune 空祖先）

## 环境变量

| 变量 | 说明 |
|------|------|
| `LIZHI_MCP_URL` | Bridge URL，默认 `http://127.0.0.1:13721` |
| `LIZHI_MCP_TOKEN` | Bearer token（必填，在狸知设置中复制） |
| `LIZHI_MCP_SCRIPT` | 可选，覆盖 adapter 脚本路径（开发调试） |

## 说明

- 仅 **Bridge** 模式；关闭狸知后 MCP 不可用
- 绑定 loopback；默认写保护（`writeEnabled`）
