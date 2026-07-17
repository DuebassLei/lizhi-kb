import type { WechatThemeId } from "./themes";

export interface ModuleBody {
  label?: string;
  fields: Record<string, string>;
  rows: string[][];
  rawBody: string;
}

/** 一级段落标题（供 reading-path 导航） */
export interface PTitleLevel1Item {
  num: string;
  title: string;
  subtitle: string;
}

/** 渲染上下文：全文 Markdown / 章节列表（hero 阅读统计、reading-path） */
export interface ModuleRenderContext {
  fullMarkdown?: string;
  pTitles?: PTitleLevel1Item[];
}

export type LayoutModuleRenderer = (
  body: ModuleBody,
  themeId: WechatThemeId,
  ctx?: ModuleRenderContext,
) => string;
