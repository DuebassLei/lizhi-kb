import { normalizeCcToolName } from "./ccToolGrouping";

const LIZHI_WRITE_TOOLS = new Set([
  "lizhisavedocument",
  "lizhicreatedocument",
  "lizhirenamedocument",
  "lizhimovedocument",
  "lizhisettocumenttags",
  "lizhiconvertunlinkedmention",
  "lizhimigratefolderprefix",
  "lizhideletedocument",
]);

export function isLizhiWriteTool(name: string): boolean {
  return LIZHI_WRITE_TOOLS.has(normalizeCcToolName(name));
}

export function isWriteDisabledOutput(output: string): boolean {
  const trimmed = output.trim();
  return (
    trimmed.includes("WRITE_DISABLED") ||
    trimmed.includes("MCP 写入未启用") ||
    trimmed.includes("写入未启用")
  );
}

function parseJsonRecord(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* 非 JSON */
  }
  return null;
}

function parseMcpPayload(output: string): Record<string, unknown> | null {
  const top = parseJsonRecord(output);
  if (!top) return null;
  const content = top.content;
  if (!Array.isArray(content)) return top;
  for (const row of content) {
    if (!row || typeof row !== "object") continue;
    const text = (row as { text?: string }).text;
    if (typeof text === "string") {
      const inner = parseJsonRecord(text);
      if (inner) return inner;
    }
  }
  return top;
}

export function extractDocIdFromWriteTool(
  name: string,
  input: string,
  output: string,
): string | null {
  const inputObj = parseJsonRecord(input);
  if (inputObj) {
    for (const key of ["id", "documentId", "document_id", "sourceId", "source_id"]) {
      const value = inputObj[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  const outputObj = parseMcpPayload(output) ?? parseJsonRecord(output);
  if (outputObj) {
    for (const key of ["id", "documentId"]) {
      const value = outputObj[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  void normalizeCcToolName(name);
  return null;
}
