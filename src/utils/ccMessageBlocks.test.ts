import { describe, it, expect, beforeEach } from "vitest";
import {
  applyTokenToBlocks,
  applyThinkingToBlocks,
  applyToolCallToBlocks,
  applyToolResultToBlocks,
  blocksToRenderSegments,
  copyTextFromBlocks,
  messageHasVisibleBlocks,
  resolveMessageBlocks,
  resetStreamingBlockSyncState,
  splitEmbeddedThinking,
  stripThinkingTags,
  syncLegacyFromBlocks,
} from "./ccMessageBlocks";
import type { CcMessageBlock } from "./ccMessageBlocks";

describe("splitEmbeddedThinking", () => {
  it("返回空文本和一个空的 thinking 对于空输入", () => {
    expect(splitEmbeddedThinking("")).toEqual({ text: "", thinking: "" });
  });

  it("剥离 <think> 标签", () => {
    const result = splitEmbeddedThinking(
      "<think>This is a thought</think>Hello world",
    );
    expect(result.text).toBe("Hello world");
    expect(result.thinking).toContain("This is a thought");
  });

  it("剥离 <redacted_thinking> 标签", () => {
    const result = splitEmbeddedThinking(
      "<think>secret</think><redacted_thinking>also secret</redacted_thinking>Visible",
    );
    expect(result.text).toBe("Visible");
  });

  it("返回纯文本不变", () => {
    const result = splitEmbeddedThinking("Just plain text");
    expect(result.text).toBe("Just plain text");
    expect(result.thinking).toBe("");
  });

  it("处理仅 thinking 内容", () => {
    const result = splitEmbeddedThinking("<think>only thinking</think>");
    expect(result.text).toBe("");
    expect(result.thinking).toContain("only thinking");
  });
});

describe("stripThinkingTags", () => {
  it("移除孤立的 thinking 标签", () => {
    expect(stripThinkingTags("<think>hello</think>")).toBe("hello");
    expect(stripThinkingTags("</think>text<think>")).toBe("text");
  });

  it("移除 redacted_thinking 标签", () => {
    expect(stripThinkingTags("<redacted_thinking>bye</redacted_thinking>")).toBe(
      "bye",
    );
  });

  it("不修改不含标签的文本", () => {
    expect(stripThinkingTags("plain text")).toBe("plain text");
  });
});

describe("resolveMessageBlocks", () => {
  it("返回已有的 blocks", () => {
    const blocks: CcMessageBlock[] = [{ type: "text", content: "hello" }];
    expect(resolveMessageBlocks({ content: "", blocks })).toBe(blocks);
  });

  it("从 thinking 和 content 构建 blocks", () => {
    const message = { content: "hello world", thinking: "I think so" };
    const blocks = resolveMessageBlocks(message);
    expect(blocks.some((b) => b.type === "thinking")).toBe(true);
    expect(blocks.some((b) => b.type === "text")).toBe(true);
  });

  it("从 toolCalls 构建 blocks", () => {
    const message = {
      content: "",
      toolCalls: [
        { name: "read", input: '{"path":"/test"}', output: "content" },
      ],
    };
    const blocks = resolveMessageBlocks(message);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.type).toBe("tool");
  });
});

describe("applyToolCallToBlocks", () => {
  it("追加新的工具块", () => {
    const blocks: CcMessageBlock[] = [{ type: "text", content: "hi" }];
    const result = applyToolCallToBlocks(blocks, {
      id: "tool-1",
      name: "Read",
      input: '{"path":"/a"}',
    });
    expect(result.length).toBe(2);
    expect(result[1]!.type).toBe("tool");
  });

  it("更新已有工具块的 input", () => {
    const blocks: CcMessageBlock[] = [
      { type: "tool", id: "tool-1", name: "Read", input: "{}", startedAt: 100 },
    ];
    const result = applyToolCallToBlocks(blocks, {
      id: "tool-1",
      name: "Read",
      input: '{"path":"/updated"}',
    });
    expect(result.length).toBe(1);
    const tool = result[0];
    expect(tool.type === "tool" && tool.input).toBe('{"path":"/updated"}');
  });

  it("无 id 的工具直接追加", () => {
    const blocks: CcMessageBlock[] = [];
    const result = applyToolCallToBlocks(blocks, {
      name: "Bash",
      input: '{"command":"ls"}',
    });
    expect(result.length).toBe(1);
    expect(result[0]!.type).toBe("tool");
  });
});

