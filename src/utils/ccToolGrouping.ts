export interface CcToolCallItem {
  name: string;
  input: string;
  output?: string;
  id?: string;
  startedAt?: number;
  completedAt?: number;
}

export type CcToolGroup =
  | { type: "read_group"; items: CcToolCallItem[] }
  | { type: "edit_group"; items: CcToolCallItem[] }
  | { type: "bash_group"; items: CcToolCallItem[] }
  | { type: "search_group"; items: CcToolCallItem[] }
  | { type: "agent_group"; agent: CcToolCallItem; items: CcToolCallItem[] }
  | { type: "single"; item: CcToolCallItem };

const READ_TOOLS = new Set(["read", "readfile", "readmultiplefiles"]);
const EDIT_TOOLS = new Set([
  "edit",
  "editfile",
  "writefile",
  "write",
  "createfile",
  "replacestring",
  "writetofile",
  "notebookedit",
]);
const BASH_TOOLS = new Set([
  "bash",
  "runterminalcmd",
  "execcommand",
  "executecommand",
  "shellcommand",
]);
const SEARCH_TOOLS = new Set([
  "grep",
  "glob",
  "search",
  "find",
  "searchfiles",
  "lizhisearch",
  "lizhilistdocuments",
  "lizhilisttags",
]);
const LIZHI_READ_TOOLS = new Set(["lizhireaddocument", "lizhireaddocuments"]);
const AGENT_TOOLS = new Set(["task", "agent", "spawnagent", "subagent"]);

export function normalizeCcToolName(name: string): string {
  const lower = name.trim().toLowerCase();
  const lizhiMcp = /^mcp__lizhi(?:-kb|_kb)?__lizhi_(.+)$/.exec(lower);
  if (lizhiMcp) {
    return `lizhi${lizhiMcp[1].replace(/[^a-z0-9]+/g, "")}`;
  }
  const mcpMatch = /^mcp__.+?__(.+)$/.exec(lower) ?? /^mcp__[^_]+__(.+)$/.exec(lower);
  const base = mcpMatch ? mcpMatch[1] : lower;
  return base.replace(/[^a-z0-9]+/g, "");
}

function isCcTool(name: string, tools: Set<string>): boolean {
  return tools.has(normalizeCcToolName(name));
}

