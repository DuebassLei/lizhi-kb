import { marked } from "marked";
import { AI_PRIVATE_PREVIEW_LABEL } from "../../utils/aiPrivacy";
import { getThemeAccent, getThemeBg, type WechatThemeId } from "./themes";
import { renderSupportPlugin } from "./supportPluginRender";
import { ADVANCED_RENDERERS } from "./layoutModulesAdvanced";
import { CHART_RENDERERS } from "./layoutModulesCharts";
import { PRACTICAL_RENDERERS } from "./layoutModulesPractical";
import type {
  LayoutModuleRenderer,
  ModuleBody,
  ModuleRenderContext,
  PTitleLevel1Item,
} from "./layoutModuleTypes";

export type { ModuleBody, ModuleRenderContext, PTitleLevel1Item };

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

/** 开场钩子 / 导语 */
function renderLead(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const title = body.fields.title || body.label || "开场";
  const content = moduleText(body);
  let inner = `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;color:${accent}">OPENING</p>`;
  inner += `<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b">${esc(title)}</p>`;
  if (content) {
    inner += `<p style="margin:0;font-size:16px;font-weight:500;color:#0f172a;line-height:1.75;white-space:pre-wrap">${esc(content)}</p>`;
  }
  return (
    `<section class="layout-module" style="margin:16px 0;padding:18px 16px;border-radius:10px;` +
    `background:linear-gradient(135deg, color-mix(in srgb, ${accent} 12%, #fff) 0%, #fff 70%);` +
    `border:1px solid color-mix(in srgb, ${accent} 22%, #e2e8f0)">${inner}</section>`
  );
}

/** 本期要点 */
function renderSummary(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const bg = `color-mix(in srgb, ${accent} 6%, #fff)`;
  const title = body.fields.title || body.label || "本期要点";
  let inner = `<p class="layout-module-title" style="margin:0 0 12px;font-size:15px;font-weight:700;color:${accent}">📋 ${esc(title)}</p>`;
  const points = body.rows.length
    ? body.rows.map((r) => r.filter(Boolean).join(" · ")).filter(Boolean)
    : moduleText(body).split("\n").map((l) => l.replace(/^[-*·]\s*/, "").trim()).filter(Boolean);
  inner += `<section style="display:flex;flex-direction:column;gap:8px">`;
  points.forEach((p, idx) => {
    inner += `<section style="display:flex;gap:10px;align-items:flex-start">`;
    inner += `<span style="flex-shrink:0;min-width:1.25rem;font-size:12px;font-weight:700;color:${accent}">${idx + 1}.</span>`;
    inner += `<p style="margin:0;font-size:14px;color:#334155;line-height:1.6">${esc(p)}</p>`;
    inner += `</section>`;
  });
  inner += `</section>`;
  return cardFrame(accent, bg, inner, false);
}

/** FAQ 问答 */
function renderFaq(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const title = body.fields.title || body.label || "常见问题";
  let inner = `<p class="layout-module-title" style="margin:0 0 12px;font-size:15px;font-weight:700;color:${accent}">❓ ${esc(title)}</p>`;
  const pairs: { q: string; a: string }[] = [];
  for (const row of body.rows) {
    if (row.length >= 2) pairs.push({ q: row[0], a: row.slice(1).join(" ") });
    else if (row[0]?.startsWith("Q:") || row[0]?.startsWith("问")) {
      pairs.push({ q: row[0].replace(/^(Q:|问[:：]?)\s*/, ""), a: "" });
    } else if (pairs.length && (row[0]?.startsWith("A:") || row[0]?.startsWith("答"))) {
      pairs[pairs.length - 1].a = row[0].replace(/^(A:|答[:：]?)\s*/, "");
    } else if (pairs.length && !pairs[pairs.length - 1].a) {
      pairs[pairs.length - 1].a = row[0];
    }
  }
  pairs.forEach((pair, idx) => {
    inner += `<section style="margin:${idx ? "12px" : "0"} 0 0;padding:12px;border-radius:8px;background:#f8fafc">`;
    inner += `<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0f172a">Q：${esc(pair.q)}</p>`;
    if (pair.a) inner += `<p style="margin:0;font-size:13px;color:#475569;line-height:1.65">A：${esc(pair.a)}</p>`;
    inner += `</section>`;
  });
  return cardFrame(accent, "#fff", inner, false);
}

