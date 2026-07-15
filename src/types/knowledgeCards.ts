export interface Size {
  width: number;
  height: number;
}

export type BlockType =
  | "heading"
  | "paragraph"
  | "list"
  | "code"
  | "table"
  | "image"
  | "blockquote"
  | "hr"
  | "page-break"
  | "math";

export interface Block {
  id: string;
  type: BlockType;
  html: string;
  raw: string;
  level?: number;
  atomic: boolean;
  measuredHeight?: number;
  /** 超高块缩放比例（<1 表示缩放入卡） */
  scale?: number;
}

export interface Card {
  id: string;
  blocks: Block[];
  pageNumber: number;
  totalPages: number;
  forcedBreak: boolean;
}

export type CardFormatId = "xhs" | "wechat" | "instagram" | "story" | "custom";

export interface CardFormat {
  id: CardFormatId;
  name: string;
  width: number;
  height: number;
  ratio: string;
  description: string;
}

export type ExportFormat = "png" | "pdf" | "zip";
export type ExportScale = 1 | 2 | 3;

export interface ExportOptions {
  format: ExportFormat;
  scale: ExportScale;
  range: "all" | { pages: number[] };
  filename: string;
}
