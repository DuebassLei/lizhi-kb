/**
 * 实用排版模块：前后对比、优缺点、大数字、对话、双态清单等 + 扩展图表
 */
import { getThemeAccent, type WechatThemeId } from "./themes";
import type { LayoutModuleRenderer, ModuleBody } from "./layoutModuleTypes";

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

function cardShell(accent: string, title: string | undefined, inner: string, opts?: { borderLeft?: boolean }): string {
  const borderLeft = opts?.borderLeft !== false;
  const border = borderLeft
    ? `border-left:4px solid ${accent};border-radius:0 10px 10px 0;`
    : `border:1px solid color-mix(in srgb, ${accent} 22%, #e2e8f0);border-radius:10px;`;
  let html =
    `<section class="layout-module" style="margin:16px 0;padding:16px;${border}` +
    `background:color-mix(in srgb, ${accent} 5%, #fff)">`;
  if (title) {
    html += `<p style="margin:0 0 12px;font-size:15px;font-weight:800;color:${accent}">${esc(title)}</p>`;
  }
  html += `${inner}</section>`;
  return html;
}

function emptyHint(accent: string, title: string | undefined, tip: string): string {
  return cardShell(accent, title, `<p style="margin:0;font-size:13px;color:#94a3b8">${esc(tip)}</p>`, {
    borderLeft: false,
  });
}

function titleOf(body: ModuleBody): string | undefined {
  return body.fields.title || body.label || undefined;
}

