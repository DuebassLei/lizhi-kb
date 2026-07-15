import { describe, expect, it } from "vitest";
import { parseIllustrationPrompts } from "./parseIllustrationPrompts";

describe("parseIllustrationPrompts", () => {
  it("parses a fenced json array", () => {
    const text = "解释如下：\n```json\n[\n  {\n    \"sectionId\": \"s1\",\n    \"title\": \"引言\",\n    \"caption\": \"图示\",\n    \"keywords\": [\"data\", \"流程\"],\n    \"layout\": \"hero\",\n    \"mood\": \"cool\"\n  }\n]\n```\n结束";
    const res = parseIllustrationPrompts(text);
    expect(res).not.toBeNull();
    expect(res).toHaveLength(1);
    expect(res![0].title).toBe("引言");
    expect(res![0].keywords).toEqual(["data", "流程"]);
    expect(res![0].layout).toBe("hero");
    expect(res![0].mood).toBe("cool");
    expect(res![0].enabled).toBe(true);
  });

  it("parses bare JSON array embedded in text", () => {
    const text = '结果：[{"title":"A","caption":"","keywords":[],"layout":"split","mood":"warm","sectionId":"a"}] 谢谢';
    const res = parseIllustrationPrompts(text);
    expect(res).toHaveLength(1);
    expect(res![0].layout).toBe("split");
    expect(res![0].mood).toBe("warm");
  });

  it("parses a single object with illustrations wrapper", () => {
    const text = '{"illustrations":[{"title":"X","caption":"y","keywords":["k"],"layout":"bullets","mood":"neutral","sectionId":"x"}]}';
    const res = parseIllustrationPrompts(text);
    expect(res).toHaveLength(1);
    expect(res![0].layout).toBe("bullets");
  });

  it("falls back unknown layout/mood to defaults", () => {
    const text = '[{"title":"A","caption":"","keywords":[],"layout":"weird","mood":"oops","sectionId":"a"}]';
    const res = parseIllustrationPrompts(text);
    expect(res![0].layout).toBe("hero");
    expect(res![0].mood).toBe("neutral");
  });

  it("returns null when no JSON found", () => {
    expect(parseIllustrationPrompts("没有 JSON 在这里")).toBeNull();
  });

  it("returns null when array empty", () => {
    expect(parseIllustrationPrompts("[]")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseIllustrationPrompts("")).toBeNull();
  });

  it("preserves notes and enabled=false", () => {
    const text = '[{"title":"A","caption":"","keywords":[],"layout":"hero","mood":"cool","sectionId":"a","notes":"n","enabled":false}]';
    const res = parseIllustrationPrompts(text);
    expect(res![0].notes).toBe("n");
    expect(res![0].enabled).toBe(false);
  });
});
