import { describe, it, expect } from "vitest";
import {
  normalizeCcToolName,
  extractToolFilePath,
  extractToolCommand,
  extractToolPattern,
  extractAgentLabel,
  extractAgentDescription,
  toolIsComplete,
  toolIsError,
  toolHasNoResult,
  isLizhiVaultTool,
  isMcpToolName,
  formatCcToolDisplayName,
  groupCcToolCalls,
} from "./ccToolGrouping";
import type { CcToolCallItem } from "./ccToolGrouping";

describe("normalizeCcToolName", () => {
  it("标准化 CC 原生工具名", () => {
    expect(normalizeCcToolName("Read")).toBe("read");
    expect(normalizeCcToolName("WriteFile")).toBe("writefile");
    expect(normalizeCcToolName("Bash")).toBe("bash");
  });

  it("标准化 MCP 工具名", () => {
    expect(normalizeCcToolName("mcp__lizhi-kb__lizhi_search")).toBe("lizhisearch");
    expect(normalizeCcToolName("mcp__filesystem__read_file")).toBe("readfile");
  });

  it("标准化 lizhi MCP 工具名", () => {
    expect(normalizeCcToolName("mcp__lizhi_kb__lizhi_read_document")).toBe(
      "lizhireaddocument",
    );
  });

  it("大小写无关", () => {
    expect(normalizeCcToolName("MCP__LIZHI-KB__LIZHI_SEARCH")).toBe("lizhisearch");
  });
});

describe("extractToolFilePath", () => {
  it("提取 file_path", () => {
    expect(extractToolFilePath('{"file_path":"/docs/readme.md"}')).toBe(
      "/docs/readme.md",
    );
  });

  it("提取 filePath (camelCase)", () => {
    expect(extractToolFilePath('{"filePath":"/src/main.ts"}')).toBe("/src/main.ts");
  });

  it("提取 path", () => {
    expect(extractToolFilePath('{"path":"/config.json"}')).toBe("/config.json");
  });

  it("非 JSON 返回 null", () => {
    expect(extractToolFilePath("not json")).toBeNull();
  });

  it("无路径字段返回 null", () => {
    expect(extractToolFilePath('{"command":"ls"}')).toBeNull();
  });
});

describe("extractToolCommand", () => {
  it("提取 command 字段", () => {
    expect(extractToolCommand('{"command":"ls -la"}')).toBe("ls -la");
  });

  it("提取 cmd 字段", () => {
    expect(extractToolCommand('{"cmd":"npm install"}')).toBe("npm install");
  });

  it("超长命令截断", () => {
    const longCmd = "x".repeat(100);
    const result = extractToolCommand(JSON.stringify({ command: longCmd }));
    expect(result?.length).toBeLessThanOrEqual(83);
    expect(result?.endsWith("…")).toBe(true);
  });

  it("空 JSON 返回 null", () => {
    expect(extractToolCommand("{}")).toBeNull();
  });
});

describe("extractToolPattern", () => {
  it("提取 pattern 字段", () => {
    expect(extractToolPattern('{"pattern":"*.ts"}')).toBe("*.ts");
  });

  it("提取 query 字段", () => {
    expect(extractToolPattern('{"query":"hello world"}')).toBe("hello world");
  });

  it("提取 regex 字段", () => {
    expect(extractToolPattern('{"regex":"^import"}')).toBe("^import");
  });
});