describe("applyToolResultToBlocks", () => {
  it("按 toolUseId 匹配并设置 output", () => {
    const blocks: CcMessageBlock[] = [
      { type: "tool", id: "tc-1", name: "Read", input: "{}", startedAt: 100 },
    ];
    const result = applyToolResultToBlocks(blocks, {
      toolUseId: "tc-1",
      name: "Read",
      output: "file content",
    });
    const tool = result[0];
    expect(tool.type === "tool" && tool.output).toBe("file content");
    expect(tool.type === "tool" && tool.completedAt).toBeDefined();
  });

  it("按名称匹配并设置 output", () => {
    const blocks: CcMessageBlock[] = [
      { type: "tool", name: "Read", input: "{}", startedAt: 100 },
    ];
    const result = applyToolResultToBlocks(blocks, {
      toolUseId: "tc-new",
      name: "Read",
      output: "content",
    });
    const tool = result[0];
    expect(tool.type === "tool" && tool.output).toBe("content");
    expect(tool.type === "tool" && tool.id).toBe("tc-new");
  });

  it("匹配第一个未完成的工具", () => {
    const blocks: CcMessageBlock[] = [
      {
        type: "tool",
        id: "tc-1",
        name: "Read",
        input: "{}",
        output: "already done",
        startedAt: 100,
      },
      { type: "tool", name: "Write", input: "{}", startedAt: 200 },
    ];
    const result = applyToolResultToBlocks(blocks, {
      name: "Write",
      output: "written",
    });
    expect(result[1]!.type === "tool" && result[1]!.output).toBe("written");
  });

  it("找不到匹配也不修改 blocks", () => {
    const blocks: CcMessageBlock[] = [
      {
        type: "tool",
        id: "tc-1",
        name: "Read",
        input: "{}",
        output: "done",
        startedAt: 100,
      },
    ];
    const result = applyToolResultToBlocks(blocks, {
      toolUseId: "tc-9",
      name: "Write",
      output: "nope",
    });
    expect(result).toHaveLength(1);
  });
});

describe("applyTokenToBlocks", () => {
  beforeEach(() => {
    resetStreamingBlockSyncState();
  });

  it("追加文本 token", () => {
    const blocks: CcMessageBlock[] = [];
    const result = applyTokenToBlocks(blocks, "hello");
    expect(result.some((b) => b.type === "text" && b.content === "hello")).toBe(true);
  });

  it("追加多个 token 到已有 text block", () => {
    let blocks: CcMessageBlock[] = [{ type: "text", content: "hello" }];
    blocks = applyTokenToBlocks(blocks, " world");
    expect(
      blocks.some((b) => b.type === "text" && b.content === "hello world"),
    ).toBe(true);
  });

  it("处理嵌入式 thinking", () => {
    let blocks: CcMessageBlock[] = [{ type: "text", content: "visible" }];
    blocks = applyTokenToBlocks(
      blocks,
      "<think>thinking</think> more visible",
    );
    expect(blocks.some((b) => b.type === "thinking")).toBe(true);
  });
});