/** 行动号召 CTA */
function renderCta(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const title = body.fields.title || body.label || "接下来你可以";
  const action = body.fields.action || body.fields.button || body.rows[0]?.[0] || "关注我，获取下一篇";
  const desc = body.fields.desc || body.fields.body || body.rows[0]?.[1] || moduleText(body);
  let inner = `<p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#fff">${esc(title)}</p>`;
  if (desc && desc !== action) {
    inner += `<p style="margin:0 0 12px;font-size:13px;color:rgba(255,255,255,0.88);line-height:1.6">${esc(desc)}</p>`;
  }
  inner += `<p style="margin:0;display:inline-block;padding:8px 16px;border-radius:999px;background:#fff;color:${accent};font-size:13px;font-weight:700">${esc(action)}</p>`;
  return (
    `<section class="layout-module" style="margin:20px 0;padding:20px 16px;border-radius:12px;text-align:center;` +
    `background:linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 70%, #0f172a) 100%)">${inner}</section>`
  );
}

/** 行动清单 */
function renderChecklist(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const bg = `color-mix(in srgb, ${accent} 5%, #fff)`;
  const title = body.fields.title || body.label || "行动清单";
  let inner = `<p class="layout-module-title" style="margin:0 0 12px;font-size:15px;font-weight:700;color:${accent}">☑️ ${esc(title)}</p>`;
  const items = body.rows.length
    ? body.rows.map((r) => r.filter(Boolean).join(" · ")).filter(Boolean)
    : moduleText(body).split("\n").map((l) => l.replace(/^[-*\[\] xX]\s*/, "").trim()).filter(Boolean);
  items.forEach((item) => {
    inner += `<p style="margin:0 0 8px;font-size:14px;color:#334155;line-height:1.55;display:flex;gap:8px;align-items:flex-start">`;
    inner += `<span style="flex-shrink:0;width:16px;height:16px;margin-top:2px;border:1.5px solid ${accent};border-radius:4px;background:#fff"></span>`;
    inner += `<span>${esc(item)}</span></p>`;
  });
  return cardFrame(accent, bg, inner, false);
}

/** 数据亮点 */
function renderStats(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const title = body.fields.title || body.label;
  let inner = "";
  if (title) {
    inner += `<p class="layout-module-title" style="margin:0 0 12px;font-size:14px;font-weight:600;color:${accent}">${esc(title)}</p>`;
  }
  const items = body.rows.length
    ? body.rows
    : [[body.fields.value || "00", body.fields.label || body.fields.desc || "指标说明"]];
  inner += `<section style="display:flex;flex-wrap:wrap;gap:10px">`;
  items.forEach((row) => {
    const value = row[0] || "";
    const label = row[1] || "";
    const note = row[2] || "";
    inner += `<section style="flex:1;min-width:100px;padding:14px 12px;border-radius:10px;text-align:center;` +
      `background:color-mix(in srgb, ${accent} 8%, #fff);border:1px solid color-mix(in srgb, ${accent} 20%, #e2e8f0)">`;
    inner += `<p style="margin:0 0 4px;font-size:24px;font-weight:800;color:${accent};line-height:1.2">${esc(value)}</p>`;
    if (label) inner += `<p style="margin:0;font-size:12px;font-weight:600;color:#334155">${esc(label)}</p>`;
    if (note) inner += `<p style="margin:4px 0 0;font-size:11px;color:#94a3b8">${esc(note)}</p>`;
    inner += `</section>`;
  });
  inner += `</section>`;
  return cardFrame(accent, "#fff", inner, false);
}

/** 误区纠正 */
function renderMyth(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const title = body.fields.title || body.label || "误区纠正";
  const myth = body.fields.myth || body.fields.wrong || body.rows[0]?.[0] || "常见误区";
  const truth = body.fields.truth || body.fields.right || body.rows[0]?.[1] || body.rows[1]?.[0] || "正确理解";
  let inner = `<p class="layout-module-title" style="margin:0 0 12px;font-size:15px;font-weight:700;color:${accent}">🧭 ${esc(title)}</p>`;
  inner += `<section style="margin:0 0 10px;padding:12px;border-radius:8px;background:#fef2f2;border-left:3px solid #dc2626">`;
  inner += `<p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#dc2626">✖ 误区</p>`;
  inner += `<p style="margin:0;font-size:14px;color:#7f1d1d;line-height:1.6">${esc(myth)}</p></section>`;
  inner += `<section style="padding:12px;border-radius:8px;background:#f0fdf4;border-left:3px solid #16a34a">`;
  inner += `<p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#16a34a">✔ 正解</p>`;
  inner += `<p style="margin:0;font-size:14px;color:#14532d;line-height:1.6">${esc(truth)}</p></section>`;
  return cardFrame(accent, "#fff", inner, false);
}

