/** 风格包来源（合并后） */
export type WaStylePackSource = "builtin" | "vault";

/** 写作风格包 */
export interface WaStylePack {
  id: string;
  label: string;
  hint: string;
  wordRange?: string;
  order: number;
  promptMarkdown: string;
  source: WaStylePackSource;
  /** 是否存在同名内置（用于「恢复内置」） */
  hasBuiltin: boolean;
}

/** 落盘 / IPC 用的可写载荷 */
export interface WaStylePackWrite {
  id: string;
  label: string;
  hint: string;
  wordRange?: string;
  order: number;
  body: string;
}

export const WA_STYLE_PROMPT_SAVE_MAX = 12_000;
export const WA_STYLE_PROMPT_INJECT_MAX = 8_000;

export const WA_STYLE_ID_RE = /^[a-z][a-zA-Z0-9_-]*$/;
