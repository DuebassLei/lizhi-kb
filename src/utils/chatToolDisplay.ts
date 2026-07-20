/** AI 助手工具调用的展示文案与摘要（UI 层，不改协议） */

const TOOL_LABELS: Record<string, string> = {
  lizhi_search: "搜索知识库",
  lizhi_read_document: "读取文档",
  lizhi_read_documents: "批量读取",
  lizhi_list_documents: "列出文档",
  lizhi_list_folders: "列出文件夹",
  lizhi_get_folder_tree: "文件夹树",
  lizhi_create_document: "创建文档",
  lizhi_save_document: "保存文档",
  lizhi_rename_document: "重命名",
  lizhi_move_document: "移动文档",
  lizhi_delete_document: "移至回收站",
  lizhi_restore_document: "恢复文档",
  lizhi_list_trashed_documents: "列出回收站",
  lizhi_purge_document: "永久删除文档",
  lizhi_empty_trash: "清空回收站",
  lizhi_ensure_folder: "注册文件夹",
  lizhi_delete_folder: "删除文件夹",
  lizhi_set_document_tags: "设置标签",
  lizhi_get_backlinks: "反向链接",
  lizhi_get_unlinked_mentions: "未链接提及",
  lizhi_get_outbound_links: "出站链接",
  lizhi_get_graph: "知识图谱",
  lizhi_get_document_tags: "文档标签",
  lizhi_status: "状态检查",
  search: "搜索",
  read: "读取",
};

export function toolDisplayLabel(name: string): string {
  if (TOOL_LABELS[name]) return TOOL_LABELS[name];
  const short = name.replace(/^lizhi_/, "").replace(/_/g, " ");
  return short || name;
}

/** 单行摘要：优先解析 JSON 数组长度 / 错误，否则截断原文 */
export function toolOutputSummary(output: string | undefined, maxLen = 96): string {
  if (output == null) return "执行中…";
  const trimmed = output.trim();
  if (!trimmed) return "（空结果）";

  if (/WRITE_DISABLED|写入未启用|MCP 写入/i.test(trimmed)) {
    return "写入未启用";
  }
  if (/VAULT_LOCKED|已锁定/i.test(trimmed)) {
    return "知识库已锁定";
  }
  if (/ERROR|失败|Error:/i.test(trimmed.slice(0, 120))) {
    return truncateOneLine(trimmed, maxLen);
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return `返回 ${parsed.length} 条结果`;
    }
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.title === "string") {
        return truncateOneLine(`文档：${obj.title}`, maxLen);
      }
      if (typeof obj.id === "string" && typeof obj.content === "string") {
        return truncateOneLine(`已读取 ${obj.id.slice(0, 8)}…`, maxLen);
      }
      if (typeof obj.content === "string") {
        return truncateOneLine(obj.content, maxLen);
      }
      if (typeof obj.message === "string") {
        return truncateOneLine(obj.message, maxLen);
      }
      const keys = Object.keys(obj);
      if (keys.length) return `对象（${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "…" : ""}）`;
    }
  } catch {
    // 非 JSON，走文本截断
  }

  return truncateOneLine(trimmed, maxLen);
}

function truncateOneLine(text: string, maxLen: number): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= maxLen) return one;
  return `${one.slice(0, maxLen - 1)}…`;
}

export function shouldAutoExpandTool(output: string | undefined): boolean {
  if (!output) return false;
  return output.trim().length > 0 && output.trim().length < 160;
}
