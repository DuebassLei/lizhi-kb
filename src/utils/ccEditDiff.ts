export type CcDiffLineType = "context" | "add" | "del";

export interface CcDiffLine {
  type: CcDiffLineType;
  text: string;
}

export interface CcEditPayload {
  path: string | null;
  oldText: string;
  newText: string;
  mode: "edit" | "write";
}

function parseToolInput(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

/** 从 Edit/Write 工具 input JSON 提取 diff 所需字段 */
export function parseEditToolInput(input: string): CcEditPayload {
  const obj = parseToolInput(input);
  if (!obj) {
    return { path: null, oldText: "", newText: "", mode: "write" };
  }

  const path =
    pickString(obj, ["file_path", "filePath", "path", "target_file", "targetFile"]) ?? null;

  const oldText =
    pickString(obj, ["old_string", "oldString", "old_text", "oldText"]) ?? "";
  const newText =
    pickString(obj, ["new_string", "newString", "new_text", "newText"]) ??
    pickString(obj, ["content", "file_content", "fileContent", "text"]) ??
    "";

  const mode = oldText.length > 0 || pickString(obj, ["old_string", "oldString"]) != null
    ? "edit"
    : "write";

  return { path, oldText, newText, mode };
}

/** 行级 LCS diff，输出 unified 视图行 */
export function buildLineDiff(oldText: string, newText: string): CcDiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const out: CcDiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      out.push({ type: "context", text: oldLines[i - 1]! });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      out.push({ type: "add", text: newLines[j - 1]! });
      j -= 1;
    } else if (i > 0) {
      out.push({ type: "del", text: oldLines[i - 1]! });
      i -= 1;
    }
  }

  return out.reverse();
}

export function countLineDiffStats(lines: CcDiffLine[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.type === "add") additions += 1;
    if (line.type === "del") deletions += 1;
  }
  return { additions, deletions };
}

export function hasDiffContent(payload: CcEditPayload): boolean {
  return payload.newText.length > 0 || payload.oldText.length > 0;
}

/** 转为详情面板可用的文件变更条目 */
export function fileChangeFromToolInput(
  toolName: string,
  input: string,
  output?: string,
): {
  path: string;
  tool: string;
  summary: string;
  oldContent?: string;
  newContent?: string;
  writeContent?: string;
} | null {
  const payload = parseEditToolInput(input);
  if (!payload.path || !hasDiffContent(payload)) return null;
  return {
    path: payload.path,
    tool: toolName,
    summary: output ? "已完成" : "进行中",
    oldContent: payload.mode === "edit" ? payload.oldText : undefined,
    newContent: payload.mode === "edit" ? payload.newText : undefined,
    writeContent: payload.mode === "write" ? payload.newText : undefined,
  };
}
