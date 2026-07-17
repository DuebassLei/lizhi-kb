/** AI 隐私 P2：半自动启发式扫描（非硬闸） */

import { isAiPrivateOpenLine, isModuleCloseLine } from "./aiPrivacy";

export interface PrivacyScanHit {
  /** 0-based 行号 */
  startLine: number;
  endLine: number;
  lineText: string;
}

/** 赋值形态：关键词 + [=:：] + 像凭据的值（排除过短/纯中文说明） */
const SECRET_ASSIGN =
  /(?:密码|口令|passwd|password|secret|token|api[_-]?key|access[_-]?key|私钥)\s*[=:：]\s*(\S+)/i;

/** 明显「说明性」取值，降低误报 */
const BENIGN_VALUES =
  /^(?:见(?:上|下|文档|说明)|同上|略|todo|tbd|xxx+|过期|无效|无|none|null|n\/a|示例|example)$/i;

function looksLikeSecretValue(raw: string): boolean {
  const v = raw.trim().replace(/^["'`]+|["'`]+$/g, "");
  if (v.length < 3) return false;
  if (BENIGN_VALUES.test(v)) return false;
  // 纯中文短句（≤6 字且无数字/符号）视为说明，非凭据
  if (/^[\u4e00-\u9fff]{1,6}$/.test(v)) return false;
  return true;
}

/**
 * 扫描正文中不在 `:::ai-private` 内的疑似敏感行。
 * 不构成硬拦截，仅供提示。
 */
export function scanSuspectedSecrets(markdown: string): PrivacyScanHit[] {
  const lines = markdown.split("\n");
  const hits: PrivacyScanHit[] = [];
  let inPrivate = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!inPrivate && isAiPrivateOpenLine(line)) {
      inPrivate = true;
      continue;
    }
    if (inPrivate) {
      if (isModuleCloseLine(line)) inPrivate = false;
      continue;
    }
    const m = SECRET_ASSIGN.exec(line);
    if (m && looksLikeSecretValue(m[1] ?? "")) {
      hits.push({ startLine: i, endLine: i, lineText: line });
    }
  }
  return hits;
}

/** 将 [startLine, endLine] 行包进 :::ai-private */
export function wrapLinesInAiPrivate(
  markdown: string,
  startLine: number,
  endLine: number,
): string {
  const lines = markdown.split("\n");
  const from = Math.max(0, Math.min(startLine, lines.length));
  const to = Math.max(from, Math.min(endLine, lines.length - 1));
  const before = lines.slice(0, from);
  const mid = lines.slice(from, to + 1);
  const after = lines.slice(to + 1);
  return [...before, ":::ai-private", ...mid, ":::", ...after].join("\n");
}

/** 包裹所有命中行：连续块合并为一个围栏，否则多段分别包裹（自后向前避免行号漂移） */
export function wrapPrivacyHits(markdown: string, hits: PrivacyScanHit[]): string {
  if (!hits.length) return markdown;
  const ranges = mergeHitRanges(hits);
  let result = markdown;
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const r = ranges[i];
    result = wrapLinesInAiPrivate(result, r.startLine, r.endLine);
  }
  return result;
}

function mergeHitRanges(hits: PrivacyScanHit[]): PrivacyScanHit[] {
  const sorted = [...hits].sort((a, b) => a.startLine - b.startLine);
  const out: PrivacyScanHit[] = [];
  for (const h of sorted) {
    const last = out[out.length - 1];
    if (last && h.startLine <= last.endLine + 1) {
      last.endLine = Math.max(last.endLine, h.endLine);
      last.lineText = `${last.lineText}\n${h.lineText}`;
    } else {
      out.push({ ...h });
    }
  }
  return out;
}

export function privacyScanFingerprint(hits: PrivacyScanHit[]): string {
  return hits.map((h) => `${h.startLine}:${h.lineText.trim()}`).join("|");
}

const IGNORE_PREFIX = "lizhi-ai-privacy-scan-ignore:";

export function isPrivacyScanIgnored(docId: string, fingerprint: string): boolean {
  try {
    return sessionStorage.getItem(`${IGNORE_PREFIX}${docId}`) === fingerprint;
  } catch {
    return false;
  }
}

export function ignorePrivacyScan(docId: string, fingerprint: string): void {
  try {
    sessionStorage.setItem(`${IGNORE_PREFIX}${docId}`, fingerprint);
  } catch {
    /* ignore quota */
  }
}

export function clearPrivacyScanIgnore(docId: string): void {
  try {
    sessionStorage.removeItem(`${IGNORE_PREFIX}${docId}`);
  } catch {
    /* ignore */
  }
}
