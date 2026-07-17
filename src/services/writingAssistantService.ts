import {
  LLM_AUTO_TARGET,
  streamAiChat,
  streamAiRag,
  type ChatMessage,
  type LlmTarget,
  type StreamEvent,
} from "./aiService";
import { parseIllustrationPrompts } from "../utils/writingAssistant/parseIllustrationPrompts";
import {
  normalizeHumanizeSkillName,
  resolveTargetWords,
  WA_HUMANIZE_FALLBACK_RULES,
  WA_OUTLINE_FRAMEWORK_HINTS,
  WA_OUTLINE_FRAMEWORK_LABELS,
} from "../utils/writingAssistant/defaults";
import { getBuiltinStylePack } from "../utils/writingAssistant/stylePacks";
import { resolveStylePrompt, truncateForInject } from "../utils/writingAssistant/stylePacks/stylePackUtils";
import {
  buildSectionWordBudgets,
  formatWordBudgetForPrompt,
} from "../utils/writingAssistant/outlineFrameworks";
import type { WaStylePack } from "../utils/writingAssistant/stylePacks/types";
import type {
  WaConfig,
  WaIllustrationPrompt,
  WaStepId,
} from "../types/writingAssistant";
import { readCcSkillMd } from "./ccWorkbenchService";

export type WaTextStepId = "topic" | "outline" | "body" | "humanize";

export interface WaStreamContext {
  config: WaConfig;
  /** 当前选中的风格包（缺省回退内置 default） */
  stylePack?: WaStylePack;
  /** 选题意图（topic 步的用户输入） */
  intent?: string;
  /** 已采用的选题标题 */
  topicTitle?: string;
  /** 已采用的大纲 */
  outline?: string;
  /** 已采用的正文（humanize 用） */
  body?: string;
  /** 预加载的去 AI 味 Skill 正文（缺省则走内置兜底） */
  humanizeSkillBody?: string;
  llmTarget: LlmTarget;
}

export interface WaStreamHandlers {
  onToken: (text: string) => void;
  onError?: (msg: string) => void;
  shouldCancel?: () => boolean;
}

const SYSTEM_BASE =
  "你是「狸知写作助手」，为用户撰写面向公众号的中文长文。内容需准确、结构清晰、可读性强。仅输出 Markdown，不要复述指令。";

function packFor(ctx: WaStreamContext): WaStylePack {
  return (
    ctx.stylePack ||
    getBuiltinStylePack(ctx.config.stylePackId) ||
    getBuiltinStylePack("default")!
  );
}

function styleBlock(ctx: WaStreamContext): string {
  return resolveStylePrompt(ctx.config, packFor(ctx));
}

function lengthDesc(cfg: WaConfig): string {
  const target = resolveTargetWords(cfg.targetWords);
  return `约 ${target} 字`;
}

/** 读取并截断去 AI 味 Skill；失败返回 null */
export async function loadHumanizeSkillBody(skillRaw: string): Promise<string | null> {
  const name = normalizeHumanizeSkillName(skillRaw);
  if (!name) return null;
  try {
    const raw = await readCcSkillMd(name);
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return truncateForInject(trimmed);
  } catch {
    return null;
  }
}

export function buildTopicMessages(ctx: WaStreamContext): ChatMessage[] {
  const intent = (ctx.intent ?? "").trim() || "请帮我推荐一个公众号长文选题";
  const user = `意图：${intent}\n\n请给出 3 个候选选题，每个包含：\n- 标题（10–22 字）\n- 角度（一句话说明切入点和读者收益）\n\n以 Markdown 列表呈现，编号 1./2./3.。\n\n${styleBlock(ctx)}`;
  return [
    { role: "system", content: SYSTEM_BASE },
    { role: "user", content: user },
  ];
}

