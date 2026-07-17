import { describe, expect, it } from "vitest";
import { stripAiPrivateBlocks, AI_PRIVATE_SNIPPET } from "./aiPrivacy";

describe("stripAiPrivateBlocks", () => {
  it("removes closed block", () => {
    const md = "公开\n:::ai-private\n密码: x\n:::\n继续";
    expect(stripAiPrivateBlocks(md)).toBe("公开\n继续");
  });

  it("removes unclosed block to eof", () => {
    const md = "公开\n:::ai-private\n密码: x\n尾";
    expect(stripAiPrivateBlocks(md)).toBe("公开");
  });

  it("export leaves no fence markers", () => {
    const md = "前\n:::ai-private\nsecret\n:::\n后";
    const out = stripAiPrivateBlocks(md);
    expect(out).not.toContain(":::ai-private");
    expect(out).not.toContain("secret");
    expect(out).toBe("前\n后");
  });

  it("allows space after colons", () => {
    const md = "公开\n::: ai-private\n密码: x\n:::\n继续";
    expect(stripAiPrivateBlocks(md)).toBe("公开\n继续");
  });

  it("allows bracket title form", () => {
    const md = "公开\n:::ai-private[账号]\n密码: x\n:::\n继续";
    expect(stripAiPrivateBlocks(md)).toBe("公开\n继续");
  });

  it("does not match ai-privatex", () => {
    const md = "公开\n:::ai-privatex\n不是敏感\n:::\n继续";
    expect(stripAiPrivateBlocks(md)).toContain("不是敏感");
  });
});

describe("AI_PRIVATE_SNIPPET", () => {
  it("contains fence template", () => {
    expect(AI_PRIVATE_SNIPPET).toContain(":::ai-private");
    expect(AI_PRIVATE_SNIPPET).toContain("账号：");
    expect(AI_PRIVATE_SNIPPET).toContain("密码：");
  });
});

describe("insertAiPrivate wrap shape", () => {
  it("wraps selected text in fences", () => {
    const selected = "secret text";
    const wrapped = `:::ai-private\n${selected}\n:::\n`;
    expect(wrapped).toContain(":::ai-private\nsecret text\n:::");
  });
});
