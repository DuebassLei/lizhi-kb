import type { CcMessage } from "../../stores/ccWorkbench";
import { isAgentTool, toolIsComplete, toolIsError } from "../../utils/ccToolGrouping";

export type CcStatusTab = "todo" | "subagent" | "files";

export interface CcTodoItem {
  id?: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface CcSubagentItem {
  id: string;
  name: string;
  status: "running" | "completed" | "error";
  description?: string;
  output?: string;
  updatedAt: number;
  startedAt?: number;
  durationMs?: number;
  parentId?: string;
}

export interface CcFileChangeItem {
  path: string;
  tool: string;
  summary: string;
  oldContent?: string;
  newContent?: string;
  writeContent?: string;
}

const FILE_EDIT_TOOLS = new Set(["write", "edit", "write_file", "edit_file", "create_file"]);
const SUBAGENT_TOOLS = new Set(["task", "agent", "subagent"]);

function normalizeToolName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseJsonSafe(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeTodoStatus(raw: unknown): CcTodoItem["status"] {
  const value = String(raw ?? "").toLowerCase();
  if (value.includes("progress") || value === "in_progress") return "in_progress";
  if (value.includes("complete") || value === "done") return "completed";
  return "pending";
}

function extractTodosFromInput(input: unknown): CcTodoItem[] {
  if (!input || typeof input !== "object") return [];
  const obj = input as Record<string, unknown>;
  const list = Array.isArray(obj.todos)
    ? obj.todos
    : Array.isArray(obj.plan)
      ? obj.plan
      : [];
  const todos: CcTodoItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const content = [row.content, row.title, row.text, row.step, row.description]
      .find((v) => typeof v === "string" && v.trim()) as string | undefined;
    if (!content) continue;
    todos.push({
      id: row.id != null ? String(row.id) : undefined,
      content: content.trim(),
      status: normalizeTodoStatus(row.status),
    });
  }
  return todos;
}

function extractFilePath(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  for (const key of ["file_path", "filePath", "path", "target_file", "targetFile"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractFilePreview(input: unknown): Pick<CcFileChangeItem, "oldContent" | "newContent" | "writeContent"> {
  if (!input || typeof input !== "object") return {};
  const obj = input as Record<string, unknown>;
  const oldContent = [obj.old_string, obj.oldString, obj.old_text, obj.oldText]
    .find((v) => typeof v === "string" && v.length > 0) as string | undefined;
  const newContent = [obj.new_string, obj.newString, obj.new_text, obj.newText]
    .find((v) => typeof v === "string" && v.length > 0) as string | undefined;
  const writeContent = [obj.content, obj.file_content, obj.fileContent, obj.text]
    .find((v) => typeof v === "string" && v.length > 0) as string | undefined;
  return { oldContent, newContent, writeContent };
}

function extractSubagentName(input: unknown): string {
  if (!input || typeof input !== "object") return "子代理";
  const obj = input as Record<string, unknown>;
  for (const key of ["description", "prompt", "task", "name", "subagent_type"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      const text = value.trim();
      return text.length > 48 ? `${text.slice(0, 48)}…` : text;
    }
  }
  return "子代理";
}

function extractSubagentDescription(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const obj = input as Record<string, unknown>;
  for (const key of ["description", "prompt", "task"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function hasIncompleteNestedTools(
  toolCalls: NonNullable<CcMessage["toolCalls"]>,
  subagentIndex: number,
): boolean {
  for (let i = subagentIndex + 1; i < toolCalls.length; i += 1) {
    const next = toolCalls[i]!;
    if (SUBAGENT_TOOLS.has(normalizeToolName(next.name))) break;
    if (!toolIsComplete(next)) return true;
  }
  return false;
}

function shouldForceRunningSubagent(
  tool: NonNullable<CcMessage["toolCalls"]>[number],
  toolIndex: number,
  msg: CcMessage,
  options?: { streaming?: boolean },
): boolean {
  if (!options?.streaming || !msg.streaming) return false;
  const toolCalls = msg.toolCalls;
  if (!toolCalls?.length) return false;

  const hasLaterSubagent = toolCalls
    .slice(toolIndex + 1)
    .some((row) => SUBAGENT_TOOLS.has(normalizeToolName(row.name)) || isAgentTool(row.name));
  if (hasLaterSubagent) return false;

  if (toolIndex !== toolCalls.length - 1) return false;
  if (!toolIsComplete(tool)) return false;

  const startedAt = tool.startedAt ?? msg.createdAt;
  const completedAt = tool.completedAt;
  const durationMs =
    startedAt != null && completedAt != null ? completedAt - startedAt : Number.POSITIVE_INFINITY;
  const outputLen = (tool.output ?? "").trim().length;
  return durationMs < 500 && outputLen < 100;
}

function resolveSubagentStatus(
  tool: NonNullable<CcMessage["toolCalls"]>[number],
  nestedRunning: boolean,
  forceRunning = false,
): CcSubagentItem["status"] {
  if (forceRunning || nestedRunning || !toolIsComplete(tool)) return "running";
  if (toolIsError(tool.output)) return "error";
  return "completed";
}

function sortSubagents(items: CcSubagentItem[]): CcSubagentItem[] {
  const rank = (status: CcSubagentItem["status"]) => {
    if (status === "running") return 0;
    if (status === "error") return 1;
    return 2;
  };
  return [...items].sort((a, b) => rank(a.status) - rank(b.status) || b.updatedAt - a.updatedAt);
}

export function deriveCcStatusPanel(
  messages: CcMessage[],
  options?: { streaming?: boolean },
) {
  let todos: CcTodoItem[] = [];
  const subagents: CcSubagentItem[] = [];
  const fileChanges: CcFileChangeItem[] = [];
  const seenFiles = new Set<string>();

  for (let msgIndex = 0; msgIndex < messages.length; msgIndex++) {
    const msg = messages[msgIndex]!;
    if (msg.role !== "assistant" || !msg.toolCalls?.length) continue;
    for (let toolIndex = 0; toolIndex < msg.toolCalls.length; toolIndex++) {
      const tool = msg.toolCalls[toolIndex]!;
      const name = normalizeToolName(tool.name);
      const input = parseJsonSafe(tool.input);

      if (name === "todowrite" || name === "updateplan") {
        const parsed = extractTodosFromInput(input);
        if (parsed.length) todos = parsed;
      }

      if (SUBAGENT_TOOLS.has(name) || isAgentTool(tool.name)) {
        const nestedRunning = hasIncompleteNestedTools(msg.toolCalls, toolIndex);
        const forceRunning = shouldForceRunningSubagent(tool, toolIndex, msg, options);
        const status = resolveSubagentStatus(tool, nestedRunning, forceRunning);
        const startedAt = tool.startedAt ?? msg.createdAt;
        const completedAt = tool.completedAt;
        const durationMs =
          status === "completed" && startedAt != null && completedAt != null
            ? completedAt - startedAt
            : undefined;
        subagents.push({
          id: `${msg.id}:${tool.name}:${toolIndex}`,
          name: extractSubagentName(input),
          status,
          description: extractSubagentDescription(input),
          output: tool.output?.trim() || undefined,
          updatedAt: completedAt ?? startedAt ?? Date.now(),
          startedAt,
          durationMs,
          parentId: msg.id,
        });
      }

      if (FILE_EDIT_TOOLS.has(name)) {
        const path = extractFilePath(input);
        if (path && !seenFiles.has(path)) {
          seenFiles.add(path);
          const preview = extractFilePreview(input);
          fileChanges.push({
            path,
            tool: tool.name,
            summary: tool.output ? "已完成" : "进行中",
            ...preview,
          });
        }
      }
    }
  }

  const sortedSubagents = sortSubagents(subagents);
  const subagentRunningCount = sortedSubagents.filter((s) => s.status === "running").length;

  return {
    todos,
    subagents: sortedSubagents,
    fileChanges,
    todoCount: todos.length,
    subagentCount: sortedSubagents.length,
    subagentRunningCount,
    fileChangeCount: fileChanges.length,
  };
}
