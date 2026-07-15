import type {
  WaIllustrationLayout,
  WaIllustrationPrompt,
  WaMood,
} from "../../types/writingAssistant";

const LAYOUTS: WaIllustrationLayout[] = ["hero", "split", "bullets"];
const MOODS: WaMood[] = ["cool", "warm", "neutral"];

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

function asLayout(v: unknown): WaIllustrationLayout {
  return LAYOUTS.includes(v as WaIllustrationLayout) ? (v as WaIllustrationLayout) : "hero";
}

function asMood(v: unknown): WaMood {
  return MOODS.includes(v as WaMood) ? (v as WaMood) : "neutral";
}

function normalizeItem(raw: Record<string, unknown>): WaIllustrationPrompt {
  return {
    sectionId: isString(raw.sectionId) ? raw.sectionId : isString(raw.title) ? raw.title : "section",
    title: isString(raw.title) ? raw.title : "未命名",
    caption: isString(raw.caption) ? raw.caption : "",
    keywords: isStringArray(raw.keywords) ? raw.keywords : [],
    layout: asLayout(raw.layout),
    mood: asMood(raw.mood),
    notes: isString(raw.notes) ? raw.notes : undefined,
    enabled: raw.enabled === false ? false : true,
  };
}

/**
 * 从 LLM 输出中抽取结构化配图提示词 JSON 数组。
 * 容忍 ```json fenced、前后解释文本、单对象、数组。
 * 解析失败返回 null（调用方保留原文供手改）。
 */
export function parseIllustrationPrompts(text: string): WaIllustrationPrompt[] | null {
  if (!text || !text.trim()) return null;

  // 1. fenced ```json ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = tryParse(fenced[1]);
    if (parsed) return parsed;
  }
  // 2. first JSON array in text
  const arrMatch = text.match(/\[\s*[\s\S]*\]/);
  if (arrMatch) {
    const parsed = tryParse(arrMatch[0]);
    if (parsed) return parsed;
  }
  // 3. first JSON object
  const objMatch = text.match(/\{\s*[\s\S]*\}/);
  if (objMatch) {
    const parsed = tryParse(objMatch[0]);
    if (parsed) return parsed;
  }
  return null;
}

function tryParse(snippet: string): WaIllustrationPrompt[] | null {
  try {
    const data = JSON.parse(snippet);
    if (Array.isArray(data)) {
      const items = data
        .filter((d) => d && typeof d === "object")
        .map((d) => normalizeItem(d as Record<string, unknown>));
      return items.length > 0 ? items : null;
    }
    if (data && typeof data === "object") {
      const inner = (data as { illustrations?: unknown; prompts?: unknown }).illustrations ??
        (data as { prompts?: unknown }).prompts;
      if (Array.isArray(inner)) {
        const items = inner
          .filter((d) => d && typeof d === "object")
          .map((d) => normalizeItem(d as Record<string, unknown>));
        return items.length > 0 ? items : null;
      }
      return [normalizeItem(data as Record<string, unknown>)];
    }
    return null;
  } catch {
    return null;
  }
}
