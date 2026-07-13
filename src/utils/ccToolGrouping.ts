export interface CcToolCallItem {
  name: string;
  input: string;
  output?: string;
  id?: string;
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
const SEARCH_TOOLS = new Set(["grep", "glob", "search", "find", "searchfiles"]);
const AGENT_TOOLS = new Set(["task", "agent", "spawnagent", "subagent"]);

export function normalizeCcToolName(name: string): string {
  const lower = name.trim().toLowerCase();
  const mcpMatch = /^mcp__[^_]+__(.+)$/.exec(lower);
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

export function agentStatusLabel(item: CcToolCallItem): string {
  if (!toolIsComplete(item)) return "运行中";
  if (toolIsError(item.output)) return "失败";
  return "已完成";
}

export function toolIsComplete(item: CcToolCallItem): boolean {
  return item.output !== undefined;
}

export function toolIsError(output?: string): boolean {
  if (!output?.trim()) return false;
  return /error|fail|exception|denied|rejected/i.test(output);
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
      } else if (!item.output && isCcTool(item.name, READ_TOOLS)) {
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

    if (isCcTool(item.name, READ_TOOLS)) {
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