/** 作者说 / 编后语 */
function renderAuthorNote(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const title = body.fields.title || body.label || "作者说";
  const author = body.fields.author || "作者";
  const content = moduleText(body);
  let inner = `<p style="margin:0 0 8px;font-size:12px;font-weight:700;color:${accent}">✍️ ${esc(title)}</p>`;
  if (content) {
    inner += `<p style="margin:0;font-size:14px;color:#475569;line-height:1.75;font-style:italic;white-space:pre-wrap">${esc(content)}</p>`;
  }
  inner += `<p style="margin:12px 0 0;font-size:12px;color:#94a3b8;text-align:right">— ${esc(author)}</p>`;
  return (
    `<section class="layout-module" style="margin:16px 0;padding:16px;border-radius:10px;` +
    `border:1px dashed color-mix(in srgb, ${accent} 40%, #cbd5e1);background:#fafafa">${inner}</section>`
  );
}

/** 互动提问 */
function renderEngage(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const title = body.fields.title || body.label || "聊聊你的看法";
  const question = body.fields.question || body.rows[0]?.[0] || moduleText(body) || "你怎么看这个问题？";
  const hint = body.fields.hint || body.rows[0]?.[1] || "欢迎在评论区留言";
  let inner = `<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${accent}">💬 ${esc(title)}</p>`;
  inner += `<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#0f172a;line-height:1.65">${esc(question)}</p>`;
  inner += `<p style="margin:0;font-size:12px;color:#64748b">${esc(hint)}</p>`;
  return cardFrame(accent, `color-mix(in srgb, ${accent} 7%, #fff)`, inner, false);
}

/** 金句 */
function renderGolden(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const content = moduleText(body) || body.fields.quote || "在此写下一句金句";
  const source = body.fields.source || body.fields.author || "";
  let inner = `<p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;line-height:1.55;text-align:center">「${esc(content)}」</p>`;
  if (source) {
    inner += `<p style="margin:12px 0 0;font-size:12px;color:#94a3b8;text-align:center">— ${esc(source)}</p>`;
  }
  return (
    `<section class="layout-module" style="margin:20px 0;padding:22px 18px;border-radius:12px;text-align:center;` +
    `background:color-mix(in srgb, ${accent} 8%, #fff);` +
    `border-top:3px solid ${accent};border-bottom:3px solid ${accent}">${inner}</section>`
  );
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

function renderAiPrivate(_body: ModuleBody, themeId: WechatThemeId): string {
  const accent = getThemeAccent(themeId);
  const bg = `color-mix(in srgb, ${accent} 6%, #f8fafc)`;
  return (
    `<section class="layout-module preview-ai-private-card" style="margin:16px 0;padding:12px 14px;` +
    `border:1px dashed color-mix(in srgb, ${accent} 35%, #cbd5e1);border-radius:8px;` +
    `background:${bg};font-size:13px;color:#64748b;text-align:center">` +
    `${esc(AI_PRIVATE_PREVIEW_LABEL)}</section>`
  );
}

const RENDERERS: Record<string, (body: ModuleBody, themeId: WechatThemeId) => string> = {
  "ai-private": renderAiPrivate,
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
  /* 自媒体 / 写作 */
  lead: renderLead,
  hook: renderLead,
  opening: renderLead,
  summary: renderSummary,
  "key-points": renderSummary,
  keypoints: renderSummary,
  faq: renderFaq,
  qa: renderFaq,
  cta: renderCta,
  checklist: renderChecklist,
  todo: renderChecklist,
  stats: renderStats,
  metric: renderStats,
  metrics: renderStats,
  myth: renderMyth,
  "author-note": renderAuthorNote,
  author: renderAuthorNote,
  engage: renderEngage,
  interact: renderEngage,
  golden: renderGolden,
  "golden-line": renderGolden,
  support: (_b, _t) => renderSupportPlugin(_b),
  "support-plugin": (_b, _t) => renderSupportPlugin(_b),
  share: (_b, _t) => renderSupportPlugin(_b),
  "share-plugin": (_b, _t) => renderSupportPlugin(_b),
};

type RendererFn = LayoutModuleRenderer;

const ALL_RENDERERS: Record<string, RendererFn> = {
  ...(RENDERERS as Record<string, RendererFn>),
  ...ADVANCED_RENDERERS,
  ...CHART_RENDERERS,
  ...PRACTICAL_RENDERERS,
};

export function renderLayoutModule(
  name: string,
  label: string | undefined,
  body: ModuleBody,
  themeId: WechatThemeId,
  ctx?: ModuleRenderContext,
): string {
  if (label && !body.label) body.label = label;
  const key = name.toLowerCase();
  const fn = ALL_RENDERERS[key];
  if (fn) return fn(body, themeId, ctx);
  return renderFallback(name, body, themeId);
}

/** 已注册的模块名（测试 / 调试用） */
export function listRegisteredLayoutModules(): string[] {
  return Object.keys(ALL_RENDERERS).sort();
}
