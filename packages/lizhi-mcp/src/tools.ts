import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { LizhiBackend } from "./types.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function okText(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function err(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function wrap(fn: () => Promise<unknown>): Promise<ToolResult> {
  return fn()
    .then((data) => ok(data))
    .catch((error) =>
      err(error instanceof Error ? error.message : String(error)),
    );
}

export function registerLizhiTools(server: McpServer, backend: LizhiBackend) {
  server.registerResource(
    "documents-index",
    "lizhi://documents",
    { description: "知识库全部文档元数据索引（JSON）", mimeType: "application/json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await backend.listDocuments(), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "folder-tree",
    "lizhi://folder-tree",
    { description: "UI 文件夹树（vault-ui-state）", mimeType: "application/json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await backend.getFolderTree(), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "tags-index",
    "lizhi://tags",
    { description: "全局文档标签列表", mimeType: "application/json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await backend.listTags(), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "document",
    new ResourceTemplate("lizhi://document/{id}", { list: undefined }),
    { description: "按 UUID 读取 Markdown 文档正文", mimeType: "text/markdown" },
    async (uri, { id }) => {
      const doc = await backend.readDocument(String(id));
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: doc.content }],
      };
    },
  );

  const tools: Array<{
    name: string;
    description: string;
    schema: Record<string, z.ZodTypeAny>;
    run: (args: Record<string, unknown>) => Promise<ToolResult>;
  }> = [
    {
      name: "lizhi_status",
      description: "检查狸知知识库 MCP 桥接与 vault 可用性",
      schema: {},
      run: () => wrap(() => backend.status()),
    },
    {
      name: "lizhi_list_documents",
      description: "列出知识库文档元数据（不含正文）",
      schema: {},
      run: () => wrap(() => backend.listDocuments()),
    },
    {
      name: "lizhi_list_folders",
      description: "列出已有文档的文件夹路径",
      schema: {},
      run: () => wrap(() => backend.listFolders()),
    },
    {
      name: "lizhi_get_folder_tree",
      description: "读取 UI 文件夹树（含空文件夹）",
      schema: {},
      run: () => wrap(() => backend.getFolderTree()),
    },
    {
      name: "lizhi_list_tags",
      description: "列出全局文档标签",
      schema: {},
      run: () => wrap(() => backend.listTags()),
    },
    {
      name: "lizhi_read_document",
      description: "按 id 读取 Markdown 正文",
      schema: { id: z.string().describe("文档 UUID") },
      run: async ({ id }) => {
        try {
          const doc = await backend.readDocument(String(id));
          return okText(`# ${doc.id}\n\n${doc.content}`);
        } catch (error) {
          return err(error instanceof Error ? error.message : String(error));
        }
      },
    },
    {
      name: "lizhi_read_documents",
      description: "批量读取文档正文；不传 ids 则读取全部（大库慎用）",
      schema: {
        ids: z.array(z.string()).optional().describe("文档 UUID 列表，可选"),
      },
      run: ({ ids }) => wrap(() => backend.readDocuments(ids as string[] | undefined)),
    },
    {
      name: "lizhi_search",
      description: "全文搜索（FTS5 + 拼音 fallback）",
      schema: {
        query: z.string().describe("搜索关键词"),
        limit: z.number().int().min(1).max(100).optional(),
      },
      run: ({ query, limit }) =>
        wrap(() => backend.search(String(query), (limit as number | undefined) ?? 20)),
    },
    {
      name: "lizhi_get_backlinks",
      description: "获取指向指定文档的 wiki 反向链接",
      schema: { id: z.string().describe("文档 UUID") },
      run: ({ id }) => wrap(() => backend.getBacklinks(String(id))),
    },
    {
      name: "lizhi_get_unlinked_mentions",
      description: "获取未加 [[链接]] 但正文提及该文档标题的来源",
      schema: { id: z.string().describe("文档 UUID") },
      run: ({ id }) => wrap(() => backend.getUnlinkedMentions(String(id))),
    },
    {
      name: "lizhi_get_outbound_links",
      description: "获取文档发出的 wiki 链接目标",
      schema: { id: z.string().describe("文档 UUID") },
      run: ({ id }) => wrap(() => backend.getOutboundLinks(String(id))),
    },
    {
      name: "lizhi_get_graph",
      description: "获取局部知识图谱",
      schema: {
        id: z.string().describe("中心文档 UUID"),
        depth: z.number().int().min(1).max(3).optional(),
      },
      run: ({ id, depth }) =>
        wrap(() => backend.getGraph(String(id), (depth as number | undefined) ?? 2)),
    },
    {
      name: "lizhi_get_link_stats",
      description: "链接统计：总数、孤儿文档、枢纽节点",
      schema: {},
      run: () => wrap(() => backend.getLinkStats()),
    },
    {
      name: "lizhi_get_link_index_snapshot",
      description: "完整双链索引快照（outbound/backlink/unlinked/plainText 等）",
      schema: {},
      run: () => wrap(() => backend.getLinkIndexSnapshot()),
    },
    {
      name: "lizhi_save_asset",
      description: "保存图片/附件（Base64，需 MCP 写入）",
      schema: {
        dataBase64: z.string().describe("文件内容的 Base64 编码"),
        extension: z.string().describe("扩展名，如 png、jpg"),
      },
      run: ({ dataBase64, extension }) =>
        wrap(() => backend.saveAsset(String(dataBase64), String(extension))),
    },
    {
      name: "lizhi_get_asset",
      description: "读取附件（返回 Base64 与 MIME）",
      schema: { id: z.string().describe("资产 id，如 uuid.png") },
      run: ({ id }) => wrap(() => backend.getAsset(String(id))),
    },
    {
      name: "lizhi_get_dashboard_stats",
      description: "知识库看板统计（文档数、字数、本周编辑）",
      schema: {},
      run: () => wrap(() => backend.getDashboardStats()),
    },
    {
      name: "lizhi_get_edit_activity",
      description: "按天编辑活动统计",
      schema: {
        days: z.number().int().min(1).max(3660).optional().describe("天数，默认 365"),
      },
      run: ({ days }) =>
        wrap(() => backend.getEditActivity((days as number | undefined) ?? 365)),
    },
    {
      name: "lizhi_get_document_tags",
      description: "读取文档标签",
      schema: { id: z.string().describe("文档 UUID") },
      run: ({ id }) => wrap(() => backend.getDocumentTags(String(id))),
    },
    {
      name: "lizhi_create_document",
      description: "创建新文档（需 MCP 写入）",
      schema: {
        title: z.string(),
        folder: z.string().optional().describe("默认 inbox"),
      },
      run: ({ title, folder }) =>
        wrap(() => backend.createDocument(String(title), folder as string | undefined)),
    },
    {
      name: "lizhi_save_document",
      description: "保存文档正文（需 MCP 写入；默认从 H1 同步标题）",
      schema: {
        id: z.string(),
        content: z.string(),
        syncTitleFromH1: z.boolean().optional(),
      },
      run: ({ id, content, syncTitleFromH1 }) =>
        wrap(() =>
          backend.saveDocument(
            String(id),
            String(content),
            syncTitleFromH1 as boolean | undefined,
          ),
        ),
    },
    {
      name: "lizhi_rename_document",
      description: "重命名文档并可选传播 [[wiki link]]（需 MCP 写入）",
      schema: {
        id: z.string(),
        title: z.string(),
        propagateWikiLinks: z.boolean().optional(),
      },
      run: ({ id, title, propagateWikiLinks }) =>
        wrap(() =>
          backend.renameDocument(
            String(id),
            String(title),
            propagateWikiLinks as boolean | undefined,
          ),
        ),
    },
    {
      name: "lizhi_move_document",
      description: "移动文档到指定文件夹（需 MCP 写入）",
      schema: { id: z.string(), folder: z.string() },
      run: ({ id, folder }) =>
        wrap(() => backend.moveDocument(String(id), String(folder))),
    },
    {
      name: "lizhi_set_document_tags",
      description: "设置文档标签（需 MCP 写入）",
      schema: { id: z.string(), tags: z.array(z.string()) },
      run: ({ id, tags }) =>
        wrap(() => backend.setDocumentTags(String(id), tags as string[])),
    },
    {
      name: "lizhi_convert_unlinked_mention",
      description: "将纯文本提及转为 [[wiki link]]（需 MCP 写入）",
      schema: {
        sourceId: z.string().describe("来源文档 UUID"),
        targetTitle: z.string().describe("被提及的目标文档标题"),
      },
      run: ({ sourceId, targetTitle }) =>
        wrap(() => backend.convertUnlinkedMention(String(sourceId), String(targetTitle))),
    },
    {
      name: "lizhi_migrate_folder_prefix",
      description: "批量迁移文件夹前缀（需 MCP 写入）",
      schema: { oldPrefix: z.string(), newPrefix: z.string() },
      run: ({ oldPrefix, newPrefix }) =>
        wrap(() => backend.migrateFolderPrefix(String(oldPrefix), String(newPrefix))),
    },
    {
      name: "lizhi_delete_document",
      description: "删除文档（需 MCP 写入）",
      schema: { id: z.string() },
      run: ({ id }) => wrap(() => backend.deleteDocument(String(id))),
    },
  ];

  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema, tool.run);
  }

  server.registerPrompt(
    "search-knowledge-base",
    {
      description: "检索知识库并阅读相关笔记后回答",
      argsSchema: { query: z.string().describe("问题或关键词") },
    },
    async ({ query }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `请使用 lizhi_search 检索「${query}」，阅读命中笔记（lizhi_read_document），必要时查看 lizhi_get_backlinks / lizhi_get_unlinked_mentions，然后基于笔记内容回答。`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "organize-notes",
    {
      description: "整理笔记：搜索、重命名、移动、加标签",
      argsSchema: { instruction: z.string().describe("整理目标描述") },
    },
    async ({ instruction }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `你是狸知知识库助手。目标：${instruction}。可用 lizhi_search、lizhi_list_folders、lizhi_get_folder_tree、lizhi_move_document、lizhi_rename_document、lizhi_set_document_tags。写操作需用户已在设置中开启 MCP 写入。`,
          },
        },
      ],
    }),
  );
}
