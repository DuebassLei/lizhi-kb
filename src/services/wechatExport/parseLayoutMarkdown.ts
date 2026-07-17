import { marked } from "marked";
import {
  renderLayoutModule,
  type ModuleBody,
  type ModuleRenderContext,
  type PTitleLevel1Item,
} from "./layoutModuleRenderers";
import type { WechatThemeId } from "./themes";

const MODULE_OPEN_RE = /^:::\s*([\w-]+)(?:\[(.+)\])?(?:\s+(.*))?\s*$/i;
const MODULE_CLOSE_RE = /^:::\s*$/;
const FIELD_RE = /^([\w.-]+):\s*(.+)$/;
const OPEN_ATTR_MODULES = new Set(["steps", "timeline"]);
const ATTR_RE = /([\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;

function parseModuleBody(bodyLines: string[]): ModuleBody {
  const fields: Record<string, string> = {};
  const rows: string[][] = [];
  const rawBody = bodyLines.join("\n");

  for (const raw of bodyLines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    const fm = line.match(FIELD_RE);
    if (fm && !line.includes(" | ")) {
      fields[fm[1]] = fm[2].trim();
      continue;
    }

    if (line.includes("|")) {
      rows.push(line.split("|").map((c) => c.trim()));
    } else {
      rows.push([line.trim()]);
    }
  }

  return { fields, rows, rawBody };
}

function parseOpenAttrs(openInline: string, fields: Record<string, string>): boolean {
  ATTR_RE.lastIndex = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(openInline)) !== null) {
    matched = true;
    fields[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return matched;
}

function parseOpenInline(name: string, openInline: string | undefined, body: ModuleBody): void {
  if (!openInline) return;
  if (openInline.includes("|")) {
    const [left, right] = openInline.split("|").map((s) => s.trim());
    if (name === "compare" || name === "columns") {
      if (left) body.fields["left-title"] = left;
      if (right) body.fields["right-title"] = right;
    } else if (!body.rows.length) {
      body.rows.push([left, right].filter(Boolean) as string[]);
    }
  } else if (parseOpenAttrs(openInline, body.fields)) {
    // key="value" 开标签属性（如 :::badges tone="accent"）
  } else if (name !== "compare" && name !== "columns" && !OPEN_ATTR_MODULES.has(name)) {
    body.fields.title = openInline;
  }
}

function renderPlainMarkdown(markdown: string): string {
  if (!markdown.trim()) return "";
  return marked.parse(markdown, { async: false }) as string;
}

/** 检测正文是否含 ::: 排版模块 */
export function markdownUsesLayoutModules(markdown: string): boolean {
  return /^:::\s*[\w-]+/m.test(markdown);
}

/** 预扫描一级 p-title，供 reading-path 使用 */
export function collectPTitleLevel1(lines: string[]): PTitleLevel1Item[] {
  const list: PTitleLevel1Item[] = [];
  let i = 0;
  while (i < lines.length) {
    const openMatch = lines[i].match(MODULE_OPEN_RE);
    if (!openMatch) {
      i += 1;
      continue;
    }
    const name = openMatch[1].toLowerCase();
    const label = openMatch[2]?.trim();
    const openInline = openMatch[3]?.trim();
    i += 1;
    const bodyLines: string[] = [];
    while (i < lines.length && !MODULE_CLOSE_RE.test(lines[i].trim())) {
      bodyLines.push(lines[i]);
      i += 1;
    }
    if (i < lines.length) i += 1;

    if (name === "p-title") {
      const body = parseModuleBody(bodyLines);
      if (label) body.label = label;
      parseOpenInline(name, openInline, body);
      const level = parseInt(body.fields.level || "1", 10);
      if (level === 1) {
        list.push({
          num: body.fields.num || "",
          title: body.fields.title || body.rows[0]?.[0] || "",
          subtitle: body.fields.subtitle || "",
        });
      }
    }
  }
  return list;
}

/** 将 Markdown（含 :::module 排版块）渲染为 HTML 片段 */
export function parseLayoutMarkdown(markdown: string, themeId: WechatThemeId): string {
  if (!markdown?.trim()) return "";

  const lines = markdown.split("\n");
  const pTitles = collectPTitleLevel1(lines);
  const ctx: ModuleRenderContext = { fullMarkdown: markdown, pTitles };
  const parts: string[] = [];
  let buffer: string[] = [];
  let i = 0;

  function flushBuffer() {
    if (buffer.length) {
      parts.push(renderPlainMarkdown(buffer.join("\n")));
      buffer = [];
    }
  }

  while (i < lines.length) {
    const openMatch = lines[i].match(MODULE_OPEN_RE);
    if (openMatch) {
      flushBuffer();
      const name = openMatch[1].toLowerCase();
      const label = openMatch[2]?.trim();
      const openInline = openMatch[3]?.trim();
      i += 1;
      const bodyLines: string[] = [];
      while (i < lines.length && !MODULE_CLOSE_RE.test(lines[i].trim())) {
        bodyLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;

      const body = parseModuleBody(bodyLines);
      if (label) body.label = label;
      parseOpenInline(name, openInline, body);
      parts.push(renderLayoutModule(name, label, body, themeId, ctx));
    } else {
      buffer.push(lines[i]);
      i += 1;
    }
  }

  flushBuffer();
  return parts.join("\n");
}