export function buildOutlineMessages(ctx: WaStreamContext): ChatMessage[] {
  const cfg = ctx.config;
  const title = (ctx.topicTitle ?? "").trim() || "未命名选题";
  const frameworkLabel =
    WA_OUTLINE_FRAMEWORK_LABELS[cfg.outlineFramework] ?? "总分总（通用）";
  const frameworkHint = WA_OUTLINE_FRAMEWORK_HINTS[cfg.outlineFramework] ?? "";
  const existing = (ctx.outline ?? "").trim();
  const skeletonHint = existing
    ? `\n\n当前已有大纲草稿（请在此结构上充实/改写，保留合理章节，输出完整大纲）：\n${existing}\n`
    : "";
  const user = `标题：${title}\n意图：${ctx.intent ?? ""}\n\n请按结构框架「${frameworkLabel}」${frameworkHint ? `（${frameworkHint}）` : ""}撰写大纲。\n书写形式：Markdown 多级标题——\`##\` 一级章节、\`###\` 小节，必要时 \`####\`；节下可用 \`-\` 要点。层级与节数跟随框架节奏，可按选题增删嵌套，避免空洞占位。\n每节用一句话点明要写什么；贴合选题。\n仅输出大纲 Markdown，不要正文。${skeletonHint}`;
  return [
    { role: "system", content: SYSTEM_BASE },
    { role: "user", content: user },
  ];
}

export function buildBodyMessages(ctx: WaStreamContext): ChatMessage[] {
  const cfg = ctx.config;
  const title = (ctx.topicTitle ?? "").trim() || "未命名选题";
  const outline = (ctx.outline ?? "").trim();
  const budgets = buildSectionWordBudgets(cfg.outlineFramework, cfg.targetWords);
  const budgetBlock = formatWordBudgetForPrompt(budgets);
  const user = `标题：${title}\n大纲：\n${outline}\n\n请按大纲逐节撰写正文，目标长度：${lengthDesc(cfg)}。\n- 按大纲标题层级撰写：保留 \`##\` / \`###\` / \`####\` 对应关系，不要把多级全部压成二级标题\n- 每节 2–4 段，避免堆砌套话\n- 不需要文首一级标题（系统会自动加）\n- 不要输出配图占位\n${budgetBlock ? `\n${budgetBlock}\n` : ""}\n${styleBlock(ctx)}`;
  return [
    { role: "system", content: SYSTEM_BASE },
    { role: "user", content: user },
  ];
}

export function buildHumanizeMessages(ctx: WaStreamContext): ChatMessage[] {
  const body = (ctx.body ?? "").trim();
  const skillName = normalizeHumanizeSkillName(ctx.config.humanizeSkill);
  const skillBody = (ctx.humanizeSkillBody ?? "").trim();
  const rules = skillBody
    ? `请按下列 Skill「${skillName}」对正文做去 AI 味改写，并输出完整改写后正文（含标题），不要解释。\n\n—— Skill 规范开始 ——\n${skillBody}\n—— Skill 规范结束 ——`
    : WA_HUMANIZE_FALLBACK_RULES;
  const user = `${rules}\n\n${styleBlock(ctx)}\n\n正文：\n${body}`;
  return [
    { role: "system", content: SYSTEM_BASE },
    { role: "user", content: user },
  ];
}

export function buildIllustrationsMessages(ctx: WaStreamContext): ChatMessage[] {
  const outline = (ctx.outline ?? "").trim();
  const body = (ctx.body ?? "").trim();
  const user = `基于以下大纲与正文，为每个 \`##\` 小节生成一张「版式配图提示词」（默认用于本地 Canvas 合成）。\n输出一个 JSON 数组，每个元素字段：\n- sectionId：对应小节标题\n- title：图上主文案（≤ 14 字）\n- caption：一句画面说明（≤ 30 字）\n- keywords：3–5 个视觉关键词\n- layout：hero | split | bullets\n- mood：cool | warm | neutral\n\n仅输出 JSON 数组，不要解释。\n大纲：\n${outline}\n\n正文：\n${body}`;
  return [
    { role: "system", content: SYSTEM_BASE + " 配图提示词需结构化、可被 Canvas 渲染。" },
    { role: "user", content: user },
  ];
}