function parseToolInput(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function extractToolFilePath(input: string): string | null {
  const obj = parseToolInput(input);
  if (!obj) return null;
  for (const key of ["file_path", "filePath", "path", "target_file", "targetFile"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function extractToolCommand(input: string): string | null {
  const obj = parseToolInput(input);
  if (!obj) return null;
  for (const key of ["command", "cmd", "script"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      const text = value.trim();
      return text.length > 80 ? `${text.slice(0, 80)}…` : text;
    }
  }
  return null;
}

export function extractToolPattern(input: string): string | null {
  const obj = parseToolInput(input);
  if (!obj) return null;
  for (const key of ["pattern", "query", "glob_pattern", "globPattern", "regex"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      const text = value.trim();
      return text.length > 60 ? `${text.slice(0, 60)}…` : text;
    }
  }
  return null;
}

export function extractAgentLabel(input: string): string {
  const obj = parseToolInput(input);
  if (!obj) return "子代理";
  for (const key of ["description", "prompt", "task", "name", "subagent_type"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      const text = value.trim();
      return text.length > 48 ? `${text.slice(0, 48)}…` : text;
    }
  }
  return "子代理";
}

export function extractAgentDescription(input: string): string | undefined {
  const obj = parseToolInput(input);
  if (!obj) return undefined;
  for (const key of ["description", "prompt", "task"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function isAgentTool(name: string): boolean {
  return isCcTool(name, AGENT_TOOLS);
}

function isPlaceholderAgentOutput(output: string): boolean {
  const trimmed = output.trim();
  if (!trimmed) return true;
  if (trimmed === "[]" || trimmed === "{}") return true;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const row = parsed as Record<string, unknown>;
      const status = String(row.status ?? row.state ?? "").toLowerCase();
      if (status === "running" || status === "pending" || status === "started") return true;
    }
  } catch {
    /* 非 JSON */
  }
  return false;
}

export interface AgentToolStatusContext {
  nestedItems?: CcToolCallItem[];
  streaming?: boolean;
}

/** 子代理是否仍在执行（含嵌套工具未完成） */
export function agentToolIsActive(
  item: CcToolCallItem,
  context?: AgentToolStatusContext,
): boolean {
  if (!toolIsComplete(item)) return true;
  if (context?.nestedItems?.some((nested) => !toolIsComplete(nested))) return true;
  return false;
}

export function agentStatusLabel(
  item: CcToolCallItem,
  context?: AgentToolStatusContext,
): string {
  if (agentToolIsActive(item, context)) return "运行中";
  if (toolIsError(item.output)) return "失败";
  return "已完成";
}

export function toolIsComplete(item: CcToolCallItem): boolean {
  if (item.output === undefined) return false;
  if (isAgentTool(item.name)) {
    if (item.completedAt == null) return false;
    if (isPlaceholderAgentOutput(item.output)) return false;
  }
  return true;
}

/** 解析 JSON 形态的工具结果（MCP / SDK） */
function parseToolResultJson(output: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* 非 JSON */
  }
  return null;
}

function jsonIndicatesError(obj: Record<string, unknown>): boolean {
  if (obj.is_error === true || obj.isError === true) return true;
  if (typeof obj.error === "string" && obj.error.trim()) return true;
  if (obj.success === false) return true;
  return false;
}

const ERROR_LINE_PREFIX =
  /^(error\b|failed\b|failure\b|exception\b|permission denied|access denied|file not found|cannot read|unable to|denied\b|rejected\b|no such file|does not exist|not permitted|command failed)/i;

/**
 * 判断工具输出是否表示失败。
 * Read/Grep 等成功返回的长文本若含 "error" 字样（如源码、日志）不应判为失败。
 */
export function toolIsError(output?: string): boolean {
  if (!output?.trim()) return false;
  const trimmed = output.trim();

  const json = parseToolResultJson(trimmed);
  if (json) {
    return jsonIndicatesError(json);
  }

  const firstLine = trimmed.split("\n")[0]?.trim() ?? "";
  if (ERROR_LINE_PREFIX.test(firstLine) || /^Error:\s/i.test(firstLine)) {
    return true;
  }

  // 短输出且整体像错误消息
  if (trimmed.length <= 160 && /^(error|failed|exception|denied|rejected)\b/i.test(trimmed)) {
    return true;
  }

  return false;
}

export function toolStatusHint(item: CcToolCallItem): string {
  if (!toolIsComplete(item)) return "执行中";
  if (toolIsError(item.output)) return "失败";
  if (toolHasNoResult(item.output)) return "无结果";
  return "成功";
}

/** 是否为 MCP 桥接工具（mcp__server__tool） */
export function isMcpToolName(name: string): boolean {
  return /^mcp__[a-z0-9_-]+__/i.test(String(name ?? "").trim());
}

/** 工具是否已完成但无有效返回 */
export function toolHasNoResult(output?: string): boolean {
  if (output === undefined) return true;
  const trimmed = output.trim();
  if (!trimmed) return true;
  if (trimmed === "（已取消）") return true;
  if (trimmed === "[]" || trimmed === "{}") return true;
  return false;
}

function extractMcpContentPreview(obj: Record<string, unknown>): string | null {
  const content = obj.content;
  if (!Array.isArray(content)) return null;
  const text = content
    .map((row) => {
      if (!row || typeof row !== "object") return "";
      const item = row as Record<string, unknown>;
      if (item.type === "text" && typeof item.text === "string") return item.text;
      if (typeof item.text === "string") return item.text;
      return "";
    })
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return `返回 ${content.length} 段内容`;
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

/** 已完成工具的结果摘要（供 UI 展示，区分 MCP 真实返回与纯文本） */
export function extractToolResultSummary(output?: string, name?: string): string | null {
  if (output === undefined) return null;
  const trimmed = output.trim();
  if (!trimmed) return "无返回内容";
  if (trimmed === "（已取消）") return "已取消";
  if (trimmed === "[]") return "空列表";
  if (trimmed === "{}") return "空对象";

  const json = parseToolResultJson(trimmed);
  if (json) {
    if (jsonIndicatesError(json)) {
      const err =
        (typeof json.error === "string" && json.error.trim()) ||
        (typeof json.message === "string" && json.message.trim()) ||
        "执行失败";
      return err.length > 120 ? `${err.slice(0, 117)}…` : err;
    }
    const mcpPreview = extractMcpContentPreview(json);
    if (mcpPreview) return mcpPreview;
    if (Array.isArray(json)) return `返回 ${json.length} 项`;
    if (typeof json.count === "number") return `共 ${json.count} 条`;
    if (typeof json.total === "number") return `共 ${json.total} 条`;
  }

  const oneLine = trimmed.replace(/\s+/g, " ");
  const prefix = isMcpToolName(name ?? "") ? "MCP：" : "";
  const body = oneLine.length > 120 ? `${oneLine.slice(0, 117)}…` : oneLine;
  return `${prefix}${body}`;
}

export function messageHasFailedTools(tools: CcToolCallItem[]): boolean {
  return tools.some(
    (item) =>
      toolIsComplete(item) && (toolIsError(item.output) || toolHasNoResult(item.output)),
  );
}

export function fileBaseName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
}

export function countEditDiff(input: string): { additions: number; deletions: number } {
  const obj = parseToolInput(input);
  if (!obj) return { additions: 0, deletions: 0 };
  const oldStr = [obj.old_string, obj.oldString, obj.old_text, obj.oldText].find(
    (v) => typeof v === "string",
  ) as string | undefined;
  const newStr = [obj.new_string, obj.newString, obj.new_text, obj.newText, obj.content].find(
    (v) => typeof v === "string",
  ) as string | undefined;
  if (oldStr != null && newStr != null) {
    const oldLines = oldStr ? oldStr.split("\n").length : 0;
    const newLines = newStr ? newStr.split("\n").length : 0;
    return {
      additions: Math.max(0, newLines - oldLines),
      deletions: Math.max(0, oldLines - newLines),
    };
  }
  if (typeof obj.content === "string" && obj.content) {
    return { additions: obj.content.split("\n").length, deletions: 0 };
  }
  return { additions: 0, deletions: 0 };
}

export function groupCcToolCalls(items: CcToolCallItem[]): CcToolGroup[] {
  const groups: CcToolGroup[] = [];
  let readBuf: CcToolCallItem[] = [];
  let editBuf: CcToolCallItem[] = [];
  let bashBuf: CcToolCallItem[] = [];
  let searchBuf: CcToolCallItem[] = [];
  let agentBlock: CcToolCallItem | null = null;
  let agentFollow: CcToolCallItem[] = [];

  const flushRead = () => {
    if (readBuf.length) {
      groups.push({ type: "read_group", items: [...readBuf] });
      readBuf = [];
    }
  };
  const flushEdit = () => {
    if (editBuf.length) {
      groups.push({ type: "edit_group", items: [...editBuf] });
      editBuf = [];
    }
  };
  const flushBash = () => {
    if (bashBuf.length) {
      groups.push({ type: "bash_group", items: [...bashBuf] });
      bashBuf = [];
    }
  };
  const flushSearch = () => {
    if (searchBuf.length) {
      groups.push({ type: "search_group", items: [...searchBuf] });
      searchBuf = [];
    }
  };
  const flushAgent = () => {
    if (agentBlock) {
      groups.push({ type: "agent_group", agent: agentBlock, items: [...agentFollow] });
      agentBlock = null;
      agentFollow = [];
    }
  };

  for (const item of items) {
    if (agentBlock) {
      if (isCcTool(item.name, AGENT_TOOLS)) {
        flushAgent();
      } else if (!item.output && (isCcTool(item.name, READ_TOOLS) || isCcTool(item.name, LIZHI_READ_TOOLS))) {
        agentFollow.push(item);
        continue;
      } else if (
        isCcTool(item.name, EDIT_TOOLS) ||
        isCcTool(item.name, BASH_TOOLS) ||
        isCcTool(item.name, SEARCH_TOOLS)
      ) {
        flushAgent();
      } else if (!parseToolInput(item.input)) {
        flushAgent();
      } else {
        agentFollow.push(item);
        continue;
      }
    }

    if (isCcTool(item.name, AGENT_TOOLS)) {
      flushRead();
      flushEdit();
      flushBash();
      flushSearch();
      agentBlock = item;
      continue;
    }

    if (isCcTool(item.name, READ_TOOLS) || isCcTool(item.name, LIZHI_READ_TOOLS)) {
      flushEdit();
      flushBash();
      flushSearch();
      readBuf.push(item);
      continue;
    }

    if (isCcTool(item.name, EDIT_TOOLS)) {
      flushRead();
      flushBash();
      flushSearch();
      editBuf.push(item);
      continue;
    }

    if (isCcTool(item.name, BASH_TOOLS)) {
      flushRead();
      flushEdit();
      flushSearch();
      bashBuf.push(item);
      continue;
    }

    if (isCcTool(item.name, SEARCH_TOOLS)) {
      flushRead();
      flushEdit();
      flushBash();
      searchBuf.push(item);
      continue;
    }

    flushRead();
    flushEdit();
    flushBash();
    flushSearch();
    flushAgent();
    groups.push({ type: "single", item });
  }

  flushRead();
  flushEdit();
  flushBash();
  flushSearch();
  flushAgent();
  return groups;
}


const LIZHI_TOOL_LABELS: Record<string, string> = {
  lizhisearch: "搜索知识库",
  lizhilistdocuments: "列出文档",
  lizhilisttags: "列出标签",
  lizhireaddocument: "读取笔记",
  lizhireaddocuments: "批量读笔记",
  lizhistatus: "知识库状态",
};

export function formatCcToolDisplayName(name: string): string {
  const normalized = normalizeCcToolName(name);
  return LIZHI_TOOL_LABELS[normalized] ?? name;
}

export function isLizhiVaultTool(name: string): boolean {
  if (!isMcpToolName(name)) return false;
  return normalizeCcToolName(name).startsWith("lizhi");
}