describe("extractAgentLabel", () => {
  it("提取 description", () => {
    expect(extractAgentLabel('{"description":"code reviewer"}')).toBe(
      "code reviewer",
    );
  });

  it("提取 name", () => {
    expect(extractAgentLabel('{"name":"explorer"}')).toBe("explorer");
  });

  it("fallback 到子代理", () => {
    expect(extractAgentLabel("{}")).toBe("子代理");
    expect(extractAgentLabel("not json")).toBe("子代理");
  });

  it("超长描述截断", () => {
    const longDesc = "x".repeat(60);
    const result = extractAgentLabel(JSON.stringify({ description: longDesc }));
    expect(result.length).toBeLessThanOrEqual(51);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("extractAgentDescription", () => {
  it("返回完整描述", () => {
    expect(extractAgentDescription('{"description":"test agent"}')).toBe(
      "test agent",
    );
  });

  it("undefined for empty", () => {
    expect(extractAgentDescription("{}")).toBeUndefined();
  });
});

describe("toolIsComplete", () => {
  it("无 output 则未完成", () => {
    expect(toolIsComplete({ name: "Read", input: "{}" })).toBe(false);
  });

  it("有 output 则完成", () => {
    expect(
      toolIsComplete({ name: "Read", input: "{}", output: "content" }),
    ).toBe(true);
  });

  it("agent 工具需 completedAt", () => {
    expect(
      toolIsComplete({
        name: "Task",
        input: '{"description":"test"}',
        output: "done",
      }),
    ).toBe(false);
  });

  it("agent 工具带 completedAt 才算完成", () => {
    expect(
      toolIsComplete({
        name: "Task",
        input: "{}",
        output: "done",
        completedAt: Date.now(),
      }),
    ).toBe(true);
  });
});

describe("toolIsError", () => {
  it("undefined 输出不为错误", () => {
    expect(toolIsError(undefined)).toBe(false);
  });

  it("空输出不为错误", () => {
    expect(toolIsError("")).toBe(false);
  });

  it("JSON is_error 标记为错误", () => {
    expect(toolIsError('{"is_error":true}')).toBe(true);
  });

  it("error 字段为错误", () => {
    expect(toolIsError('{"error":"something wrong"}')).toBe(true);
  });

  it("success:false 为错误", () => {
    expect(toolIsError('{"success":false}')).toBe(true);
  });

  it("普通输出不为错误", () => {
    expect(toolIsError("hello world")).toBe(false);
  });

  it("plaint text Error: prefix", () => {
    expect(toolIsError("Error: failed to read file")).toBe(true);
  });
});

describe("toolHasNoResult", () => {
  it("undefined 为无结果", () => {
    expect(toolHasNoResult(undefined)).toBe(true);
  });

  it("空字符串为无结果", () => {
    expect(toolHasNoResult("")).toBe(true);
    expect(toolHasNoResult("  ")).toBe(true);
  });

  it("非空为有结果", () => {
    expect(toolHasNoResult("hello")).toBe(false);
  });
});

describe("isLizhiVaultTool", () => {
  it("lizhi 前缀判定为 vault 工具", () => {
    expect(isLizhiVaultTool("mcp__lizhi-kb__lizhi_search")).toBe(true);
    expect(isLizhiVaultTool("mcp__lizhi_kb__lizhi_read_document")).toBe(true);
  });

  it("非 lizhi 工具返回 false", () => {
    expect(isLizhiVaultTool("Read")).toBe(false);
    expect(isLizhiVaultTool("mcp__filesystem__read")).toBe(false);
  });
});

describe("isMcpToolName", () => {
  it("MCP 前缀为 MCP 工具", () => {
    expect(isMcpToolName("mcp__filesystem__read_file")).toBe(true);
  });

  it("非 MCP 工具返回 false", () => {
    expect(isMcpToolName("Read")).toBe(false);
    expect(isMcpToolName("Bash")).toBe(false);
  });
});

describe("formatCcToolDisplayName", () => {
  it("格式化常见的工具名", () => {
    expect(formatCcToolDisplayName("read")).toMatch(/read/i);
    expect(formatCcToolDisplayName("bash")).toMatch(/bash/i);
  });

  it("处理 MCP 工具名", () => {
    const name = formatCcToolDisplayName("mcp__filesystem__read_file");
    expect(name.length).toBeGreaterThan(0);
  });
});

describe("groupCcToolCalls", () => {
  it("分组 Read 工具", () => {
    const items: CcToolCallItem[] = [
      { name: "Read", input: '{"file_path":"/a.md"}' },
      { name: "Read", input: '{"file_path":"/b.md"}' },
    ];
    const groups = groupCcToolCalls(items);
    expect(groups.length).toBe(1);
    expect(groups[0]?.type).toBe("read_group");
    if (groups[0]?.type === "read_group") {
      expect(groups[0].items.length).toBe(2);
    }
  });

  it("分组 Bash 工具", () => {
    const items: CcToolCallItem[] = [
      { name: "Bash", input: '{"command":"ls"}' },
      { name: "Bash", input: '{"command":"pwd"}' },
    ];
    const groups = groupCcToolCalls(items);
    expect(groups.length).toBe(1);
    expect(groups[0]?.type).toBe("bash_group");
    if (groups[0]?.type === "bash_group") {
      expect(groups[0].items.length).toBe(2);
    }
  });

  it("不同工具类型分开分组", () => {
    const items: CcToolCallItem[] = [
      { name: "Read", input: '{"file_path":"/a.md"}' },
      { name: "Bash", input: '{"command":"ls"}' },
      { name: "Grep", input: '{"pattern":"test"}' },
    ];
    const groups = groupCcToolCalls(items);
    expect(groups.length).toBe(3);
  });

  it("agent 工具独立分组", () => {
    const items: CcToolCallItem[] = [
      { name: "Task", input: '{"description":"test agent"}' },
    ];
    const groups = groupCcToolCalls(items);
    expect(groups.length).toBe(1);
    expect(groups[0]?.type).toBe("agent_group");
  });

  it("空列表返回空数组", () => {
    expect(groupCcToolCalls([])).toEqual([]);
  });
});