function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(String(raw).replace(/[%％,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
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
    ""
  );
}

/** 前后对比 */
export function renderBeforeAfter(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = titleOf(body);
  const beforeLabel = body.fields["before-label"] || body.fields.left || "之前";
  const afterLabel = body.fields["after-label"] || body.fields.right || "之后";
  const before =
    body.fields.before || body.fields.old || body.rows[0]?.[0] || "";
  const after =
    body.fields.after || body.fields.new || body.rows[0]?.[1] || body.rows[1]?.[0] || "";

  // 多行：左 | 右
  const pairs =
    body.rows.length > 0
      ? body.rows.filter((r) => r[0] || r[1])
      : before || after
        ? [[before, after]]
        : [];

  if (!pairs.length) {
    return emptyHint(accent, title, "请填写 before/after，或「之前 | 之后」行");
  }

  let inner = `<section style="display:flex;flex-direction:column;gap:10px">`;
  // 表头
  inner += `<section style="display:flex;gap:10px">`;
  inner += `<section style="flex:1;padding:8px 10px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca"><p style="margin:0;font-size:11px;font-weight:800;color:#dc2626;text-align:center">${esc(beforeLabel)}</p></section>`;
  inner += `<section style="flex:1;padding:8px 10px;border-radius:8px;background:color-mix(in srgb, ${accent} 10%, #fff);border:1px solid color-mix(in srgb, ${accent} 30%, #e2e8f0)"><p style="margin:0;font-size:11px;font-weight:800;color:${accent};text-align:center">${esc(afterLabel)}</p></section>`;
  inner += `</section>`;

  for (const row of pairs) {
    const [l, r] = row;
    if (!l && !r) continue;
    // 跳过若整行是表头文字
    if (l === beforeLabel && r === afterLabel) continue;
    inner += `<section style="display:flex;gap:10px">`;
    inner += `<section style="flex:1;padding:12px;border-radius:8px;background:#fff;border:1px solid #fecaca"><p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.6;white-space:pre-wrap">${esc(l || "—")}</p></section>`;
    inner += `<section style="flex:1;padding:12px;border-radius:8px;background:#fff;border:1px solid color-mix(in srgb, ${accent} 28%, #e2e8f0)"><p style="margin:0;font-size:13px;color:#14532d;line-height:1.6;white-space:pre-wrap">${esc(r || "—")}</p></section>`;
    inner += `</section>`;
  }
  inner += `</section>`;
  return cardShell(accent, title, inner, { borderLeft: false });
}

/** 优缺点 */
export function renderProsCons(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = titleOf(body);
  const pros: string[] = [];
  const cons: string[] = [];

  if (body.fields.pros) {
    pros.push(...body.fields.pros.split(/[|,，]/).map((s) => s.trim()).filter(Boolean));
  }
  if (body.fields.cons) {
    cons.push(...body.fields.cons.split(/[|,，]/).map((s) => s.trim()).filter(Boolean));
  }

  for (const row of body.rows) {
    const [a, b] = row;
    if (!a && !b) continue;
    // 「优点 | 缺点」单行，或两列
    if (a && b) {
      if (!/^缺点|cons$/i.test(a)) pros.push(a);
      if (!/^优点|pros$/i.test(b)) cons.push(b);
    } else if (a?.startsWith("+") || a?.startsWith("✓") || a?.startsWith("优")) {
      pros.push(a.replace(/^[+✓优]\s*/, ""));
    } else if (a?.startsWith("-") || a?.startsWith("✗") || a?.startsWith("缺")) {
      cons.push(a.replace(/^[-✗缺]\s*/, ""));
    } else if (a) {
      pros.push(a);
    }
  }

  if (!pros.length && !cons.length) {
    return emptyHint(accent, title, "请填写「优点 | 缺点」行，或 pros:/cons: 字段");
  }

  let inner = `<section style="display:flex;gap:10px;flex-wrap:wrap">`;
  inner += `<section style="flex:1;min-width:140px;padding:14px;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0">`;
  inner += `<p style="margin:0 0 10px;font-size:13px;font-weight:800;color:#16a34a">✓ 优点</p>`;
  for (const p of pros) {
    inner += `<p style="margin:0 0 6px;font-size:13px;color:#14532d;line-height:1.55;padding-left:12px;position:relative"><span style="position:absolute;left:0;color:#16a34a">•</span>${esc(p)}</p>`;
  }
  if (!pros.length) inner += `<p style="margin:0;font-size:12px;color:#94a3b8">暂无</p>`;
  inner += `</section>`;

  inner += `<section style="flex:1;min-width:140px;padding:14px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca">`;
  inner += `<p style="margin:0 0 10px;font-size:13px;font-weight:800;color:#dc2626">✗ 缺点</p>`;
  for (const c of cons) {
    inner += `<p style="margin:0 0 6px;font-size:13px;color:#7f1d1d;line-height:1.55;padding-left:12px;position:relative"><span style="position:absolute;left:0;color:#dc2626">•</span>${esc(c)}</p>`;
  }
  if (!cons.length) inner += `<p style="margin:0;font-size:12px;color:#94a3b8">暂无</p>`;
  inner += `</section></section>`;

  return cardShell(accent, title, inner, { borderLeft: false });
}

/** 超大数字结论 */
export function renderNumberCallout(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const value = body.fields.value || body.fields.number || body.rows[0]?.[0] || "0";
  const unit = body.fields.unit || "";
  const label = body.fields.label || body.fields.caption || body.rows[0]?.[1] || titleOf(body) || "";
  const note = body.fields.note || body.fields.desc || body.rows[0]?.[2] || moduleProse(body);

  let inner = `<section style="text-align:center;padding:8px 0">`;
  inner += `<p style="margin:0;font-size:42px;font-weight:900;color:${accent};line-height:1.1;letter-spacing:-1px">${esc(value)}<span style="font-size:18px;font-weight:700;margin-left:4px">${esc(unit)}</span></p>`;
  if (label) {
    inner += `<p style="margin:12px 0 0;font-size:16px;font-weight:700;color:#0f172a">${esc(label)}</p>`;
  }
  if (note && note !== label) {
    // 避免把整段 fields 当 note
    const clean = note
      .split("\n")
      .filter((l) => !/^(value|number|unit|label|caption|note|desc|title):/i.test(l.trim()))
      .join("\n")
      .trim();
    if (clean && clean !== String(value)) {
      inner += `<p style="margin:8px 0 0;font-size:13px;color:#64748b;line-height:1.6">${esc(clean)}</p>`;
    }
  }
  inner += `</section>`;
  return cardShell(accent, undefined, inner, { borderLeft: false });
}

/** 多段对话 / 访谈 */
export function renderQuoteThread(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = titleOf(body);
  const items: { role: string; text: string }[] = [];

  for (const row of body.rows) {
    const [role, ...rest] = row;
    const text = rest.length ? rest.join(" · ") : "";
    if (role && text) items.push({ role: role.trim(), text: text.trim() });
    else if (role && !text) {
      // 「角色：内容」写在单格
      const m = role.match(/^(.+?)[：:]\s*(.+)$/);
      if (m) items.push({ role: m[1].trim(), text: m[2].trim() });
    }
  }

  // fields: q1 / a1
  if (!items.length && (body.fields.q || body.fields.question)) {
    items.push({ role: body.fields.qrole || "问", text: body.fields.q || body.fields.question || "" });
    if (body.fields.a || body.fields.answer) {
      items.push({ role: body.fields.arole || "答", text: body.fields.a || body.fields.answer || "" });
    }
  }

  if (!items.length) {
    return emptyHint(accent, title, "请填写「角色 | 内容」行");
  }

  let inner = "";
  items.forEach((item, idx) => {
    const isAlt = idx % 2 === 1;
    const bg = isAlt ? `color-mix(in srgb, ${accent} 8%, #fff)` : "#f8fafc";
    const border = isAlt ? accent : "#e2e8f0";
    inner += `<section style="margin:0 0 10px;padding:12px 14px;border-radius:10px;background:${bg};border-left:3px solid ${border}">`;
    inner += `<p style="margin:0 0 6px;font-size:11px;font-weight:800;color:${isAlt ? accent : "#64748b"}">${esc(item.role)}</p>`;
    inner += `<p style="margin:0;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap">${esc(item.text)}</p>`;
    inner += `</section>`;
  });
  return cardShell(accent, title, inner, { borderLeft: false });
}

/** 已完成 / 未完成双态清单 */
export function renderChecklistDone(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = titleOf(body);
  const done: string[] = [];
  const todo: string[] = [];

  for (const row of body.rows) {
    const cell = row.join(" | ").trim();
    if (!cell) continue;
    const lower = cell.toLowerCase();
    if (/^(done|已完成|完成)$/i.test(cell) || /^(todo|未完成|待办)$/i.test(cell)) continue;

    if (
      cell.startsWith("[x]") ||
      cell.startsWith("[X]") ||
      cell.startsWith("✓") ||
      cell.startsWith("✅") ||
      lower.startsWith("done:") ||
      row[1]?.match(/^(done|已完成|✓)$/i)
    ) {
      done.push(cell.replace(/^(\[x\]|\[X\]|✓|✅|done:)\s*/i, "").replace(/\s*\|\s*(done|已完成|✓).*$/i, ""));
    } else if (
      cell.startsWith("[ ]") ||
      cell.startsWith("☐") ||
      cell.startsWith("○") ||
      lower.startsWith("todo:") ||
      row[1]?.match(/^(todo|未完成|待办)$/i)
    ) {
      todo.push(cell.replace(/^(\[ \]|☐|○|todo:)\s*/i, "").replace(/\s*\|\s*(todo|未完成|待办).*$/i, ""));
    } else if (row.length >= 2 && /done|完成|✓/i.test(row[1])) {
      done.push(row[0]);
    } else if (row.length >= 2 && /todo|待|未/i.test(row[1])) {
      todo.push(row[0]);
    } else {
      todo.push(cell);
    }
  }

  if (body.fields.done) {
    done.push(...body.fields.done.split(/[|,，]/).map((s) => s.trim()).filter(Boolean));
  }
  if (body.fields.todo) {
    todo.push(...body.fields.todo.split(/[|,，]/).map((s) => s.trim()).filter(Boolean));
  }

  if (!done.length && !todo.length) {
    return emptyHint(accent, title, "请填写 [x] 已完成 / [ ] 待办，或「事项 | done」");
  }

  let inner = "";
  if (done.length) {
    inner += `<p style="margin:0 0 8px;font-size:12px;font-weight:800;color:#16a34a">已完成 · ${done.length}</p>`;
    for (const d of done) {
      inner += `<p style="margin:0 0 6px;font-size:13px;color:#64748b;text-decoration:line-through;padding-left:18px;position:relative"><span style="position:absolute;left:0;color:#16a34a;text-decoration:none">✓</span>${esc(d)}</p>`;
    }
  }
  if (todo.length) {
    inner += `<p style="margin:${done.length ? "14px" : "0"} 0 8px;font-size:12px;font-weight:800;color:${accent}">待办 · ${todo.length}</p>`;
    for (const t of todo) {
      inner += `<p style="margin:0 0 6px;font-size:13px;color:#334155;padding-left:18px;position:relative"><span style="position:absolute;left:0;color:#94a3b8">○</span>${esc(t)}</p>`;
    }
  }
  return cardShell(accent, title, inner, { borderLeft: false });
}

/** 文末备注 / 免责 */
export function renderFootnoteBox(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = body.fields.title || body.label || "备注";
  const content = moduleProse(body) || body.rows.map((r) => r.join(" · ")).join("\n");
  let inner = `<p style="margin:0 0 8px;font-size:11px;font-weight:800;color:#94a3b8;letter-spacing:1px">${esc(title)}</p>`;
  if (content) {
    inner += `<p style="margin:0;font-size:12px;color:#64748b;line-height:1.7;white-space:pre-wrap">${esc(content)}</p>`;
  }
  return (
    `<section class="layout-module" style="margin:20px 0;padding:14px 16px;border-radius:8px;` +
    `border:1px dashed color-mix(in srgb, ${accent} 35%, #cbd5e1);background:#fafafa">${inner}</section>`
  );
}

/** 手动章节导航 */
export function renderChapterNav(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = titleOf(body) || "本章导读";
  const items = body.rows.filter((r) => r[0]?.trim());
  if (!items.length) return emptyHint(accent, title, "请填写「编号 | 标题 | 说明」或「标题 | 说明」");

  let inner = `<p style="margin:0 0 12px;font-size:14px;font-weight:800;color:${accent}">${esc(title)}</p>`;
  items.forEach((row, idx) => {
    let num = "";
    let heading = "";
    let desc = "";
    if (row.length >= 3) {
      [num, heading, desc] = row;
    } else {
      heading = row[0] || "";
      desc = row[1] || "";
      num = String(idx + 1).padStart(2, "0");
    }
    inner += `<section style="display:flex;gap:10px;padding:10px 0;border-top:${idx ? "1px solid #f1f5f9" : "none"}">`;
    inner += `<span style="flex-shrink:0;width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background:${accent};color:#fff;font-size:11px;font-weight:900">${esc(num)}</span>`;
    inner += `<section style="flex:1"><p style="margin:0;font-size:14px;font-weight:700;color:#0f172a">${esc(heading)}</p>`;
    if (desc) inner += `<p style="margin:4px 0 0;font-size:12px;color:#64748b">${esc(desc)}</p>`;
    inner += `</section></section>`;
  });
  return cardShell(accent, undefined, inner, { borderLeft: false });
}

/** 读完带走 */
export function renderKeyTakeaway(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const label = body.fields.label || body.label || "读完带走";
  const text =
    body.fields.takeaway ||
    body.fields.body ||
    body.fields.text ||
    moduleProse(body) ||
    body.rows.map((r) => r.join(" ")).join("\n");

  let inner = `<p style="margin:0 0 8px;font-size:11px;font-weight:800;color:${accent};letter-spacing:1.5px">${esc(label)}</p>`;
  inner += `<p style="margin:0;font-size:17px;font-weight:800;color:#0f172a;line-height:1.55">${esc(text || "一句话结论")}</p>`;
  return (
    `<section class="layout-module" style="margin:18px 0;padding:18px 16px;border-radius:12px;` +
    `background:color-mix(in srgb, ${accent} 10%, #fff);` +
    `border-top:3px solid ${accent};border-bottom:3px solid ${accent}">${inner}</section>`
  );
}

/** 顶部通知条 */
export function renderAlertBanner(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const tone = (body.fields.tone || body.fields.type || "info").toLowerCase();
  const tones: Record<string, { bg: string; fg: string; border: string }> = {
    info: { bg: "#eff6ff", fg: "#1d4ed8", border: "#93c5fd" },
    warn: { bg: "#fffbeb", fg: "#b45309", border: "#fcd34d" },
    warning: { bg: "#fffbeb", fg: "#b45309", border: "#fcd34d" },
    danger: { bg: "#fef2f2", fg: "#b91c1c", border: "#fca5a5" },
    success: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    accent: {
      bg: `color-mix(in srgb, ${accent} 12%, #fff)`,
      fg: accent,
      border: `color-mix(in srgb, ${accent} 40%, #e2e8f0)`,
    },
  };
  const c = tones[tone] || tones.info;
  const title = body.fields.title || body.label || "通知";
  const text = body.fields.body || body.fields.text || moduleProse(body) || body.rows.map((r) => r.join(" ")).join(" ");

  let inner = `<section style="display:flex;gap:10px;align-items:flex-start">`;
  inner += `<span style="flex-shrink:0;padding:2px 8px;border-radius:6px;background:${c.fg};color:#fff;font-size:10px;font-weight:800;line-height:1.6">${esc(title)}</span>`;
  if (text) {
    inner += `<p style="margin:0;font-size:13px;color:${c.fg};line-height:1.65;flex:1">${esc(text)}</p>`;
  }
  inner += `</section>`;
  return (
    `<section class="layout-module" style="margin:14px 0;padding:12px 14px;border-radius:10px;` +
    `background:${c.bg};border:1px solid ${c.border}">${inner}</section>`
  );
}

/** 评分卡 */
export function renderScoreCard(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = titleOf(body) || "综合评分";
  const score = body.fields.score || body.fields.total || body.rows.find((r) => /总分|score/i.test(r[0] || ""))?.[1] || "";
  const max = parseNum(body.fields.max) || 10;

  const items: { label: string; value: number }[] = [];
  for (const row of body.rows) {
    const [label, val] = row;
    if (!label || /总分|score/i.test(label)) continue;
    if (!/[\d.]/.test(val || "")) continue;
    items.push({ label, value: parseNum(val) });
  }

  let inner = `<section style="display:flex;align-items:center;gap:16px;margin-bottom:${items.length ? "14px" : "0"}">`;
  if (score) {
    inner += `<section style="flex-shrink:0;width:72px;height:72px;border-radius:16px;background:${accent};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 8px 20px color-mix(in srgb, ${accent} 35%, transparent)">`;
    inner += `<span style="font-size:28px;font-weight:900;line-height:1">${esc(String(score))}</span>`;
    inner += `<span style="font-size:10px;opacity:0.85;margin-top:2px">/ ${max}</span></section>`;
  }
  inner += `<section style="flex:1"><p style="margin:0;font-size:16px;font-weight:800;color:#0f172a">${esc(title)}</p>`;
  if (body.fields.verdict) {
    inner += `<p style="margin:6px 0 0;font-size:13px;color:#64748b">${esc(body.fields.verdict)}</p>`;
  }
  inner += `</section></section>`;

  for (const item of items) {
    const pct = Math.max(0, Math.min(100, (item.value / max) * 100));
    inner += `<section style="margin:0 0 8px"><section style="display:flex;justify-content:space-between;margin-bottom:4px">`;
    inner += `<span style="font-size:12px;color:#475569">${esc(item.label)}</span>`;
    inner += `<span style="font-size:12px;font-weight:800;color:${accent}">${item.value}</span></section>`;
    inner += `<section style="height:8px;border-radius:999px;background:#f1f5f9;overflow:hidden">`;
    inner += `<section style="height:100%;width:${pct}%;background:${accent};border-radius:999px"></section></section></section>`;
  }

  return cardShell(accent, undefined, inner, { borderLeft: false });
}

/** 难度 / 耗时 / 工具信息条 */
export function renderRecipeMeta(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const chips: { k: string; v: string }[] = [];

  const keys = [
    ["difficulty", "难度"],
    ["time", "耗时"],
    ["duration", "耗时"],
    ["tools", "工具"],
    ["level", "级别"],
    ["cost", "成本"],
    ["audience", "适合"],
  ] as const;

  for (const [field, label] of keys) {
    if (body.fields[field]) chips.push({ k: label, v: body.fields[field] });
  }
  for (const row of body.rows) {
    if (row[0] && row[1]) chips.push({ k: row[0], v: row[1] });
  }

  if (!chips.length) {
    return emptyHint(accent, titleOf(body), "请填写 difficulty/time/tools 或「标签 | 值」");
  }

  let inner = `<section style="display:flex;flex-wrap:wrap;gap:8px">`;
  for (const c of chips) {
    inner += `<span style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;background:#fff;border:1px solid color-mix(in srgb, ${accent} 28%, #e2e8f0)">`;
    inner += `<span style="font-size:10px;font-weight:800;color:${accent}">${esc(c.k)}</span>`;
    inner += `<span style="font-size:13px;font-weight:600;color:#0f172a">${esc(c.v)}</span></span>`;
  }
  inner += `</section>`;
  return cardShell(accent, titleOf(body), inner, { borderLeft: false });
}

/** 配图 + 图注 */
export function renderImageCaption(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const src = body.fields.image || body.fields.src || body.fields.url || "";
  const alt = body.fields.alt || "";
  const caption =
    body.fields.caption ||
    body.fields.title ||
    body.label ||
    moduleProse(body) ||
    body.rows.map((r) => r.join(" ")).join(" ");

  let inner = "";
  if (src) {
    inner += `<img src="${esc(src)}" alt="${esc(alt || caption || "")}" style="display:block;width:100%;border-radius:10px" />`;
  } else {
    inner += `<section style="padding:28px;border-radius:10px;background:#f1f5f9;text-align:center;color:#94a3b8;font-size:12px">请填写 image: 图片地址</section>`;
  }
  if (caption) {
    inner += `<p style="margin:10px 0 0;font-size:12px;color:#64748b;line-height:1.6;text-align:center">▲ ${esc(caption)}</p>`;
  }
  return cardShell(accent, undefined, inner, { borderLeft: false });
}

/** 简易热力表：行 | 单元格…  值越大颜色越深 */
export function renderHeatmap(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = titleOf(body);
  if (!body.rows.length) return emptyHint(accent, title, "请填写表头行 + 数据行");

  const [header, ...rows] = body.rows;
  const nums = rows.flatMap((r) => r.slice(1).map(parseNum));
  const max = Math.max(...nums, 1);

  let inner = `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>`;
  header?.forEach((h) => {
    inner += `<th style="padding:8px;background:${accent};color:#fff;border:1px solid ${accent};font-weight:700">${esc(h)}</th>`;
  });
  inner += `</tr></thead><tbody>`;
  for (const row of rows) {
    inner += `<tr>`;
    row.forEach((cell, i) => {
      if (i === 0) {
        inner += `<td style="padding:8px;border:1px solid #e2e8f0;font-weight:700;background:#f8fafc;white-space:nowrap">${esc(cell)}</td>`;
      } else {
        const v = parseNum(cell);
        const pct = Math.max(0, Math.min(100, (v / max) * 100));
        const bg = `color-mix(in srgb, ${accent} ${Math.max(8, pct * 0.7)}%, #fff)`;
        inner += `<td style="padding:8px;border:1px solid #e2e8f0;text-align:center;background:${bg};font-weight:700;color:#0f172a">${esc(cell)}</td>`;
      }
    });
    inner += `</tr>`;
  }
  inner += `</tbody></table>`;
  return cardShell(accent, title, inner, { borderLeft: false });
}

/** 分组柱状：类别 | 系列A | 系列B */
export function renderGroupedBar(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = titleOf(body);
  if (body.rows.length < 2) {
    return emptyHint(accent, title, "请填写表头「类别 | A | B」+ 数据行");
  }

  const [header, ...rows] = body.rows;
  const seriesNames = (header || []).slice(1).filter(Boolean);
  if (!seriesNames.length) return emptyHint(accent, title, "表头需包含系列名");

  const colors = [accent, "#2563eb", "#059669", "#7c3aed", "#db2777"];
  let max = 1;
  for (const row of rows) {
    for (let i = 1; i < row.length; i++) max = Math.max(max, parseNum(row[i]));
  }

  let inner = `<section style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">`;
  seriesNames.forEach((name, i) => {
    inner += `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:${colors[i % colors.length]}"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${colors[i % colors.length]}"></i>${esc(name)}</span>`;
  });
  inner += `</section>`;

  for (const row of rows) {
    const cat = row[0];
    if (!cat) continue;
    inner += `<section style="margin:0 0 12px"><p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#334155">${esc(cat)}</p>`;
    seriesNames.forEach((_, i) => {
      const v = parseNum(row[i + 1]);
      const pct = Math.max(0, Math.min(100, (v / max) * 100));
      const color = colors[i % colors.length];
      inner += `<section style="display:flex;align-items:center;gap:8px;margin:0 0 4px">`;
      inner += `<span style="width:48px;font-size:10px;color:#94a3b8;flex-shrink:0">${esc(seriesNames[i])}</span>`;
      inner += `<section style="flex:1;height:10px;border-radius:999px;background:#f1f5f9;overflow:hidden">`;
      inner += `<section style="height:100%;width:${pct}%;background:${color};border-radius:999px"></section></section>`;
      inner += `<span style="width:36px;text-align:right;font-size:11px;font-weight:800;color:${color}">${v}</span></section>`;
    });
    inner += `</section>`;
  }

  return cardShell(accent, title, inner, { borderLeft: false });
}

/** 瀑布图：标签 | 增减值（可正可负），首行为起点可选 */
export function renderWaterfall(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = titleOf(body);
  const points = body.rows
    .filter((r) => r[0])
    .map((r) => ({ label: r[0], delta: parseNum(r[1]) }));
  if (!points.length) return emptyHint(accent, title, "请填写「项目 | 增减值」");

  let running = parseNum(body.fields.start) || 0;
  const steps: { label: string; delta: number; from: number; to: number }[] = [];
  for (const p of points) {
    const from = running;
    running += p.delta;
    steps.push({ label: p.label, delta: p.delta, from, to: running });
  }

  const vals = steps.flatMap((s) => [s.from, s.to]);
  const minV = Math.min(0, ...vals);
  const maxV = Math.max(...vals, 1);
  const span = maxV - minV || 1;

  let inner = `<section style="display:flex;flex-direction:column;gap:10px">`;
  for (const s of steps) {
    const low = Math.min(s.from, s.to);
    const high = Math.max(s.from, s.to);
    const left = ((low - minV) / span) * 100;
    const width = Math.max(2, ((high - low) / span) * 100);
    const positive = s.delta >= 0;
    const color = positive ? "#16a34a" : "#dc2626";
    inner += `<section>`;
    inner += `<section style="display:flex;justify-content:space-between;margin-bottom:4px">`;
    inner += `<span style="font-size:12px;font-weight:600;color:#334155">${esc(s.label)}</span>`;
    inner += `<span style="font-size:12px;font-weight:800;color:${color}">${positive ? "+" : ""}${s.delta} → ${s.to}</span>`;
    inner += `</section>`;
    inner += `<section style="position:relative;height:12px;border-radius:6px;background:#f1f5f9">`;
    inner += `<section style="position:absolute;left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;height:100%;border-radius:6px;background:${color}"></section>`;
    inner += `</section></section>`;
  }
  if (body.fields.start) {
    inner += `<p style="margin:4px 0 0;font-size:11px;color:#94a3b8">起点 ${esc(body.fields.start)} · 终点 ${running}</p>`;
  } else {
    inner += `<p style="margin:4px 0 0;font-size:11px;color:#94a3b8">累计终点 ${running}</p>`;
  }
  inner += `</section>`;
  return cardShell(accent, title, inner, { borderLeft: false });
}

export const PRACTICAL_RENDERERS: Record<string, LayoutModuleRenderer> = {
  "before-after": (b, t) => renderBeforeAfter(b, t),
  beforeafter: (b, t) => renderBeforeAfter(b, t),
  "pros-cons": (b, t) => renderProsCons(b, t),
  proscons: (b, t) => renderProsCons(b, t),
  "number-callout": (b, t) => renderNumberCallout(b, t),
  numbercallout: (b, t) => renderNumberCallout(b, t),
  "big-number": (b, t) => renderNumberCallout(b, t),
  "quote-thread": (b, t) => renderQuoteThread(b, t),
  interview: (b, t) => renderQuoteThread(b, t),
  "checklist-done": (b, t) => renderChecklistDone(b, t),
  "todo-done": (b, t) => renderChecklistDone(b, t),
  "footnote-box": (b, t) => renderFootnoteBox(b, t),
  footnote: (b, t) => renderFootnoteBox(b, t),
  "chapter-nav": (b, t) => renderChapterNav(b, t),
  "key-takeaway": (b, t) => renderKeyTakeaway(b, t),
  takeaway: (b, t) => renderKeyTakeaway(b, t),
  "alert-banner": (b, t) => renderAlertBanner(b, t),
  alert: (b, t) => renderAlertBanner(b, t),
  "score-card": (b, t) => renderScoreCard(b, t),
  scorecard: (b, t) => renderScoreCard(b, t),
  "recipe-meta": (b, t) => renderRecipeMeta(b, t),
  meta: (b, t) => renderRecipeMeta(b, t),
  "image-caption": (b, t) => renderImageCaption(b, t),
  heatmap: (b, t) => renderHeatmap(b, t),
  "grouped-bar": (b, t) => renderGroupedBar(b, t),
  groupedbar: (b, t) => renderGroupedBar(b, t),
  waterfall: (b, t) => renderWaterfall(b, t),
};