function ragQuestionFor(kind: WaTextStepId, ctx: WaStreamContext): string {
  switch (kind) {
    case "topic":
      return `我要写一篇公众号长文，意图：${ctx.intent ?? ""}。请结合知识库相关内容，给出选题参考与要点。`;
    case "outline":
      return `标题：${ctx.topicTitle ?? ""}；意图：${ctx.intent ?? ""}。请结合知识库相关内容，给出一份大纲。`;
    case "body":
      return `标题：${ctx.topicTitle ?? ""}；大纲：\n${ctx.outline ?? ""}\n请结合知识库相关内容，按大纲逐节撰写正文。`;
    case "humanize":
    default:
      return `请对以下正文做去 AI 味改写：\n${ctx.body ?? ""}`;
  }
}

/** 流式执行一个文本步骤，返回完整文本。 */
export async function streamWaTextStep(
  kind: WaTextStepId,
  ctx: WaStreamContext,
  handlers: WaStreamHandlers,
): Promise<string> {
  const target = ctx.llmTarget || LLM_AUTO_TARGET;
  const shouldCancel = handlers.shouldCancel ?? (() => false);

  let full = "";
  let errMsg: string | null = null;

  const onEvent = (event: StreamEvent) => {
    if (shouldCancel()) return;
    if (event.type === "token") {
      full += event.content;
      handlers.onToken(event.content);
    } else if (event.type === "error") {
      errMsg = event.message;
    }
  };

  const useRag = ctx.config.useRag && (kind === "topic" || kind === "body");
  try {
    if (useRag) {
      await streamAiRag({ question: ragQuestionFor(kind, ctx), llmTarget: target }, onEvent);
    } else {
      let streamCtx = ctx;
      if (kind === "humanize" && ctx.humanizeSkillBody == null) {
        const body = await loadHumanizeSkillBody(ctx.config.humanizeSkill);
        streamCtx = { ...ctx, humanizeSkillBody: body ?? undefined };
      }
      const messages = buildMessagesFor(kind, streamCtx);
      await streamAiChat(messages, target, onEvent);
    }
  } catch (e) {
    errMsg = formatStreamError(e);
  }

  if (errMsg && !shouldCancel()) {
    handlers.onError?.(errMsg);
    return full;
  }
  return full;
}

function formatStreamError(e: unknown): string {
  if (e instanceof Error && e.message.trim()) return e.message;
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object") {
    const rec = e as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
    try {
      const s = JSON.stringify(e);
      if (s && s !== "{}") return s;
    } catch {
      /* ignore */
    }
  }
  return "请求失败";
}

function buildMessagesFor(kind: WaTextStepId, ctx: WaStreamContext): ChatMessage[] {
  switch (kind) {
    case "topic":
      return buildTopicMessages(ctx);
    case "outline":
      return buildOutlineMessages(ctx);
    case "body":
      return buildBodyMessages(ctx);
    case "humanize":
      return buildHumanizeMessages(ctx);
    default:
      return buildTopicMessages(ctx);
  }
}

/** 生成配图结构化提示词（流式 + 解析）；解析失败返回 null，调用方可手改原文。 */
export async function streamWaIllustrationPrompts(
  ctx: WaStreamContext,
  handlers: WaStreamHandlers,
): Promise<{ prompts: WaIllustrationPrompt[] | null; raw: string }> {
  const target = ctx.llmTarget || LLM_AUTO_TARGET;
  const shouldCancel = handlers.shouldCancel ?? (() => false);
  let raw = "";
  let errMsg: string | null = null;
  const onEvent = (event: StreamEvent) => {
    if (shouldCancel()) return;
    if (event.type === "token") {
      raw += event.content;
      handlers.onToken(event.content);
    } else if (event.type === "error") {
      errMsg = event.message;
    }
  };
  try {
    await streamAiChat(buildIllustrationsMessages(ctx), target, onEvent);
  } catch (e) {
    errMsg = formatStreamError(e);
  }
  if (errMsg && !shouldCancel()) {
    handlers.onError?.(errMsg);
  }
  return { prompts: parseIllustrationPrompts(raw), raw };
}

export const WA_SUPPORTED_TEXT_STEPS: WaStepId[] = ["topic", "outline", "body", "humanize"];