describe("applyThinkingToBlocks", () => {
  it("添加 thinking block", () => {
    const blocks: CcMessageBlock[] = [];
    const result = applyThinkingToBlocks(blocks, "I'm thinking...");
    expect(result[0]!.type).toBe("thinking");
    const first = result[0]!;
    if (first.type === "thinking") {
      expect(first.content).toContain("I'm thinking");
    }
  });

  it("追加到已有 thinking block", () => {
    let blocks: CcMessageBlock[] = [{ type: "thinking", content: "part1" }];
    blocks = applyThinkingToBlocks(blocks, "part2");
    expect(
      blocks.some(
        (b) => b.type === "thinking" && b.content === "part1part2",
      ),
    ).toBe(true);
  });
});

describe("blocksToRenderSegments", () => {
  it("分组连续的文本和工具", () => {
    const blocks: CcMessageBlock[] = [
      { type: "text", content: "hello" },
      { type: "tool", id: "1", name: "Read", input: "{}", startedAt: 100 },
      { type: "tool", id: "2", name: "Write", input: "{}", startedAt: 200 },
      { type: "text", content: "done" },
    ];
    const segments = blocksToRenderSegments(blocks);
    // text → tools group → text
    expect(segments.length).toBe(3);
    expect(segments[0]!.type).toBe("text");
    expect(segments[1]!.type).toBe("tools");
    expect(segments[1]!.type === "tools" && segments[1]!.items.length).toBe(2);
    expect(segments[2]!.type).toBe("text");
  });

  it("处理空 blocks", () => {
    expect(blocksToRenderSegments([])).toEqual([]);
  });

  it("标记最后一个 thinking", () => {
    const blocks: CcMessageBlock[] = [
      { type: "thinking", content: "think1" },
      { type: "thinking", content: "think2" },
      { type: "text", content: "hello" },
    ];
    const segments = blocksToRenderSegments(blocks);
    const lastThinking = segments
      .filter((s) => s.type === "thinking")
      .pop();
    expect(lastThinking?.type === "thinking" && lastThinking?.isLastThinking).toBe(true);
  });
});

describe("copyTextFromBlocks", () => {
  it("提取纯文本", () => {
    const blocks: CcMessageBlock[] = [
      { type: "text", content: "hello" },
      { type: "tool", id: "1", name: "Read", input: "{}", startedAt: 100 },
      { type: "text", content: "world" },
    ];
    expect(copyTextFromBlocks(blocks)).toBe("hello\n\nworld");
  });

  it("跳过空白文本", () => {
    const blocks: CcMessageBlock[] = [{ type: "text", content: "   " }];
    expect(copyTextFromBlocks(blocks)).toBe("");
  });
});

describe("messageHasVisibleBlocks", () => {
  it("检测可见内容", () => {
    expect(messageHasVisibleBlocks([{ type: "text", content: "hi" }])).toBe(true);
    expect(
      messageHasVisibleBlocks([{ type: "thinking", content: "th" }]),
    ).toBe(true);
    expect(
      messageHasVisibleBlocks([
        { type: "tool", name: "Read", input: "{}", startedAt: 100 },
      ]),
    ).toBe(true);
  });

  it("检测空内容", () => {
    expect(messageHasVisibleBlocks([{ type: "text", content: "" }])).toBe(false);
    expect(messageHasVisibleBlocks([])).toBe(false);
  });
});

describe("syncLegacyFromBlocks", () => {
  it("从 blocks 重建 content/thinking/toolCalls", () => {
    const blocks: CcMessageBlock[] = [
      { type: "thinking", content: "think" },
      { type: "text", content: "hello " },
      {
        type: "tool",
        id: "t1",
        name: "Read",
        input: '{"f":"a"}',
        output: "ok",
        startedAt: 100,
      },
      { type: "text", content: "world" },
    ];
    const legacy = syncLegacyFromBlocks(blocks);
    expect(legacy.content).toBe("hello world");
    expect(legacy.thinking).toBe("think");
    expect(legacy.toolCalls?.length).toBe(1);
    expect(legacy.toolCalls?.[0]?.id).toBe("t1");
  });
});
