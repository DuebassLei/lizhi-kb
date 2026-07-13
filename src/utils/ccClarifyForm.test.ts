import { describe, expect, it } from "vitest";

import {
  inferPlainTextChoicesForm,
  inferSectionChoicesForm,
  parseChoiceOptions,
  parseChoiceQuestionLine,
  parseClarifyBlock,
  parseDirectionSectionLine,
  resolveClarifyForm,
  stripClarifyContent,
} from "./ccClarifyForm";

describe("parseChoiceOptions", () => {
  it("解析 A/B 选项（· 分隔）", () => {
    const options = parseChoiceOptions("A) Node.js + Web 前端 · B) Python + 终端");
    expect(options).toHaveLength(2);
    expect(options[0].label).toBe("A) Node.js + Web 前端");
    expect(options[1].label).toBe("B) Python + 终端");
  });

  it("解析 A/B/C 选项", () => {
    const options = parseChoiceOptions(
      "A) 迷宫逃脱 · B) 多人对抗 · C) 生存挑战",
    );
    expect(options).toHaveLength(3);
    expect(options[2].label).toBe("C) 生存挑战");
  });

  it("保留选项内的斜杠", () => {
    const options = parseChoiceOptions("A) LangChain/AutoGen 框架 · B) 轻量自研");
    expect(options).toHaveLength(2);
    expect(options[0].label).toBe("A) LangChain/AutoGen 框架");
  });
});

describe("parseChoiceQuestionLine", () => {
  it("解析编号 + 加粗标签行", () => {
    const parsed = parseChoiceQuestionLine(
      "1. **技术栈**：A) Node.js + Web 前端 · B) Python + 终端",
    );
    expect(parsed?.label).toBe("技术栈");
    expect(parsed?.options).toHaveLength(2);
  });

  it("单选项行返回 null", () => {
    expect(parseChoiceQuestionLine("技术栈：A) 仅一个选项")).toBeNull();
  });
});

describe("inferPlainTextChoicesForm", () => {
  const sample = `好的！在动手之前，请帮我确认以下几点偏好：

1. **技术栈**：A) Node.js + Web 前端 · B) Python + 终端
2. **游戏类型**：A) 迷宫逃脱 · B) 多人对抗 · C) 生存挑战
3. **多智能体实现**：A) LangChain/AutoGen 框架 · B) 轻量自研
4. **视觉风格**：A) ASCII 字符 · B) Canvas 2D 图形

请直接填写选项或者直接说「随便你定」，我会按你的选择设计并实现！`;

  it("从多行 A/B/C 文本推断澄清表单", () => {
    const form = inferPlainTextChoicesForm(sample);
    expect(form).not.toBeNull();
    expect(form?.fields).toHaveLength(4);
    expect(form?.fields[0].label).toBe("技术栈");
    expect(form?.fields[0].options).toHaveLength(2);
    expect(form?.fields[1].options).toHaveLength(3);
    expect(form?.title).toMatch(/确认/);
  });

  it("stripClarifyContent 移除选项行但保留说明正文", () => {
    const stripped = stripClarifyContent(sample);
    expect(stripped).toContain("在动手之前");
    expect(stripped).not.toContain("A) Node.js");
    expect(stripped).not.toContain("请直接填写");
  });
});

describe("resolveClarifyForm", () => {
  it("优先使用 lizhi-clarify 块", () => {
    const content = `说明文字
\`\`\`lizhi-clarify
{"title":"测试","fields":[{"id":"x","label":"X","type":"select","options":[{"value":"a","label":"A"}]}]}
\`\`\``;
    const form = resolveClarifyForm(content);
    expect(form?.title).toBe("测试");
  });

  it("无结构化块时回退到纯文本解析", () => {
    const content =
      "请确认：\n1. **模式**：A) 快速 · B) 完整";
    const form = resolveClarifyForm(content);
    expect(form?.fields[0].label).toBe("模式");
  });

  it("parseClarifyBlock 无效 JSON 返回 null", () => {
    expect(parseClarifyBlock("```lizhi-clarify\n{broken\n```")).toBeNull();
  });
});

describe("inferSectionChoicesForm", () => {
  const multiAgentSample = `可选的 6 个发展方向
请选择你最感兴趣的一个方向，我来实现：

方向 A：真·多智能体协作（通信协议）🤝
核心问题： 当前各 Agent 各自为战，没有协作。

方向 B：LLM 驱动智能体 🧠
核心问题： 目前的 simple_ai 只是简单寻路。

方向 C：深度角色差异化 ⚔️💊🗺️
核心问题： 角色只有符号和名字不同，能力都一样。

方向 D：对抗模式（AI vs AI）⚡
核心问题： 目前只有合作模式。

方向 E：Web 可视化 + 实时观战 🌐
核心问题： 终端交互体验有限。

方向 F：强化学习训练场 🎯
核心问题： 当前 AI 是硬编码规则。

你倾向哪个方向？ 选一个我就开干，完整实现，尽量不留半成品。也可以组合（比如 B+E，或者 A+C）。`;

  it("解析方向 A/B/C 分段式单选题", () => {
    const form = inferSectionChoicesForm(multiAgentSample);
    expect(form).not.toBeNull();
    expect(form?.fields).toHaveLength(2);
    expect(form?.fields[0].options).toHaveLength(6);
    expect(form?.fields[0].options?.[0].label).toContain("真·多智能体协作");
    expect(form?.fields[0].options?.[5].label).toContain("强化学习");
    expect(form?.fields[1].type).toBe("textarea");
    expect(form?.title).toMatch(/选择.*方向/);
  });

  it("resolveClarifyForm 对分段式消息生效", () => {
    const form = resolveClarifyForm(multiAgentSample);
    expect(form?.fields[0].options).toHaveLength(6);
  });

  it("parseDirectionSectionLine 识别 emoji 标题", () => {
    const parsed = parseDirectionSectionLine("方向 A：真·多智能体协作（通信协议）🤝");
    expect(parsed?.letter).toBe("A");
    expect(parsed?.title).toContain("多智能体协作");
  });

  it("stripClarifyContent 保留方向说明正文", () => {
    const stripped = stripClarifyContent(multiAgentSample);
    expect(stripped).toContain("方向 A：真·多智能体协作");
    expect(stripped).toContain("核心问题");
    expect(stripped).not.toContain("你倾向哪个方向");
  });
});
