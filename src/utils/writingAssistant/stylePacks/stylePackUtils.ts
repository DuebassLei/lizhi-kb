import {
  WA_STYLE_ID_RE,
  WA_STYLE_PROMPT_INJECT_MAX,
  WA_STYLE_PROMPT_SAVE_MAX,
  type WaStylePack,
} from "./types";
import { getBuiltinStylePack } from "./index";
import type { WaConfig } from "../../../types/writingAssistant";
import {
  normalizeHumanizeSkillName,
  resolveTargetWords,
  WA_DEFAULT_CONFIG,
} from "../defaults";

const LEGACY_STYLE_MAP: Record<string, string> = {
  clear: "default",
  story: "default",
  rigorous: "default",
  casual: "default",
};

export function applyPlaceholders(
  md: string,
  opts?: { author?: string; publication?: string },
): string {
  const author = opts?.author?.trim() || "作者";
  const publication = opts?.publication?.trim() || "本公众号";
  return md.replace(/\{author\}/g, author).replace(/\{publication\}/g, publication);
}

export function truncateForInject(md: string, max = WA_STYLE_PROMPT_INJECT_MAX): string {
  if (md.length <= max) return md;
  return `${md.slice(0, max)}\n…(规范已截断)`;
}

export function validateStylePackBody(body: string): string | null {
  if (body.length > WA_STYLE_PROMPT_SAVE_MAX) {
    return `风格规范过长（最多 ${WA_STYLE_PROMPT_SAVE_MAX} 字符）`;
  }
  return null;
}

export function validateStylePackId(id: string): string | null {
  if (!WA_STYLE_ID_RE.test(id)) {
    return "风格 id 须以小写字母开头，仅含字母、数字、_、-";
  }
  return null;
}

export function slugifyStyleId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (base && /^[a-z]/.test(base)) return base;
  return `custom_${Date.now().toString(36)}`;
}

/** 解析 vault 风格 md（YAML frontmatter + body） */
export function parseStylePackMarkdown(raw: string): Omit<WaStylePack, "source" | "hasBuiltin"> | null {
  const text = raw.replace(/^\uFEFF/, "");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  const fm = m[1];
  const body = m[2].trim();
  const fields: Record<string, string> = {};
  for (const line of fm.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    fields[key] = val;
  }
  const id = fields.id?.trim();
  const label = fields.label?.trim();
  if (!id || !label || validateStylePackId(id)) return null;
  const order = Number.parseInt(fields.order ?? "100", 10);
  return {
    id,
    label,
    hint: fields.hint?.trim() || "",
    wordRange: fields.wordRange?.trim() || undefined,
    order: Number.isFinite(order) ? order : 100,
    promptMarkdown: body,
  };
}

export function serializeStylePackMarkdown(pack: {
  id: string;
  label: string;
  hint: string;
  wordRange?: string;
  order: number;
  body: string;
}): string {
  const lines = [
    "---",
    `id: ${pack.id}`,
    `label: ${pack.label}`,
    `hint: ${pack.hint}`,
  ];
  if (pack.wordRange) lines.push(`wordRange: ${pack.wordRange}`);
  lines.push(`order: ${pack.order}`, "---", "", pack.body.trim(), "");
  return lines.join("\n");
}

export function resolveStylePrompt(cfg: WaConfig, pack: WaStylePack): string {
  const body = truncateForInject(applyPlaceholders(pack.promptMarkdown));
  const extra = cfg.styleExtra?.trim();
  const parts = [
    `写作风格：${pack.label}`,
    "—— 风格规范开始 ——",
    body,
    "—— 风格规范结束 ——",
  ];
  if (extra) parts.push(`补充要求：${extra}`);
  return parts.join("\n");
}

export function migrateWaConfig(
  raw: Partial<WaConfig> & {
    stylePreset?: string;
    length?: string;
    humanizeStrength?: string;
    targetWords?: number;
    humanizeSkill?: string;
  },
  knownIds?: Set<string>,
): WaConfig {
  const legacy = raw.stylePreset;
  let id =
    raw.stylePackId?.trim() ||
    (legacy ? LEGACY_STYLE_MAP[legacy] : undefined) ||
    WA_DEFAULT_CONFIG.stylePackId;

  if (knownIds) {
    if (!knownIds.has(id)) id = WA_DEFAULT_CONFIG.stylePackId;
  }

  const {
    stylePreset: _drop,
    outlineFormat: _fmt,
    outlineFormatCustom: _fmtCustom,
    length: legacyLength,
    humanizeStrength: _strength,
    ...rest
  } = raw as Partial<WaConfig> & {
    stylePreset?: string;
    outlineFormat?: string;
    outlineFormatCustom?: string;
    length?: string;
    humanizeStrength?: string;
  };

  const legacyCover = (rest.defaultCoverTemplate as string) ?? "plain";
  const coverMap: Record<string, WaConfig["defaultCoverTemplate"]> = {
    plain: "plain",
    grid: "grid",
    accent: "accent",
    banner: "plain",
    centered: "grid",
    splitBar: "accent",
  };

  const targetWords = resolveTargetWords(
    rest.targetWords != null ? rest.targetWords : legacyLength,
  );
  const humanizeSkill =
    rest.humanizeSkill != null
      ? normalizeHumanizeSkillName(rest.humanizeSkill)
      : WA_DEFAULT_CONFIG.humanizeSkill;

  return {
    ...WA_DEFAULT_CONFIG,
    ...rest,
    stylePackId: id,
    targetWords,
    humanizeSkill,
    defaultCoverTemplate: coverMap[legacyCover] ?? "plain",
  };
}

export function pickStylePack(packs: WaStylePack[], id: string): WaStylePack {
  return (
    packs.find((p) => p.id === id) ||
    getBuiltinStylePack(id) ||
    getBuiltinStylePack("default") ||
    packs[0]
  );
}
