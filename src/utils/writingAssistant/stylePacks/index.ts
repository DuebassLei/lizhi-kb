import defaultMd from "./content/default.md?raw";
import viralMd from "./content/viral.md?raw";
import checklistMd from "./content/checklist.md?raw";
import resourceRoundupMd from "./content/resourceRoundup.md?raw";
import toolReviewMd from "./content/toolReview.md?raw";
import contrarianMd from "./content/contrarian.md?raw";
import identityMd from "./content/identity.md?raw";
import storyEmotionalMd from "./content/storyEmotional.md?raw";
import personalEssayMd from "./content/personalEssay.md?raw";
import type { WaStylePack } from "./types";

type BuiltinMeta = Omit<WaStylePack, "promptMarkdown" | "source" | "hasBuiltin"> & {
  promptMarkdown: string;
};

const BUILTIN_META: BuiltinMeta[] = [
  {
    id: "default",
    label: "默认",
    hint: "教程、测评、经验分享",
    wordRange: "2000–4000 字",
    order: 1,
    promptMarkdown: defaultMd,
  },
  {
    id: "viral",
    label: "高流量/爆款",
    hint: "概念科普、行业观察",
    wordRange: "2500–4000 字",
    order: 2,
    promptMarkdown: viralMd,
  },
  {
    id: "checklist",
    label: "清单体/方法论",
    hint: "干货步骤、效率提升、方法论",
    wordRange: "2000–4000 字",
    order: 3,
    promptMarkdown: checklistMd,
  },
  {
    id: "resourceRoundup",
    label: "资源盘点",
    hint: "工具替代方案、合集推荐",
    wordRange: "3000–6000 字",
    order: 4,
    promptMarkdown: resourceRoundupMd,
  },
  {
    id: "toolReview",
    label: "个人实测推荐",
    hint: "软件、工具、亲身实测盘点",
    wordRange: "4000–7000 字",
    order: 5,
    promptMarkdown: toolReviewMd,
  },
  {
    id: "contrarian",
    label: "认知颠覆",
    hint: "反常识观点、戳破误区",
    wordRange: "2000–3500 字",
    order: 6,
    promptMarkdown: contrarianMd,
  },
  {
    id: "identity",
    label: "身份共鸣/逆袭",
    hint: "转行经历、普通人逆袭",
    wordRange: "2500–4000 字",
    order: 7,
    promptMarkdown: identityMd,
  },
  {
    id: "storyEmotional",
    label: "故事化/情感共鸣",
    hint: "人物经历、困境突破",
    wordRange: "2500–4500 字",
    order: 8,
    promptMarkdown: storyEmotionalMd,
  },
  {
    id: "personalEssay",
    label: "深度随笔",
    hint: "个人感悟、AI 时代思考",
    wordRange: "4000–7000 字",
    order: 9,
    promptMarkdown: personalEssayMd,
  },
];

export const WA_BUILTIN_STYLE_PACKS: WaStylePack[] = BUILTIN_META.map((p) => ({
  ...p,
  source: "builtin" as const,
  hasBuiltin: true,
}));

export const WA_BUILTIN_STYLE_PACK_MAP: Record<string, WaStylePack> = Object.fromEntries(
  WA_BUILTIN_STYLE_PACKS.map((p) => [p.id, p]),
);

export function getBuiltinStylePack(id: string): WaStylePack | undefined {
  return WA_BUILTIN_STYLE_PACK_MAP[id];
}

/** 合并内置与 vault 包：同 id vault 覆盖内置 */
export function mergeStylePacks(vaultPacks: WaStylePack[]): WaStylePack[] {
  const byId = new Map<string, WaStylePack>();
  for (const p of WA_BUILTIN_STYLE_PACKS) {
    byId.set(p.id, { ...p });
  }
  for (const v of vaultPacks) {
    const builtin = WA_BUILTIN_STYLE_PACK_MAP[v.id];
    byId.set(v.id, {
      ...v,
      source: "vault",
      hasBuiltin: Boolean(builtin),
      order: v.order ?? builtin?.order ?? 100,
    });
  }
  return [...byId.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
