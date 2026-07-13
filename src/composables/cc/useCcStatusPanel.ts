import type { CcMessage } from "../../stores/ccWorkbench";

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

function extractSubagentOutputFromMessage(
  tool: { output?: string },
  msgContent: string,
): string | undefined {
  const raw = tool.output?.trim();
  if (raw) return raw;

  const content = msgContent.trim();
  if (!content) return undefined;
  const marker = /(?:子代理|subagent|task)\s*(?:结果|输出|完成)[:：]\s*/i;
  const match = content.match(marker);
  if (match?.index != null) {
    const tail = content.slice(match.index + match[0].length).trim();
    if (tail) return tail;
  }
  return undefined;
}

export function deriveCcStatusPanel(messages: CcMessage[]) {
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

      if (SUBAGENT_TOOLS.has(name)) {
        const output = extractSubagentOutputFromMessage(tool, msg.content);
        const hasError = Boolean(
          tool.output && /error|fail|exception/i.test(tool.output) && !output,
        );
        subagents.push({
          id: `${msg.id}:${tool.name}:${toolIndex}`,
          name: extractSubagentName(input),
          status: tool.output || output ? (hasError ? "error" : "completed") : "running",
          description: extractSubagentDescription(input),
          output,
          updatedAt: msgIndex * 1000 + toolIndex,
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

  return {
    todos,
    subagents,
    fileChanges,
    todoCount: todos.length,
    subagentCount: subagents.length,
    fileChangeCount: fileChanges.length,
  };
}
