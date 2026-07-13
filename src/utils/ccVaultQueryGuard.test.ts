import { describe, expect, it } from "vitest";

import {
  checkVaultKnowledgeReply,
  containsPseudoLizhiToolMarkup,
  extractVaultSearchQuery,
  isWeakVaultToolModel,
  parsePseudoVaultToolCalls,
  extractVaultDocumentIds,
  userMessageLooksLikeVaultQuery,
  VAULT_PSEUDO_TOOL_MARKUP_ERROR,
} from "./ccVaultQueryGuard";

describe("containsPseudoLizhiToolMarkup", () => {
  it("detects fake lizhi_search XML in assistant text", () => {
    const text = `我来帮你搜索知识库中关于"大模型"的笔记。

<lizhi_search>
<query>大模型</query>
<top_k>10</top_k>
</lizhi_search>`;
    expect(containsPseudoLizhiToolMarkup(text)).toBe(true);
  });

  it("ignores normal prose", () => {
    expect(containsPseudoLizhiToolMarkup("请使用 lizhi_search 工具检索笔记。")).toBe(false);
  });

  it("detects MiniMax function_calls pseudo invoke", () => {
    const text = `<function_calls>
<invoke name="lizhi_search">
<parameter name="query">大模型</parameter>
</invoke>
</function_calls>`;
    expect(containsPseudoLizhiToolMarkup(text)).toBe(true);
  });

  it("detects tool_call pseudo read_document", () => {
    const text = `<tool_call>
<tool name="mcp__lizhi-kb__lizhi_read_document">
<arg id="1d39919a-56cc-44c6-b15b-12d662ac89de"/>
</tool>
</tool_call>`;
    expect(containsPseudoLizhiToolMarkup(text)).toBe(true);
  });
});

describe("checkVaultKnowledgeReply", () => {
  it("flags pseudo tool markup when no real MCP call", () => {
    const result = checkVaultKnowledgeReply({
      cwdMode: "vault",
      userText: "帮我查找知识库关于大模型",
      assistantText: `<lizhi_search><query>大模型</query></lizhi_search>`,
      toolCalls: [],
      blocks: [],
      streaming: false,
      turnComplete: true,
    });
    expect(result.violation).toBe(true);
    expect(result.message).toBe(VAULT_PSEUDO_TOOL_MARKUP_ERROR);
  });

  it("skips pseudo markup error when prefetch tool block exists", () => {
    const result = checkVaultKnowledgeReply({
      cwdMode: "vault",
      userText: "帮我查找知识库关于大模型",
      assistantText: `<lizhi_search><query>大模型</query></lizhi_search>`,
      blocks: [
        {
          type: "tool",
          name: "mcp__lizhi-kb__lizhi_search",
          input: '{"query":"大模型"}',
          output: '[{"title":"测试"}]',
        },
      ],
      streaming: false,
      turnComplete: true,
    });
    expect(result.violation).toBe(false);
  });
});

describe("extractVaultSearchQuery", () => {
  it("extracts topic from natural language", () => {
    expect(extractVaultSearchQuery('帮我查找知识库关于"大模型"的笔记')).toBe("大模型");
  });

  it("strips meta suffix 详细信息 from topic", () => {
    expect(extractVaultSearchQuery("知识库关于大模型详细信息")).toBe("大模型");
  });
});

describe("extractVaultDocumentIds", () => {
  it("extracts uuid from read request", () => {
    const id = "1d39919a-56cc-44c6-b15b-12d662ac89de";
    expect(extractVaultDocumentIds(`${id} 查看全文`)).toEqual([id]);
  });
});

describe("userMessageLooksLikeVaultQuery", () => {
  it("treats standalone doc id as vault read", () => {
    expect(userMessageLooksLikeVaultQuery("1d39919a-56cc-44c6-b15b-12d662ac89de")).toBe(true);
  });
});

describe("parsePseudoVaultToolCalls", () => {
  it("parses tool_call read_document with arg id", () => {
    const calls = parsePseudoVaultToolCalls(`<tool_call>
<tool name="mcp__lizhi-kb__lizhi_read_document">
<arg id="1d39919a-56cc-44c6-b15b-12d662ac89de"/>
</tool>
</tool_call>`);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.docId).toBe("1d39919a-56cc-44c6-b15b-12d662ac89de");
  });

  it("parses bracket tool_call with arrow syntax", () => {
    const calls = parsePseudoVaultToolCalls(`[tool_call]
{tool => "mcp__lizhi-kb__lizhi_read_document", args => {
--id "05aa7814-6ca9-4038-a423-50a01eed0436"
}}
[/tool_call]`);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.docId).toBe("05aa7814-6ca9-4038-a423-50a01eed0436");
  });
});

describe("userMessageLooksLikeVaultQuery follow-up", () => {
  it("treats 需要 as vault read when prior assistant listed ids", () => {
    const prior = [
      {
        role: "assistant",
        content:
          "id: 05aa7814-6ca9-4038-a423-50a01eed0436\nid: dfacc426-217b-4495-8154-d18ddd9fd8a8\n需要我帮你读取吗？",
      },
    ];
    expect(userMessageLooksLikeVaultQuery("需要", { priorMessages: prior })).toBe(true);
  });
});

describe("isWeakVaultToolModel", () => {
  it("matches deepseek flash models", () => {
    expect(isWeakVaultToolModel("deepseek-v4-flash")).toBe(true);
  });

  it("matches LOCAL/MiniMax-M2.7", () => {
    expect(isWeakVaultToolModel("LOCAL/MiniMax-M2.7")).toBe(true);
  });
});
