/**
 * 墨韵简排高级 ::: 模块渲染器（自 md-wechat-editor 算法迁移，自研实现）
 */
import { getThemeAccent, type WechatThemeId } from "./themes";
import type { ModuleBody, ModuleRenderContext } from "./layoutModuleTypes";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function accentOf(themeId: WechatThemeId): string {
  return getThemeAccent(themeId);
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

function eyebrow(text: string, accent: string): string {
  return `<p style="margin:0 0 8px;font-size:10px;font-weight:800;color:${accent};letter-spacing:2px;text-transform:uppercase">${esc(text)}</p>`;
}

function hTitle(text: string, size = "18px"): string {
  return `<p style="margin:0 0 8px;font-size:${size};font-weight:800;color:#0f172a;line-height:1.35">${esc(text)}</p>`;
}

function bodyText(text: string): string {
  return `<p style="margin:0;font-size:14px;color:#475569;line-height:1.7;white-space:pre-wrap">${esc(text)}</p>`;
}

function splitTags(raw: string): string[] {
  return raw
    .split(/[|,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function chipRow(tags: string[], accent: string): string {
  if (!tags.length) return "";
  let html = `<section style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">`;
  for (const t of tags) {
    html += `<span style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;background:color-mix(in srgb, ${accent} 12%, #fff);color:${accent};border:1px solid color-mix(in srgb, ${accent} 30%, #e2e8f0)">${esc(t)}</span>`;
  }
  html += `</section>`;
  return html;
}

function moduleProse(body: ModuleBody): string {
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

function parseJsonContent(body: ModuleBody): unknown {
  const raw = body.fields.json || body.rawBody.trim();
  if (!raw.startsWith("[") && !raw.startsWith("{")) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function countArticleChars(raw: string): { chars: number; minutes: number } {
  const text = raw
    .replace(/:::hero[\s\S]*?:::\s*/gi, "")
    .replace(/:::title-da01[\s\S]*?:::\s*/gi, "")
    .replace(/[#*`>[\]!|_~=-]/g, "")
    .replace(/\s+/g, "");
  const chars = text.length;
  return { chars, minutes: Math.max(1, Math.ceil(chars / 400)) };
}

function renderChipsHash(raw: string): string {
  return splitTags(raw)
    .map(
      (c) =>
        `<span style="display:inline-block;margin:0 8px 0 0;font-size:10px;color:#576B95;font-weight:700">#${esc(c)}</span>`,
    )
    .join("");
}

/** 封面 Hero（Title_DA02 风格） */
export function renderHero(body: ModuleBody, themeId: WechatThemeId, ctx?: ModuleRenderContext): string {
  const accent = accentOf(themeId);
  const title = body.fields.title || body.fields.heading || body.label || "标题";
  const badge = body.fields.eyebrow || body.fields.badge || "";
  const subtitle = body.fields.subtitle || "";
  const chips = body.fields.chips || "";
  const { chars, minutes } = countArticleChars(ctx?.fullMarkdown || "");

  let badgeRow = "";
  if (badge) {
    badgeRow += `<span style="font-size:10px;color:${accent};letter-spacing:2.4px;text-transform:uppercase;font-weight:800">${esc(badge)}</span>`;
  }
  badgeRow += `<span style="margin-left:12px;font-size:10px;color:#94a3b8;font-weight:700">预计阅读 <span style="font-size:12px;font-weight:900;color:${accent}">${minutes}</span> 分钟 · 共 ${chars} 字</span>`;

  let inner = `<section style="margin:0 0 10px;white-space:nowrap">${badgeRow}</section>`;
  inner += `<p style="margin:0;font-size:28px;font-weight:900;color:#0f172a;line-height:1.2;letter-spacing:-0.5px;word-break:break-all">${esc(title)}</p>`;
  if (subtitle) {
    inner += `<p style="margin:10px 0 0;font-size:14px;color:#475569;line-height:1.7">${esc(subtitle)}</p>`;
  }
  if (chips) {
    inner += `<section style="margin:10px 0 0;font-size:0;line-height:1.8">${renderChipsHash(chips)}</section>`;
  }

  return (
    `<section class="layout-module" style="margin:0 0 30px;border-radius:14px;border:1px solid rgba(229,231,235,0.9);` +
    `overflow:hidden;background:linear-gradient(135deg,#f8fafc 0%,#eef4fb 100%);` +
    `box-shadow:rgba(15,23,42,0.05) 0 10px 24px"><section style="padding:20px;background:rgba(255,255,255,0.92)">${inner}</section></section>`
  );
}

export function renderTitleDa01(body: ModuleBody, themeId: WechatThemeId, ctx?: ModuleRenderContext): string {
  const accent = accentOf(themeId);
  // 与墨韵 Title_DA01 一致：优先 title 字段，其次正文行
  const title =
    body.fields.title ||
    body.fields.heading ||
    body.rawBody
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^[\w.-]+:\s*.+$/.test(l))
      .join("\n")
      .trim() ||
    "标题";
  const badge = body.fields.badge || body.fields.eyebrow || "";
  const subtitle = body.fields.subtitle || "";
  const chips = body.fields.chips || "";
  const color = body.fields.color || accent;
  const { chars, minutes } = countArticleChars(ctx?.fullMarkdown || "");

  const badgeHtml = badge
    ? `<p style="margin:0;padding:0 0 10px;font-size:10px;color:${color};letter-spacing:2.4px;text-transform:uppercase;font-weight:800">${esc(badge)}</p>`
    : "";
  const titleHtml = `<p style="margin:0;font-size:28px;font-weight:900;color:rgb(17,24,39);line-height:1.2;letter-spacing:-0.5px;word-break:break-all">${esc(title)}</p>`;
  const subtitleHtml = subtitle
    ? `<p style="margin:0;padding:10px 0 0;font-size:14px;color:rgb(71,85,105);line-height:1.7;font-weight:400">${esc(subtitle)}</p>`
    : "";
  const chipsHtml = chips
    ? `<section style="margin:0;padding:10px 0 0;font-size:0;line-height:1.8">${renderChipsHash(chips)}</section>`
    : "";

  // 微信兼容：固定右栏 90px 的双列表格（对齐墨韵 Title_DA01）
  return (
    `<section class="layout-module" style="margin:0 0 30px;box-shadow:rgba(15,23,42,0.05) 0 10px 24px;` +
    `border-radius:14px;border:1px solid rgba(229,231,235,0.9);overflow:hidden;` +
    `background:linear-gradient(135deg,rgb(248,250,252) 0%,rgb(238,244,251) 100%)">` +
    `<section style="padding:20px;background:rgba(255,255,255,0.92)">` +
    `<table style="border:0;border-collapse:collapse;table-layout:fixed;width:100%;margin:0">` +
    `<colgroup><col /><col style="width:90px" /></colgroup>` +
    `<tbody><tr>` +
    `<td valign="top" align="left" style="vertical-align:top;border:0;padding:0;padding-right:12px;text-align:left">` +
    `${badgeHtml}${titleHtml}${subtitleHtml}${chipsHtml}` +
    `</td>` +
    `<td width="90" valign="top" align="right" style="vertical-align:top;border:0;padding:0;text-align:right;width:90px">` +
    `<p style="margin:0 0 8px;font-size:10px;line-height:1.2;color:rgb(148,163,184);font-weight:800;letter-spacing:0.4px">预计阅读(分)</p>` +
    `<section style="display:inline-block;width:64px;height:64px;line-height:64px;text-align:center;border-radius:10px;` +
    `background-color:${color};box-shadow:rgba(15,23,42,0.16) 0 12px 24px">` +
    `<span style="font-size:30px;line-height:64px;color:#fff;font-weight:900;letter-spacing:-1px">${minutes}</span>` +
    `</section>` +
    `<p style="margin:8px 0 0;font-size:10px;color:rgb(148,163,184);font-weight:700;letter-spacing:0.3px">共 ${chars} 字</p>` +
    `</td></tr></tbody></table></section></section>`
  );
}

export function renderCards(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = body.label ? hTitle(body.label, "16px") : "";
  inner += `<section style="display:flex;flex-direction:column;gap:10px">`;
  for (const row of body.rows) {
    const [label, title, desc] = row;
    if (!title && !label) continue;
    const t = title || label;
    const l = title ? label : "";
    const d = title ? desc : row[1];
    inner += `<section style="padding:14px 16px;border-radius:12px;border:1px solid #e5e7eb;background:#fff">`;
    if (l) inner += `<p style="margin:0 0 6px;font-size:10px;font-weight:800;color:${accent};letter-spacing:1.8px">${esc(l)}</p>`;
    inner += `<p style="margin:0 0 4px;font-size:16px;font-weight:800;color:#0f172a">${esc(t || "")}</p>`;
    if (d) inner += bodyText(d);
    inner += `</section>`;
  }
  inner += `</section>`;
  return cardFrame(accent, `color-mix(in srgb, ${accent} 5%, #fff)`, inner, false);
}

export function renderLabelTitle(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = "";
  if (body.fields.eyebrow || body.fields.label) {
    inner += eyebrow(body.fields.eyebrow || body.fields.label || "", accent);
  }
  if (body.fields.title) inner += hTitle(body.fields.title, "20px");
  if (body.fields.subtitle) inner += bodyText(body.fields.subtitle);
  return `<section class="layout-module" style="margin:20px 0">${inner}</section>`;
}

export function renderPart(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = `<section style="text-align:center;padding:8px 0">`;
  inner += eyebrow(body.fields.label || body.fields.part || body.fields.num || "PART", accent);
  if (body.fields.title) {
    inner += `<p style="margin:0;font-size:22px;font-weight:900;color:#0f172a">${esc(body.fields.title)}</p>`;
  }
  if (body.fields.subtitle) {
    inner += `<p style="margin:8px 0 0;font-size:13px;color:#64748b">${esc(body.fields.subtitle)}</p>`;
  }
  inner += `<section style="margin-top:14px;height:1px;background:linear-gradient(90deg,transparent,${accent},transparent)"></section></section>`;
  return inner;
}

export function renderToc(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = eyebrow(body.label || body.fields.title || "阅读导航", accent);
  inner += `<section style="display:flex;flex-direction:column;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">`;
  body.rows.forEach((row, idx) => {
    const [a, b, c] = row;
    // 支持「标题 | 说明」或「编号 | 标题 | 说明」
    let num = "";
    let title = "";
    let desc = "";
    if (c !== undefined) {
      num = a || "";
      title = b || "";
      desc = c || "";
    } else {
      title = a || "";
      desc = b || "";
      num = String(idx + 1).padStart(2, "0");
    }
    if (!title) return;
    inner += `<section style="display:flex;gap:12px;padding:12px 14px;background:${idx % 2 ? "#f8fafc" : "#fff"};border-top:${idx ? "1px solid #f1f5f9" : "none"}">`;
    inner += `<span style="flex-shrink:0;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:${accent};color:#fff;font-size:11px;font-weight:900">${esc(num)}</span>`;
    inner += `<section style="flex:1"><p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#0f172a">${esc(title)}</p>`;
    if (desc) inner += `<p style="margin:0;font-size:12px;color:#64748b">${esc(desc)}</p>`;
    inner += `</section></section>`;
  });
  inner += `</section>`;
  return `<section class="layout-module" style="margin:16px 0">${inner}</section>`;
}

function renderVerdictFamily(name: string, body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const defaultEyebrow =
    name === "verdict" ? "最终判断" : name === "manifesto" ? "宣言" : "过渡";
  let inner = eyebrow(body.fields.eyebrow || body.label || defaultEyebrow, accent);
  if (body.fields.title) {
    inner += hTitle(body.fields.title, name === "manifesto" ? "20px" : "18px");
  }
  const content = body.fields.body || body.fields.text || body.fields.content || moduleProse(body);
  if (content) inner += bodyText(content);
  if (body.fields.note || body.fields.meta) {
    inner += `<p style="margin:12px 0 0;font-size:11px;color:#94a3b8">${esc([body.fields.note, body.fields.meta].filter(Boolean).join(" · "))}</p>`;
  }
  const strong = name === "verdict" || name === "manifesto";
  return cardFrame(accent, strong ? `color-mix(in srgb, ${accent} 8%, #fff)` : "#fff", inner, strong);
}

export function renderAudienceFit(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = "";
  if (body.fields.title) inner += hTitle(body.fields.title);
  if (body.fields.subtitle) inner += bodyText(body.fields.subtitle);
  if (body.fields.fit) {
    inner += `<p style="margin:14px 0 6px;font-size:12px;font-weight:700;color:#059669">适合</p>`;
    inner += chipRow(splitTags(body.fields.fit), "#059669");
  }
  if (body.fields.avoid) {
    inner += `<p style="margin:14px 0 6px;font-size:12px;font-weight:700;color:#b91c1c">不适合</p>`;
    inner += chipRow(splitTags(body.fields.avoid), "#b91c1c");
  }
  if (body.fields.note) {
    inner += `<p style="margin:12px 0 0;font-size:12px;color:#94a3b8">${esc(body.fields.note)}</p>`;
  }
  return cardFrame(accent, "#fff", inner, false);
}

export function renderInfographic(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const type = (body.fields.type || "statement").toLowerCase();
  let inner = "";
  if (body.fields.eyebrow) inner += eyebrow(body.fields.eyebrow, accent);
  if (body.fields.title) {
    inner += `<p style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0f172a;text-align:center">${esc(body.fields.title)}</p>`;
  }
  if (body.fields.subtitle) {
    inner += `<p style="margin:0 0 14px;font-size:13px;color:#64748b;text-align:center">${esc(body.fields.subtitle)}</p>`;
  }
  if (type === "data" && body.fields.value) {
    inner += `<section style="text-align:center;padding:16px 0">`;
    if (body.fields.label) {
      inner += `<p style="margin:0 0 4px;font-size:12px;color:#64748b">${esc(body.fields.label)}</p>`;
    }
    inner += `<p style="margin:0;font-size:40px;font-weight:900;color:${accent}">${esc(body.fields.value)}</p></section>`;
  } else if (type === "flow" && body.fields.flow) {
    const steps = splitTags(body.fields.flow);
    inner += `<section style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;align-items:center">`;
    steps.forEach((step, i) => {
      inner += `<span style="padding:8px 12px;border-radius:999px;background:color-mix(in srgb, ${accent} 12%, #fff);color:${accent};font-size:12px;font-weight:700">${esc(step)}</span>`;
      if (i < steps.length - 1) inner += `<span style="color:#cbd5e1">→</span>`;
    });
    inner += `</section>`;
  } else if (type === "contrast" && body.fields.left && body.fields.right) {
    for (const [tag, text, bg, border] of [
      ["左", body.fields.left, "#fef2f2", "#ef4444"],
      ["右", body.fields.right, "#ecfdf5", "#10b981"],
    ] as const) {
      inner += `<section style="margin:0 0 8px;padding:12px;border-radius:10px;background:${bg};border-left:3px solid ${border}">`;
      inner += `<p style="margin:0 0 4px;font-size:10px;font-weight:800;color:${border}">${tag}</p>`;
      inner += `<p style="margin:0;font-size:14px;color:#334155">${esc(text)}</p></section>`;
    }
  } else if (body.fields.quote || body.fields.body) {
    inner += `<blockquote style="margin:12px 0 0;padding:12px 16px;border-left:3px solid ${accent};background:#f8fafc;font-style:italic">${esc(body.fields.quote || body.fields.body || "")}</blockquote>`;
  }
  if (body.fields.note) {
    inner += `<p style="margin:12px 0 0;font-size:11px;color:#94a3b8;text-align:center">${esc(body.fields.note)}</p>`;
  }
  return cardFrame(accent, "#fff", inner, false);
}

export function renderImageText(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const imageRight = body.fields.layout === "right";
  const img = body.fields.image
    ? `<img src="${esc(body.fields.image)}" alt="${esc(body.fields.alt || "")}" style="display:block;width:100%;border-radius:10px" />`
    : "";
  let text = "";
  if (body.fields.eyebrow) text += eyebrow(body.fields.eyebrow, accent);
  if (body.fields.title) text += hTitle(body.fields.title, "16px");
  if (body.fields.body) text += bodyText(body.fields.body);
  const stacked = imageRight ? `${text}${img}` : `${img}${text}`;
  return cardFrame(accent, "#fff", `<section style="display:flex;flex-direction:column;gap:14px">${stacked}</section>`, false);
}

export function renderImageCompare(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = body.fields.title ? hTitle(body.fields.title, "16px") : "";
  for (const [tag, url] of [
    ["前", body.fields.before || body.fields.left],
    ["后", body.fields.after || body.fields.right],
  ] as const) {
    if (!url) continue;
    inner += `<section style="margin:0 0 10px"><p style="margin:0 0 6px;font-size:11px;font-weight:800;color:${accent}">${tag}</p>`;
    inner += `<img src="${esc(url)}" style="width:100%;border-radius:10px" alt="" /></section>`;
  }
  return cardFrame(accent, "#fff", inner, false);
}

export function renderImageSteps(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = body.label ? hTitle(body.label, "16px") : "";
  body.rows.forEach((row, idx) => {
    const [step, url, caption] = row;
    inner += `<section style="margin:0 0 14px"><p style="margin:0 0 8px;font-size:13px;font-weight:800;color:${accent}">步骤 ${idx + 1}${step ? ` · ${esc(step)}` : ""}</p>`;
    if (url?.startsWith("http")) {
      inner += `<img src="${esc(url)}" style="width:100%;border-radius:10px" alt="" />`;
    }
    if (caption) inner += `<p style="margin:6px 0 0;font-size:12px;color:#64748b">${esc(caption)}</p>`;
    inner += `</section>`;
  });
  return cardFrame(accent, "#fff", inner, false);
}

export function renderImageAnnotate(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = body.fields.title ? hTitle(body.fields.title, "16px") : "";
  if (body.fields.image) {
    inner += `<section style="position:relative"><img src="${esc(body.fields.image)}" style="width:100%;border-radius:10px" alt="" />`;
    if (body.fields.points) {
      splitTags(body.fields.points).forEach((point, i) => {
        inner += `<span style="position:absolute;left:12px;top:${20 + i * 18}%;padding:4px 8px;border-radius:6px;background:${accent};color:#fff;font-size:11px;font-weight:700">${esc(point)}</span>`;
      });
    }
    inner += `</section>`;
  }
  if (body.fields.body) inner += bodyText(body.fields.body);
  return cardFrame(accent, "#fff", inner, false);
}

export function renderPricing(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = body.label ? hTitle(body.label, "16px") : "";
  inner += `<section style="display:flex;flex-direction:column;gap:12px">`;
  for (const row of body.rows) {
    const [plan, price, featuresRaw] = row;
    if (!plan) continue;
    const features = featuresRaw ? splitTags(featuresRaw) : [];
    inner += `<section style="padding:16px;border-radius:14px;border:2px solid #e5e7eb;background:#fff">`;
    inner += `<section style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:10px">`;
    inner += `<p style="margin:0;font-size:16px;font-weight:800">${esc(plan)}</p>`;
    if (price) inner += `<p style="margin:0;font-size:22px;font-weight:900;color:${accent}">${esc(price)}</p>`;
    inner += `</section>`;
    if (features.length) {
      inner += `<ul style="margin:0;padding:0;list-style:none">`;
      for (const f of features) {
        inner += `<li style="margin:0 0 6px;padding-left:16px;position:relative;font-size:13px;color:#475569"><span style="position:absolute;left:0;color:${accent}">•</span>${esc(f)}</li>`;
      }
      inner += `</ul>`;
    }
    inner += `</section>`;
  }
  inner += `</section>`;
  return cardFrame(accent, `color-mix(in srgb, ${accent} 5%, #fff)`, inner, false);
}

export function renderCases(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = body.label ? hTitle(body.label, "16px") : "";
  for (const row of body.rows) {
    const [title, result, detail] = row;
    if (!title) continue;
    inner += `<section style="margin:0 0 10px;padding:14px;border-radius:12px;border:1px solid #e5e7eb;background:#fff">`;
    inner += `<p style="margin:0 0 4px;font-size:15px;font-weight:800">${esc(title)}</p>`;
    if (result) inner += `<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${accent}">${esc(result)}</p>`;
    if (detail) inner += `<p style="margin:0;font-size:13px;color:#64748b">${esc(detail)}</p>`;
    inner += `</section>`;
  }
  return cardFrame(accent, "#fff", inner, false);
}

export function renderNotice(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = body.fields.title || body.label || "公告";
  const content = body.fields.body || body.fields.text || moduleProse(body);
  let inner = `<section style="display:flex;gap:10px"><span style="padding:4px 8px;border-radius:6px;background:#fef3c7;color:#b45309;font-size:11px;font-weight:800">!</span><section>`;
  inner += `<p style="margin:0 0 6px;font-size:14px;font-weight:800">${esc(title)}</p>`;
  if (content) inner += bodyText(content);
  inner += `</section></section>`;
  return cardFrame(accent, "#fffbeb", inner, false);
}

export function renderSpecs(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let rows = "";
  body.rows.forEach((row, idx) => {
    const [key, val] = row;
    if (!key) return;
    rows += `<section style="display:flex;padding:10px 12px;background:${idx % 2 ? "#f8fafc" : "#fff"};border-top:${idx ? "1px solid #f1f5f9" : "none"}">`;
    rows += `<span style="width:38%;font-size:13px;color:#64748b;font-weight:600">${esc(key)}</span>`;
    rows += `<span style="flex:1;font-size:13px">${esc(val || "")}</span></section>`;
  });
  const title = body.label ? hTitle(body.label, "16px") : "";
  return cardFrame(
    accent,
    "#fff",
    `${title}<section style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">${rows}</section>`,
    false,
  );
}

export function renderToolbox(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = body.label ? hTitle(body.label, "16px") : "";
  for (const row of body.rows) {
    const [category, name, desc] = row;
    inner += `<section style="margin:0 0 10px;padding:12px;border-radius:10px;background:#fff;border:1px solid #e5e7eb">`;
    if (category) inner += `<p style="margin:0 0 4px;font-size:10px;font-weight:800;color:${accent}">${esc(category)}</p>`;
    if (name) inner += `<p style="margin:0 0 4px;font-size:14px;font-weight:700">${esc(name)}</p>`;
    if (desc) inner += `<p style="margin:0;font-size:13px;color:#64748b">${esc(desc)}</p>`;
    inner += `</section>`;
  }
  return cardFrame(accent, `color-mix(in srgb, ${accent} 5%, #fff)`, inner, false);
}

export function renderLogos(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = body.label ? hTitle(body.label, "16px") : "";
  inner += `<section style="display:flex;flex-wrap:wrap;gap:10px">`;
  for (const row of body.rows) {
    if (!row[0]) continue;
    inner += `<span style="padding:10px 14px;border-radius:10px;background:#fff;border:1px solid #e5e7eb;font-size:13px;font-weight:700;color:#475569">${esc(row[0])}</span>`;
  }
  inner += `</section>`;
  return cardFrame(accent, "#f8fafc", inner, false);
}

export function renderAuthorCard(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const name = body.fields.name || body.label || "作者";
  let inner = `<section style="display:flex;gap:14px">`;
  if (body.fields.avatar) {
    inner += `<img src="${esc(body.fields.avatar)}" alt="" style="width:56px;height:56px;border-radius:14px;object-fit:cover" />`;
  } else {
    inner += `<span style="width:56px;height:56px;border-radius:14px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900">${esc(name.slice(0, 1))}</span>`;
  }
  inner += `<section style="flex:1">`;
  inner += `<p style="margin:0 0 2px;font-size:16px;font-weight:800">${esc(name)}</p>`;
  if (body.fields.role) {
    inner += `<p style="margin:0 0 8px;font-size:12px;color:${accent};font-weight:600">${esc(body.fields.role)}</p>`;
  }
  if (body.fields.bio) inner += bodyText(body.fields.bio);
  if (body.fields.tags) inner += chipRow(splitTags(body.fields.tags).slice(0, 4), accent);
  inner += `</section></section>`;
  if (body.fields.note) {
    inner += `<p style="margin:12px 0 0;font-size:13px;color:#475569">${esc(body.fields.note)}</p>`;
  }
  if (body.fields.link) {
    inner += `<p style="margin:6px 0 0;font-size:12px;color:${accent};font-weight:600">${esc(body.fields.link)}</p>`;
  }
  return cardFrame(accent, "#fff", inner, false);
}

export function renderPeople(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = body.label ? hTitle(body.label, "16px") : "";
  for (const row of body.rows) {
    const [name, role, desc] = row;
    if (!name) continue;
    inner += `<section style="display:flex;gap:12px;margin:0 0 12px;padding:12px;border-radius:12px;background:#fff;border:1px solid #e5e7eb">`;
    inner += `<span style="width:40px;height:40px;border-radius:999px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">${esc(name.slice(0, 1))}</span>`;
    inner += `<section><p style="margin:0;font-size:14px;font-weight:800">${esc(name)}</p>`;
    if (role) inner += `<p style="margin:2px 0 0;font-size:12px;color:${accent}">${esc(role)}</p>`;
    if (desc) inner += `<p style="margin:6px 0 0;font-size:13px;color:#64748b">${esc(desc)}</p>`;
    inner += `</section></section>`;
  }
  return cardFrame(accent, `color-mix(in srgb, ${accent} 5%, #fff)`, inner, false);
}

export function renderSeries(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = eyebrow(body.fields.label || "系列专栏", accent);
  if (body.fields.title) inner += hTitle(body.fields.title);
  const content = body.fields.body || body.fields.description || moduleProse(body);
  if (content) inner += bodyText(content);
  if (body.fields.link) {
    inner += `<p style="margin:10px 0 0;font-size:13px;font-weight:700;color:${accent}">${esc(body.fields.link)} →</p>`;
  }
  return cardFrame(accent, `color-mix(in srgb, ${accent} 8%, #fff)`, inner);
}

export function renderSubscribe(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = body.fields.title || body.fields.cta || "";
  let inner = body.fields.label ? eyebrow(body.fields.label, accent) : "";
  if (title) inner += hTitle(title, "17px");
  if (body.fields.subtitle || body.fields.description) {
    inner += bodyText(body.fields.subtitle || body.fields.description || "");
  }
  inner += `<section style="display:flex;flex-wrap:wrap;gap:10px;margin-top:16px">`;
  inner += `<span style="flex:1;min-width:120px;text-align:center;padding:11px 16px;border-radius:10px;background:${accent};color:#fff;font-size:13px;font-weight:700">${esc(body.fields.primary || "继续关注")}</span>`;
  inner += `<span style="flex:1;min-width:120px;text-align:center;padding:11px 16px;border-radius:10px;background:#fff;color:${accent};border:1px solid ${accent};font-size:13px;font-weight:700">${esc(body.fields.secondary || "收藏这篇")}</span>`;
  inner += `</section>`;
  if (body.fields.note) {
    inner += `<p style="margin:12px 0 0;font-size:11px;color:#94a3b8;text-align:center">${esc(body.fields.note)}</p>`;
  }
  return cardFrame(accent, `color-mix(in srgb, ${accent} 8%, #fff)`, inner);
}

export function renderDefinition(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const data = parseJsonContent(body) as { term?: string; def?: string; termLabel?: string } | null;
  const term = data?.term || body.fields.term;
  const def = data?.def || body.fields.def || body.fields.definition || moduleProse(body);
  let inner = eyebrow(data?.termLabel || body.fields.termLabel || "术语", accent);
  if (term) inner += `<p style="margin:0 0 8px;font-size:22px;font-weight:900">${esc(term)}</p>`;
  if (def) inner += bodyText(def);
  return cardFrame(accent, "#fff", inner, false);
}

export function renderQuestion(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const data = parseJsonContent(body);
  const items: { q?: string; a?: string }[] = Array.isArray(data) ? data : [];
  if (items.length) {
    let inner = "";
    for (const item of items) {
      if (!item.q) continue;
      inner += `<section style="margin:0 0 10px;padding:12px;border-radius:10px;border:1px solid #e5e7eb">`;
      inner += `<p style="margin:0 0 6px;font-size:14px;font-weight:700">${esc(item.q)}</p>`;
      if (item.a) inner += bodyText(item.a);
      inner += `</section>`;
    }
    return cardFrame(accent, "#fff", inner, false);
  }
  const q = body.fields.question || body.fields.q || moduleProse(body);
  const a = body.fields.answer || body.fields.a || "";
  let inner = eyebrow(body.label || "互动提问", accent);
  if (q) inner += `<p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#0f172a">${esc(q)}</p>`;
  if (a) inner += bodyText(a);
  return cardFrame(accent, `color-mix(in srgb, ${accent} 7%, #fff)`, inner, false);
}

export function renderChangelog(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = body.label ? hTitle(body.label, "16px") : "";
  for (const row of body.rows) {
    const [date, version, changes] = row;
    inner += `<section style="margin:0 0 10px;padding:12px;border-left:3px solid ${accent};background:#f8fafc">`;
    inner += `<p style="margin:0 0 4px;font-size:12px;color:#64748b">${esc([date, version].filter(Boolean).join(" · "))}</p>`;
    if (changes) inner += `<p style="margin:0;font-size:14px">${esc(changes)}</p>`;
    inner += `</section>`;
  }
  return cardFrame(accent, "#fff", inner, false);
}

export function renderComparisonTable(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  if (!body.rows.length) return cardFrame(accent, "#fff", "", false);
  const [header, ...rows] = body.rows;
  let inner = body.label ? hTitle(body.label, "16px") : "";
  inner += `<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>`;
  header?.forEach((h) => {
    inner += `<th style="padding:10px;background:${accent};color:#fff;border:1px solid ${accent}">${esc(h)}</th>`;
  });
  inner += `</tr></thead><tbody>`;
  rows.forEach((row, idx) => {
    inner += `<tr style="background:${idx % 2 ? "#f8fafc" : "#fff"}">`;
    row.forEach((cell) => {
      inner += `<td style="padding:10px;border:1px solid #e5e7eb">${esc(cell)}</td>`;
    });
    inner += `</tr>`;
  });
  inner += `</tbody></table>`;
  return cardFrame(accent, "#fff", inner, false);
}

export function renderResourceList(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const items =
    (parseJsonContent(body) as { name?: string; url?: string; desc?: string; icon?: string }[] | null) ||
    [];
  let inner = "";
  if (items.length) {
    for (const item of items) {
      if (!item.name) continue;
      inner += `<section style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9">`;
      inner += `<span style="width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:color-mix(in srgb, ${accent} 12%, #fff)">${esc(item.icon || item.name.slice(0, 1))}</span>`;
      inner += `<section><p style="margin:0;font-size:14px;font-weight:700;color:${item.url?.startsWith("http") ? accent : "#0f172a"}">${esc(item.name)}</p>`;
      if (item.desc) inner += `<p style="margin:4px 0 0;font-size:12px;color:#64748b">${esc(item.desc)}</p>`;
      inner += `</section></section>`;
    }
  } else {
    for (const row of body.rows) {
      const [name, desc, url] = row;
      if (!name) continue;
      inner += `<section style="padding:10px 0;border-bottom:1px solid #f1f5f9">`;
      inner += `<p style="margin:0;font-size:14px;font-weight:700;color:${url?.startsWith("http") ? accent : "#0f172a"}">${esc(name)}</p>`;
      if (desc) inner += `<p style="margin:4px 0 0;font-size:12px;color:#64748b">${esc(desc)}</p>`;
      inner += `</section>`;
    }
  }
  return cardFrame(accent, "#fff", inner || bodyText("资源列表"), false);
}

export function renderStatRow(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const items =
    (parseJsonContent(body) as { label?: string; value?: string; unit?: string }[] | null) || [];
  let inner = `<section style="display:flex;flex-wrap:wrap;gap:10px">`;
  if (items.length) {
    for (const item of items) {
      inner += `<section style="flex:1;min-width:100px;padding:14px;border-radius:12px;background:#fff;border:1px solid #e5e7eb;text-align:center">`;
      if (item.value) {
        inner += `<p style="margin:0;font-size:24px;font-weight:900;color:${accent}">${esc(item.value)}${item.unit ? `<span style="font-size:12px">${esc(item.unit)}</span>` : ""}</p>`;
      }
      if (item.label) {
        inner += `<p style="margin:6px 0 0;font-size:12px;color:#64748b">${esc(item.label)}</p>`;
      }
      inner += `</section>`;
    }
  } else {
    for (const row of body.rows) {
      const [value, label, unit] = row;
      if (!value) continue;
      inner += `<section style="flex:1;min-width:100px;padding:14px;border-radius:12px;background:#fff;border:1px solid #e5e7eb;text-align:center">`;
      inner += `<p style="margin:0;font-size:24px;font-weight:900;color:${accent}">${esc(value)}${unit ? `<span style="font-size:12px">${esc(unit)}</span>` : ""}</p>`;
      if (label) inner += `<p style="margin:6px 0 0;font-size:12px;color:#64748b">${esc(label)}</p>`;
      inner += `</section>`;
    }
  }
  inner += `</section>`;
  return cardFrame(accent, `color-mix(in srgb, ${accent} 5%, #fff)`, inner, false);
}

export function renderTweet(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const text = body.fields.text || body.fields.body || moduleProse(body);
  const author = body.fields.author || body.label || "作者";
  let inner = `<section style="display:flex;gap:10px"><span style="width:36px;height:36px;border-radius:999px;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">𝕏</span><section>`;
  inner += `<p style="margin:0 0 4px;font-size:13px;font-weight:700">${esc(author)}</p>`;
  if (text) inner += bodyText(text);
  inner += `</section></section>`;
  return cardFrame(accent, "#fff", inner, false);
}

export function renderMythFact(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  let inner = body.label ? hTitle(body.label, "16px") : "";
  for (const row of body.rows) {
    const [myth, fact] = row;
    if (myth) {
      inner += `<section style="margin:0 0 8px;padding:12px;border-radius:10px;background:#fef2f2;border-left:3px solid #ef4444">`;
      inner += `<p style="margin:0 0 4px;font-size:11px;font-weight:800;color:#b91c1c">误区</p><p style="margin:0;font-size:13px;color:#7f1d1d">${esc(myth)}</p></section>`;
    }
    if (fact) {
      inner += `<section style="margin:0 0 12px;padding:12px;border-radius:10px;background:#ecfdf5;border-left:3px solid #10b981">`;
      inner += `<p style="margin:0 0 4px;font-size:11px;font-weight:800;color:#059669">事实</p><p style="margin:0;font-size:13px;color:#064e3b">${esc(fact)}</p></section>`;
    }
  }
  return cardFrame(accent, "#fff", inner, false);
}

export function renderGallery(body: ModuleBody, _themeId: WechatThemeId): string {
  const imgs: { alt: string; src: string }[] = [];
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const source = body.rawBody || body.rows.map((r) => r.join(" ")).join(" ");
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    imgs.push({ alt: m[1], src: m[2] });
  }
  if (!imgs.length) return "";
  let html = `<section class="layout-module" style="white-space:nowrap;overflow-x:auto;margin:12px 0;padding:4px 0">`;
  for (const img of imgs) {
    html += `<img src="${esc(img.src)}" alt="${esc(img.alt)}" style="display:inline-block;vertical-align:top;max-height:200px;border-radius:8px;margin-right:8px" />`;
  }
  html += `</section>`;
  return html;
}

export function renderBadges(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const items = (
    body.fields._body ||
    moduleProse(body) ||
    body.rows.map((r) => r.join("|")).join("|")
  )
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const tone = body.fields.tone || "accent";
  const tones: Record<string, { bg: string; color: string; border: string }> = {
    green: { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7" },
    yellow: { bg: "#fff9c4", color: "#f57f17", border: "#fff176" },
    dark: { bg: "#263238", color: "#eceff1", border: "#455a64" },
    accent: {
      bg: `color-mix(in srgb, ${accent} 12%, #fff)`,
      color: accent,
      border: `color-mix(in srgb, ${accent} 40%, #e2e8f0)`,
    },
  };
  const c = tones[tone] || tones.accent;
  const finalColor = body.fields.color || c.color;
  const finalBg = body.fields.bg || c.bg;
  const finalBorder = body.fields.bg ? body.fields.bg : c.border;

  let html = `<section class="layout-module" style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0;align-items:center">`;
  for (const item of items) {
    html += `<span style="display:inline-flex;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600;background:${finalBg};color:${finalColor};border:1px solid ${finalBorder};line-height:1.6;white-space:nowrap">${esc(item)}</span>`;
  }
  html += `</section>`;
  return html;
}

export function renderStatement(body: ModuleBody, themeId: WechatThemeId): string {
  const color = body.fields.color || "#334155";
  const text = moduleProse(body);
  void themeId;
  return `<section class="layout-module" style="margin:20px 0"><p style="text-align:center;font-size:18px;font-weight:700;color:${esc(color)};line-height:1.6">${esc(text)}</p></section>`;
}

export function renderBreaking(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = body.fields.color || accentOf(themeId);
  const content = moduleProse(body);
  let html = `<section class="layout-module" style="margin:24px 0;padding:28px 24px;background:linear-gradient(135deg,color-mix(in srgb, ${accent} 12%, #fff),rgba(255,255,255,0.8));border:1px solid color-mix(in srgb, ${accent} 25%, #e2e8f0);border-radius:16px">`;
  if (body.fields.badge) {
    html += `<span style="display:inline-block;padding:4px 12px;background:${accent};color:#fff;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:12px">${esc(body.fields.badge)}</span>`;
  }
  if (body.fields.title) {
    html += `<p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a1a1a;line-height:1.4">${esc(body.fields.title)}</p>`;
  }
  if (body.fields.subtitle) {
    html += `<p style="margin:0 0 12px;font-size:14px;color:#666">${esc(body.fields.subtitle)}</p>`;
  }
  if (body.fields.chips) {
    html += `<section style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">`;
    for (const c of splitTags(body.fields.chips)) {
      html += `<span style="padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(255,255,255,0.8);color:${accent};border:1px solid color-mix(in srgb, ${accent} 30%, #e2e8f0)">#${esc(c)}</span>`;
    }
    html += `</section>`;
  }
  if (content) html += `<p style="margin:0;font-size:14px;color:#475569;line-height:1.7;white-space:pre-wrap">${esc(content)}</p>`;
  html += `</section>`;
  return html;
}

export function renderCaseFlow(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = body.fields.color || accentOf(themeId);
  const items: { num: string; text: string }[] = [];
  const lines = body.rawBody.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    const m = line.match(/^-\s*\[案例\s*(\d+)\]\s*(.+)$/);
    if (m) {
      items.push({ num: m[1], text: m[2].trim() });
      continue;
    }
    // 宽松：任意列表行
    const loose = line.match(/^-\s*(.+)$/);
    if (loose) {
      items.push({ num: String(items.length + 1).padStart(2, "0"), text: loose[1].trim() });
    }
  }
  if (!items.length) {
    body.rows.forEach((row, i) => {
      if (row[0]) items.push({ num: String(i + 1).padStart(2, "0"), text: row.join(" · ") });
    });
  }
  if (!items.length) return "";

  let html = `<section class="layout-module" style="margin:20px 0">`;
  for (const item of items) {
    html += `<section style="display:flex;align-items:center;gap:16px;padding:20px;margin-bottom:12px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;background:#fff">`;
    html += `<span style="flex-shrink:0;white-space:nowrap;background:color-mix(in srgb, ${accent} 12%, #fff);color:${accent};font-size:13px;font-weight:600;padding:6px 14px;border-radius:8px">案例 ${esc(item.num)}</span>`;
    html += `<span style="flex:1;font-size:15px;line-height:1.6;color:#333">${esc(item.text)}</span></section>`;
  }
  html += `</section>`;
  return html;
}

export function renderPTitle(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const num = body.fields.num || "";
  const title = body.fields.title || moduleProse(body) || "章节标题";
  const subtitle = body.fields.subtitle || "";
  const level = parseInt(body.fields.level || "1", 10);
  const titleColor = body.fields.color || "#0f172a";
  const numColor = body.fields["num-color"] || accent;
  const subtitleColor = body.fields["subtitle-color"] || accent;
  const prefix = body.fields.prefix || "";
  const suffix = body.fields.suffix || "";
  const titleText = `${prefix ? `${prefix} ` : ""}${title}${suffix ? ` ${suffix}` : ""}`;
  const hasNum = Boolean(num);

  if (level === 1) {
    const chapterLine = hasNum
      ? `<section style="display:flex;align-items:center;margin:0;padding-bottom:12px"><span style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:2.6px">CHAPTER ${esc(num)}</span><section style="flex:1;border-top:1px solid #e5e7eb;margin-left:12px;height:0"></section></section>`
      : "";
    const numBlock = hasNum
      ? `<strong style="display:block;font-size:60px;line-height:1;color:${numColor};letter-spacing:-3px;opacity:0.25">${esc(num)}</strong>`
      : "";
    const titleBlock = hasNum
      ? `<strong style="display:block;font-size:30px;font-weight:900;color:${titleColor};line-height:1.26;margin-top:-60px;margin-left:50px">${esc(titleText)}</strong>`
      : `<strong style="display:block;font-size:30px;font-weight:900;color:${titleColor};line-height:1.26">${esc(titleText)}</strong>`;
    const subtitleHtml = subtitle
      ? `<span style="display:block;margin-left:${hasNum ? "50px" : "0"};font-size:11px;color:${subtitleColor};font-weight:700;letter-spacing:1.6px">${esc(subtitle)}</span>`
      : "";
    return `<section class="layout-module" style="margin:48px 0 30px">${chapterLine}<section>${numBlock}${titleBlock}${subtitleHtml}</section></section>`;
  }

  const size = level === 2 ? "24px" : level === 3 ? "20px" : "16px";
  const margin = level === 2 ? "36px 0 20px" : level === 3 ? "28px 0 16px" : "24px 0 12px";
  if (hasNum) {
    return (
      `<section class="layout-module" style="margin:${margin};overflow:hidden">` +
      `<section style="float:left;font-size:${size};font-weight:900;color:${numColor};line-height:1.4">${esc(num)}</section>` +
      `<section style="margin-left:32px;font-size:${size};font-weight:800;color:${titleColor};line-height:1.4">${esc(titleText)}</section></section>`
    );
  }
  return `<section class="layout-module" style="margin:${margin}"><section style="font-size:${size};font-weight:800;color:${titleColor};line-height:1.4">${esc(titleText)}</section></section>`;
}

export function renderReadingPath(body: ModuleBody, themeId: WechatThemeId, ctx?: ModuleRenderContext): string {
  void body;
  const accent = accentOf(themeId);
  const list = ctx?.pTitles || [];
  if (list.length <= 1) {
    return cardFrame(
      accent,
      `color-mix(in srgb, ${accent} 6%, #fff)`,
      `<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${accent}">阅读路线</p>` +
        `<p style="margin:0;font-size:13px;color:#64748b">请在文中插入至少 2 个 <code>:::p-title</code>（level: 1）章节后，此处会自动生成导航。</p>`,
      false,
    );
  }

  let html = `<section class="layout-module" style="margin:0 0 30px"><section>`;
  html += `<section style="display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:14px;gap:12px"><section style="flex-shrink:0"><p style="margin:0;padding:0 0 6px;font-size:10px;color:#64748b;letter-spacing:2.8px;font-weight:800">READING PATH</p><p style="margin:0;font-size:16px;line-height:1.35;color:#111827;font-weight:800">阅读路线</p></section><p style="margin:0;font-size:10px;color:#94a3b8">${list.length} 个章节</p></section>`;
  html += `<section style="padding:14px 12px 12px;border:1px solid #e5e7eb;border-radius:13px;background:linear-gradient(#fff 0%,#f8fafc 100%);overflow-x:auto;white-space:nowrap;font-size:0">`;
  list.forEach((item, idx) => {
    const label = item.title.replace(/::.*/, "").trim().replace(/^\d+\s*/, "");
    const num = item.num || String(idx + 1).padStart(2, "0");
    const isActive = idx === 0;
    html += `<section style="display:inline-flex;vertical-align:middle;align-items:center">`;
    html += `<section style="display:inline-block;width:126px;white-space:normal;text-align:center">`;
    html += `<section style="display:flex;justify-content:center;margin-bottom:10px">`;
    html += `<span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:${isActive ? accent : "#fff"};color:${isActive ? "#fff" : "#111827"};border:1px solid ${isActive ? accent : "#dbe3ee"};font-size:11px;font-weight:900">${esc(num)}</span>`;
    html += `</section>`;
    html += `<p style="margin:0;font-size:13px;line-height:1.55;color:${isActive ? "#111827" : "#1f2937"};font-weight:800;word-break:break-all">${esc(label)}</p>`;
    html += `</section>`;
    if (idx < list.length - 1) {
      html += `<span style="display:inline-block;width:32px;height:1px;margin:0 8px;background:linear-gradient(90deg,rgba(148,163,184,0.35),rgba(148,163,184,0.85))"></span>`;
    }
    html += `</section>`;
  });
  html += `</section></section></section>`;
  return html;
}

type AdvFn = (body: ModuleBody, themeId: WechatThemeId, ctx?: ModuleRenderContext) => string;

export const ADVANCED_RENDERERS: Record<string, AdvFn> = {
  hero: renderHero,
  "title-da01": renderTitleDa01,
  cards: renderCards,
  "label-title": renderLabelTitle,
  part: renderPart,
  toc: renderToc,
  verdict: (b, t) => renderVerdictFamily("verdict", b, t),
  manifesto: (b, t) => renderVerdictFamily("manifesto", b, t),
  bridge: (b, t) => renderVerdictFamily("bridge", b, t),
  "audience-fit": renderAudienceFit,
  infographic: renderInfographic,
  "image-text": renderImageText,
  "image-compare": renderImageCompare,
  "image-steps": renderImageSteps,
  "image-annotate": renderImageAnnotate,
  pricing: renderPricing,
  cases: renderCases,
  notice: renderNotice,
  specs: renderSpecs,
  toolbox: renderToolbox,
  logos: renderLogos,
  "author-card": renderAuthorCard,
  people: renderPeople,
  series: renderSeries,
  subscribe: renderSubscribe,
  definition: renderDefinition,
  question: renderQuestion,
  changelog: renderChangelog,
  "comparison-table": renderComparisonTable,
  "resource-list": renderResourceList,
  "stat-row": renderStatRow,
  tweet: renderTweet,
  "myth-fact": renderMythFact,
  gallery: renderGallery,
  badges: renderBadges,
  statement: renderStatement,
  breaking: renderBreaking,
  "case-flow": renderCaseFlow,
  "p-title": renderPTitle,
  "reading-path": renderReadingPath,
};
