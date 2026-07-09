import { marked } from "marked";
import { getThemeAccent, getThemeBg, type WechatThemeId } from "./themes";

export interface ModuleBody {
  label?: string;
  fields: Record<string, string>;
  rows: string[][];
  rawBody: string;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cardFrame(accent: string, bg: string, inner: string, borderLeft = true): string {
  const border = borderLeft
    ? `border-left:4px solid ${accent};border-radius:0 8px 8px 0;`
    : `border:1px solid color-mix(in srgb, ${accent} 25%, #e2e8f0);border-radius:8px;`;
  return (
    `<section class="layout-module" style="margin:16px 0;padding:14px 16px;${border}` +
    `background:${bg}">${inner}</section>`
  );
}

const CALLOUT_META: Record<string, { label: string; color: string; icon: string }> = {
  tip: { label: "提示", color: "#059669", icon: "💡" },
  note: { label: "说明", color: "#64748b", icon: "📌" },
  info: { label: "信息", color: "#0ea5e9", icon: "ℹ️" },
  warning: { label: "注意", color: "#d97706", icon: "⚠️" },
  danger: { label: "危险", color: "#dc2626", icon: "🚨" },
  success: { label: "成功", color: "#16a34a", icon: "✅" },
};

function moduleText(body: ModuleBody): string {
  return (
    body.fields.body ||
    body.fields.text ||
    body.fields.content ||
    body.rawBody
      .split("\n")
      .filter((line) => !line.match(/^[\w.-]+:\s*.+$/))
      .join("\n")
      .trim() ||
    body.rows.map((r) => r.join(" · ")).join("\n")
  );
}

function renderCallout(name: string, body: ModuleBody, _themeId: WechatThemeId): string {
  const meta = CALLOUT_META[name] ?? CALLOUT_META.note;
  const accent = meta.color;
  const bg = `color-mix(in srgb, ${accent} 8%, #fff)`;
  const title = body.fields.title || body.label || meta.label;
  const content = moduleText(body);

  let inner = `<p class="layout-module-title" style="margin:0 0 8px;font-size:14px;font-weight:700;color:${accent}">${meta.icon} ${esc(title)}</p>`;
  if (content) {
    inner += `<p style="margin:0;font-size:14px;color:#475569;line-height:1.65;white-space:pre-wrap">${esc(content)}</p>`;
  }
  return cardFrame(accent, bg, inner);
}

function renderQuoteCard(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const bg = `color-mix(in srgb, ${accent} 6%, #fff)`;
  const text = body.fields.body || body.fields.quote || body.fields.text || "";
  const author = body.fields.author || body.fields.source || "";
  const title = body.fields.title || body.label;

  let inner = "";
  if (title) {
    inner += `<p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${accent}">${esc(title)}</p>`;
  }
  if (text) {
    inner += `<blockquote style="margin:0;padding:0;border:none;font-size:15px;font-style:italic;color:#334155;line-height:1.65">"${esc(text)}"</blockquote>`;
  }
  if (author) {
    inner += `<p style="margin:10px 0 0;font-size:12px;color:#94a3b8">— ${esc(author)}</p>`;
  }
  if (!inner && body.rows.length) {
    inner = `<p style="margin:0;font-size:14px;color:#475569;font-style:italic">${esc(body.rows.map((r) => r.join(" · ")).join("\n"))}</p>`;
  }
  return cardFrame(accent, bg, inner || `<p style="margin:0;color:#94a3b8">引用</p>`);
}

function renderHighlight(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const bg = `color-mix(in srgb, ${accent} 10%, #fff)`;
  const title = body.fields.title || body.label || "重点";
  const content = moduleText(body);

  let inner = `<p class="layout-module-title" style="margin:0 0 8px;font-size:14px;font-weight:700;color:${accent}">✦ ${esc(title)}</p>`;
  if (content) {
    inner += `<p style="margin:0;font-size:15px;color:#1e293b;line-height:1.7;font-weight:500;white-space:pre-wrap">${esc(content)}</p>`;
  }
  return cardFrame(accent, bg, inner, false);
}

function renderSteps(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const bg = `color-mix(in srgb, ${accent} 5%, #fff)`;
  const title = body.fields.title || body.label || body.fields.label;
  let inner = "";
  if (title) {
    inner += `<p class="layout-module-title" style="margin:0 0 12px;font-size:15px;font-weight:600;color:${accent}">${esc(title)}</p>`;
  }
  inner += `<section style="display:flex;flex-direction:column;gap:10px">`;
  body.rows.forEach((row, idx) => {
    const [stepTitle, desc] = row;
    if (!stepTitle) return;
    inner += `<section style="display:flex;gap:12px;align-items:flex-start">`;
    inner += `<span style="flex-shrink:0;width:28px;height:28px;line-height:28px;text-align:center;border-radius:50%;background:${accent};color:#fff;font-size:12px;font-weight:700">${idx + 1}</span>`;
    inner += `<section style="flex:1;min-width:0">`;
    inner += `<p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1e293b">${esc(stepTitle)}</p>`;
    if (desc) inner += `<p style="margin:0;font-size:13px;color:#64748b">${esc(desc)}</p>`;
    inner += `</section></section>`;
  });
  inner += `</section>`;
  return cardFrame(accent, bg, inner, false);
}

function renderTimeline(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const bg = `color-mix(in srgb, ${accent} 5%, #fff)`;
  const title = body.fields.title || body.label;
  let inner = "";
  if (title) {
    inner += `<p class="layout-module-title" style="margin:0 0 12px;font-size:15px;font-weight:600;color:${accent}">${esc(title)}</p>`;
  }
  body.rows.forEach((row, idx) => {
    const [time, event, desc] = row;
    if (!time && !event) return;
    inner += `<section style="display:flex;gap:12px;margin:${idx ? "12px" : "0"} 0 0">`;
    inner += `<span style="flex-shrink:0;width:4px;border-radius:2px;background:${accent};margin-top:4px"></span>`;
    inner += `<section style="flex:1">`;
    if (time) inner += `<p style="margin:0 0 2px;font-size:11px;font-weight:700;color:${accent}">${esc(time)}</p>`;
    if (event) inner += `<p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1e293b">${esc(event)}</p>`;
    if (desc) inner += `<p style="margin:0;font-size:13px;color:#64748b">${esc(desc)}</p>`;
    inner += `</section></section>`;
  });
  return cardFrame(accent, bg, inner, false);
}

function renderCompare(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const leftTitle = body.fields["left-title"] || body.fields.left || "方案 A";
  const rightTitle = body.fields["right-title"] || body.fields.right || "方案 B";
  const title = body.fields.title || body.label;

  let inner = "";
  if (title) {
    inner += `<p class="layout-module-title" style="margin:0 0 12px;font-size:15px;font-weight:600;color:${accent}">${esc(title)}</p>`;
  }
  inner += `<section style="display:flex;gap:10px;flex-wrap:wrap">`;

  const cols: [string, string][] = [
    [leftTitle, "#fef2f2"],
    [rightTitle, `color-mix(in srgb, ${accent} 8%, #fff)`],
  ];

  cols.forEach(([header, bg], colIdx) => {
    inner += `<section style="flex:1;min-width:120px;padding:12px;border-radius:8px;background:${bg};border:1px solid ${colIdx === 0 ? "#fecaca" : `color-mix(in srgb, ${accent} 30%, #e2e8f0)`}">`;
    inner += `<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${colIdx === 0 ? "#dc2626" : accent}">${esc(header)}</p>`;
    body.rows.forEach((row) => {
      const cell = row[colIdx]?.trim();
      if (cell) inner += `<p style="margin:0 0 6px;font-size:13px;color:#475569;line-height:1.5">${esc(cell)}</p>`;
    });
    inner += `</section>`;
  });
  inner += `</section>`;
  return cardFrame(accent, "#fff", inner, false);
}

function renderColumns(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const bg = getThemeBg(themeId);
  const title = body.fields.title || body.label;
  const colCount = body.rows.reduce((max, row) => Math.max(max, row.length), 0);

  let inner = "";
  if (title) {
    inner += `<p class="layout-module-title" style="margin:0 0 12px;font-size:15px;font-weight:600;color:${accent}">${esc(title)}</p>`;
  }
  if (!colCount) {
    return cardFrame(accent, bg, inner + `<p style="margin:0;color:#94a3b8">多列内容</p>`, false);
  }

  inner += `<section style="display:flex;gap:10px;flex-wrap:wrap">`;
  for (let col = 0; col < colCount; col += 1) {
    inner += `<section style="flex:1;min-width:100px;padding:10px;border-radius:6px;background:color-mix(in srgb, ${accent} 4%, #fff);border-top:2px solid ${accent}">`;
    body.rows.forEach((row, rowIdx) => {
      const cell = row[col]?.trim();
      if (!cell) return;
      const isHeader = rowIdx === 0 && body.fields["header-row"] !== "false";
      inner += `<p style="margin:${rowIdx ? "8px" : "0"} 0 0;font-size:${isHeader ? "13px" : "12px"};font-weight:${isHeader ? "700" : "400"};color:${isHeader ? accent : "#475569"};line-height:1.5">${esc(cell)}</p>`;
    });
    inner += `</section>`;
  }
  inner += `</section>`;
  return cardFrame(accent, bg, inner, false);
}

function renderDivider(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const label = body.fields.title || body.label || body.rows[0]?.[0] || "";

  if (label) {
    return (
      `<section class="layout-module" style="margin:24px 0;text-align:center">` +
      `<span style="display:inline-block;padding:0 12px;font-size:12px;font-weight:600;color:${accent};letter-spacing:0.08em">${esc(label)}</span>` +
      `<hr style="border:none;border-top:2px solid ${accent};margin:8px 0 0"/>` +
      `</section>`
    );
  }
  return (
    `<section class="layout-module" style="margin:24px 0">` +
    `<hr style="border:none;border-top:2px dashed color-mix(in srgb, ${accent} 50%, #e2e8f0);margin:0"/>` +
    `</section>`
  );
}

function extractFencedCode(raw: string): { lang: string; code: string } | null {
  const match = raw.match(/```(\w*)\n([\s\S]*?)```/);
  if (!match) return null;
  return { lang: match[1] || "text", code: match[2].trimEnd() };
}

function renderCodeCard(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const showLabel = body.fields["show-label"] !== "false";
  const title = body.fields.title || "";
  const caption = body.fields.caption || body.fields.desc || "";
  const fenced = extractFencedCode(body.rawBody);
  const lang = fenced?.lang || body.fields.lang || "";
  const code = fenced?.code || body.fields.code || body.rawBody.trim();
  let inner = "";
  if (showLabel && title) {
    inner += `<p class="layout-module-title" style="margin:0 0 10px;font-size:13px;font-weight:600;color:${accent}">${esc(title)}</p>`;
  }
  inner += `<pre><code class="hljs${lang ? ` language-${esc(lang)}` : ""}">${esc(code)}</code></pre>`;
  if (caption) {
    inner += `<p style="margin:8px 0 0;font-size:12px;color:#64748b">${esc(caption)}</p>`;
  }
  return `<section class="layout-module layout-code-card" style="margin:16px 0">${inner}</section>`;
}

function renderTableCard(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const bg = getThemeBg(themeId);
  const title = body.fields.title || body.label || "表格";

  let tableHtml = "";
  const tableSource = body.rawBody.includes("|")
    ? body.rawBody
    : body.rows.map((r) => `| ${r.join(" | ")} |`).join("\n");

  if (tableSource.includes("|")) {
    try {
      tableHtml = marked.parse(tableSource, { async: false }) as string;
    } catch {
      tableHtml = "";
    }
  }

  let inner = `<p class="layout-module-title" style="margin:0 0 10px;font-size:14px;font-weight:600;color:${accent}">${esc(title)}</p>`;
  if (tableHtml) {
    inner += `<section style="overflow-x:auto">${tableHtml}</section>`;
  } else {
    inner += `<p style="margin:0;color:#94a3b8">表格内容为空</p>`;
  }
  return cardFrame(accent, bg, inner, false);
}

function renderFallback(name: string, body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const bg = `color-mix(in srgb, ${accent} 8%, #fff)`;
  const title = body.fields.title || body.fields.heading || body.label || name;

  let inner = `<p class="layout-module-title" style="margin:0 0 8px;font-size:15px;font-weight:600;color:${accent}">${esc(title)}</p>`;
  inner += `<p style="margin:0 0 6px;font-size:11px;color:#94a3b8">未知模块 · ${esc(name)}</p>`;

  for (const [k, v] of Object.entries(body.fields)) {
    if (k === "title" || k === "heading") continue;
    inner += `<p style="margin:6px 0 0;font-size:14px;color:#475569"><strong>${esc(k)}</strong> ${esc(v)}</p>`;
  }
  for (const row of body.rows) {
    inner += `<p style="margin:8px 0 0;font-size:14px;color:#475569">${esc(row.join(" · "))}</p>`;
  }
  if (!body.fields.title && !body.rows.length && !Object.keys(body.fields).length) {
    inner += `<p style="margin:0;font-size:13px;color:#94a3b8">空模块</p>`;
  }
  return cardFrame(accent, bg, inner);
}

const RENDERERS: Record<string, (body: ModuleBody, themeId: WechatThemeId) => string> = {
  tip: (b, t) => renderCallout("tip", b, t),
  note: (b, t) => renderCallout("note", b, t),
  info: (b, t) => renderCallout("info", b, t),
  warning: (b, t) => renderCallout("warning", b, t),
  danger: (b, t) => renderCallout("danger", b, t),
  success: (b, t) => renderCallout("success", b, t),
  callout: (b, t) => renderCallout("note", b, t),
  "quote-card": renderQuoteCard,
  quote: renderQuoteCard,
  blockquote: renderQuoteCard,
  highlight: renderHighlight,
  steps: renderSteps,
  timeline: renderTimeline,
  compare: renderCompare,
  columns: renderColumns,
  column: renderColumns,
  divider: renderDivider,
  hr: renderDivider,
  "code-card": renderCodeCard,
  codecard: renderCodeCard,
  "table-card": renderTableCard,
  tablecard: renderTableCard,
};

export function renderLayoutModule(
  name: string,
  label: string | undefined,
  body: ModuleBody,
  themeId: WechatThemeId,
): string {
  if (label && !body.label) body.label = label;
  const key = name.toLowerCase();
  const fn = RENDERERS[key];
  if (fn) return fn(body, themeId);
  return renderFallback(name, body, themeId);
}
