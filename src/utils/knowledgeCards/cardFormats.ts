import type { CardFormat, CardFormatId } from "../../types/knowledgeCards";

export const CARD_FORMATS: Record<CardFormatId, CardFormat> = {
  xhs: {
    id: "xhs",
    name: "小红书",
    width: 1080,
    height: 1440,
    ratio: "3:4",
    description: "小红书图文/封面，3:4 竖版比例",
  },
  wechat: {
    id: "wechat",
    name: "微信贴图",
    width: 1080,
    height: 1520,
    ratio: "~3:4.2",
    description: "微信公众号长图，适合贴图分享",
  },
  instagram: {
    id: "instagram",
    name: "方形",
    width: 1080,
    height: 1080,
    ratio: "1:1",
    description: "Instagram / 通用方形卡片",
  },
  story: {
    id: "story",
    name: "竖屏故事",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    description: "朋友圈/Story 竖屏全屏",
  },
  custom: {
    id: "custom",
    name: "自定义",
    width: 1080,
    height: 1440,
    ratio: "自定义",
    description: "用户自定义尺寸",
  },
};

export function getCardFormat(
  id: CardFormatId,
  customSize?: { width: number; height: number },
): CardFormat {
  const base = CARD_FORMATS[id];
  if (id === "custom" && customSize) {
    return {
      ...base,
      width: customSize.width,
      height: customSize.height,
      ratio: `${customSize.width}×${customSize.height}`,
    };
  }
  return base;
}
