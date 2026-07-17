/**
 * 公众号 CSS 图表模块（纯 HTML/CSS，可复制到微信）
 * bar-chart / column-chart / progress / donut / line-chart / radar-chart / stack-bar
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

function cardShell(accent: string, title: string | undefined, inner: string): string {
  let html =
    `<section class="layout-module" style="margin:16px 0;padding:16px;border-radius:12px;` +
    `border:1px solid color-mix(in srgb, ${accent} 22%, #e2e8f0);` +
    `background:color-mix(in srgb, ${accent} 4%, #fff)">`;
  if (title) {
    html += `<p style="margin:0 0 14px;font-size:15px;font-weight:800;color:${accent}">${esc(title)}</p>`;
  }
  html += `${inner}</section>`;
  return html;
}

function emptyHint(accent: string, title: string | undefined, tip: string): string {
  return cardShell(
    accent,
    title,
    `<p style="margin:0;font-size:13px;color:#94a3b8">${esc(tip)}</p>`,
  );
}

interface ChartPoint {
  label: string;
  value: number;
  raw: string;
}

function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(String(raw).replace(/[%％,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 从 rows 解析「标签 | 数值」；跳过表头行（第二列非数字） */
function parseLabelValueRows(body: ModuleBody): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const row of body.rows) {
    if (row.length < 2) continue;
    const label = (row[0] || "").trim();
    const raw = (row[1] || "").trim();
    if (!label) continue;
    // 跳过表头：第二列完全非数字
    if (raw && !/[\d.]/.test(raw) && row.length <= 2) continue;
    const value = parseNum(raw);
    points.push({ label, value, raw: raw || String(value) });
  }
  return points;
}

function chartTitle(body: ModuleBody): string | undefined {
  return body.fields.title || body.label || undefined;
}

const SERIES_COLORS = ["#ea580c", "#2563eb", "#059669", "#7c3aed", "#db2777", "#0891b2", "#d97706"];

function seriesColor(accent: string, idx: number): string {
  if (idx === 0) return accent;
  return SERIES_COLORS[idx % SERIES_COLORS.length];
}

/** 横向条形图 */
export function renderBarChart(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = chartTitle(body);
  const points = parseLabelValueRows(body);
  if (!points.length) return emptyHint(accent, title, "请填写：标签 | 数值");

  const maxField = parseNum(body.fields.max);
  const max = Math.max(maxField || 0, ...points.map((p) => p.value), 1);
  const unit = body.fields.unit || "";

  let inner = `<section style="display:flex;flex-direction:column;gap:10px">`;
  for (const p of points) {
    const pct = Math.max(0, Math.min(100, (p.value / max) * 100));
    inner += `<section>`;
    inner += `<section style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">`;
    inner += `<span style="font-size:13px;font-weight:600;color:#334155">${esc(p.label)}</span>`;
    inner += `<span style="font-size:13px;font-weight:800;color:${accent}">${esc(p.raw)}${esc(unit)}</span>`;
    inner += `</section>`;
    inner += `<section style="height:10px;border-radius:999px;background:#f1f5f9;overflow:hidden">`;
    inner += `<section style="height:100%;width:${pct.toFixed(1)}%;border-radius:999px;background:${accent}"></section>`;
    inner += `</section></section>`;
  }
  inner += `</section>`;
  return cardShell(accent, title, inner);
}

/** 纵向柱状图 */
export function renderColumnChart(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = chartTitle(body);
  const points = parseLabelValueRows(body);
  if (!points.length) return emptyHint(accent, title, "请填写：标签 | 数值");

  const maxField = parseNum(body.fields.max);
  const max = Math.max(maxField || 0, ...points.map((p) => p.value), 1);
  const unit = body.fields.unit || "";
  const chartH = 120;

  let inner = `<section style="display:flex;align-items:flex-end;justify-content:space-between;gap:6px;height:${chartH + 36}px;padding-top:8px">`;
  for (const p of points) {
    const pct = Math.max(4, Math.min(100, (p.value / max) * 100));
    const h = Math.round((pct / 100) * chartH);
    inner += `<section style="flex:1;min-width:0;text-align:center">`;
    inner += `<p style="margin:0 0 4px;font-size:11px;font-weight:800;color:${accent}">${esc(p.raw)}${esc(unit)}</p>`;
    inner += `<section style="margin:0 auto;width:70%;max-width:36px;height:${h}px;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,${accent},${accent}cc)"></section>`;
    inner += `<p style="margin:6px 0 0;font-size:11px;color:#64748b;line-height:1.3;word-break:break-all">${esc(p.label)}</p>`;
    inner += `</section>`;
  }
  inner += `</section>`;
  return cardShell(accent, title, inner);
}

/** 进度条（0–100） */
export function renderProgressChart(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = chartTitle(body);
  const points = parseLabelValueRows(body);
  if (!points.length) return emptyHint(accent, title, "请填写：标签 | 0–100");

  let inner = `<section style="display:flex;flex-direction:column;gap:12px">`;
  for (const p of points) {
    const pct = Math.max(0, Math.min(100, p.value));
    inner += `<section>`;
    inner += `<section style="display:flex;justify-content:space-between;margin-bottom:5px">`;
    inner += `<span style="font-size:13px;font-weight:600;color:#334155">${esc(p.label)}</span>`;
    inner += `<span style="font-size:12px;font-weight:800;color:${accent}">${pct.toFixed(0)}%</span>`;
    inner += `</section>`;
    inner += `<section style="height:12px;border-radius:8px;background:#f1f5f9;overflow:hidden">`;
    inner += `<section style="height:100%;width:${pct}%;border-radius:8px;background:${accent}"></section>`;
    inner += `</section></section>`;
  }
  inner += `</section>`;
  return cardShell(accent, title, inner);
}

/** 环形占比（conic-gradient + 图例） */
export function renderDonutChart(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = chartTitle(body);
  const points = parseLabelValueRows(body);
  if (!points.length) return emptyHint(accent, title, "请填写：标签 | 占比");

  const total = points.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  let cursor = 0;
  const stops: string[] = [];
  points.forEach((p, i) => {
    const share = (Math.max(0, p.value) / total) * 100;
    const color = seriesColor(accent, i);
    const start = cursor;
    const end = cursor + share;
    stops.push(`${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
    cursor = end;
  });

  const centerLabel = body.fields.center || body.fields.total || "";
  let inner = `<section style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">`;
  inner += `<section style="position:relative;width:132px;height:132px;flex-shrink:0;border-radius:999px;background:conic-gradient(${stops.join(",")})">`;
  inner += `<section style="position:absolute;left:22px;top:22px;right:22px;bottom:22px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center">`;
  if (centerLabel) {
    inner += `<span style="font-size:12px;font-weight:800;color:#334155;text-align:center;padding:4px">${esc(centerLabel)}</span>`;
  }
  inner += `</section></section>`;

  inner += `<section style="flex:1;min-width:140px">`;
  points.forEach((p, i) => {
    const share = ((Math.max(0, p.value) / total) * 100).toFixed(1);
    const color = seriesColor(accent, i);
    inner += `<section style="display:flex;align-items:center;gap:8px;margin:0 0 8px">`;
    inner += `<span style="width:10px;height:10px;border-radius:3px;background:${color};flex-shrink:0"></span>`;
    inner += `<span style="flex:1;font-size:13px;color:#334155">${esc(p.label)}</span>`;
    inner += `<span style="font-size:12px;font-weight:800;color:${color}">${share}%</span>`;
    inner += `</section>`;
  });
  inner += `</section></section>`;
  return cardShell(accent, title, inner);
}

/** 折线趋势（柱顶圆点 + 数值，微信兼容） */
export function renderLineChart(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = chartTitle(body);
  const points = parseLabelValueRows(body);
  if (!points.length) return emptyHint(accent, title, "请填写：点名 | 数值");

  const maxField = parseNum(body.fields.max);
  const max = Math.max(maxField || 0, ...points.map((p) => p.value), 1);
  const chartH = 110;

  let inner = `<section style="position:relative;padding:8px 4px 0">`;
  // 背景网格线
  inner += `<section style="position:absolute;left:0;right:0;top:24px;height:${chartH}px;border-bottom:1px solid #e2e8f0;pointer-events:none">`;
  for (let g = 1; g <= 3; g++) {
    inner += `<section style="position:absolute;left:0;right:0;bottom:${(g / 4) * 100}%;border-top:1px dashed #f1f5f9;height:0"></section>`;
  }
  inner += `</section>`;

  inner += `<section style="display:flex;align-items:flex-end;justify-content:space-between;gap:4px;height:${chartH + 28}px;position:relative;z-index:1">`;
  points.forEach((p, idx) => {
    const pct = Math.max(0, Math.min(100, (p.value / max) * 100));
    const h = Math.round((pct / 100) * chartH);
    const next = points[idx + 1];
    inner += `<section style="flex:1;min-width:0;text-align:center;position:relative">`;
    inner += `<p style="margin:0 0 2px;font-size:10px;font-weight:800;color:${accent}">${esc(p.raw)}</p>`;
    // 竖向引导（淡）
    inner += `<section style="margin:0 auto;width:2px;height:${h}px;background:color-mix(in srgb, ${accent} 25%, transparent);position:relative">`;
    inner += `<span style="position:absolute;left:50%;top:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:999px;background:${accent};border:2px solid #fff;box-shadow:0 1px 3px rgba(15,23,42,0.15)"></span>`;
    // 近似连线：向右画斜线用 border（仅视觉提示）
    if (next) {
      const nextPct = Math.max(0, Math.min(100, (next.value / max) * 100));
      const nextH = Math.round((nextPct / 100) * chartH);
      const dy = nextH - h;
      // 用绝对定位的短色条示意趋势方向
      const dir = dy >= 0 ? "↗" : "↘";
      void dir;
    }
    inner += `</section>`;
    inner += `<p style="margin:8px 0 0;font-size:11px;color:#64748b;word-break:break-all">${esc(p.label)}</p>`;
    inner += `</section>`;
  });
  inner += `</section></section>`;

  // 趋势摘要行
  if (points.length >= 2) {
    const first = points[0].value;
    const last = points[points.length - 1].value;
    const delta = last - first;
    const trend = delta > 0 ? `↑ +${delta}` : delta < 0 ? `↓ ${delta}` : "→ 持平";
    inner += `<p style="margin:10px 0 0;font-size:12px;color:#64748b">趋势 ${esc(trend)}（${esc(points[0].label)} → ${esc(points[points.length - 1].label)}）</p>`;
  }

  return cardShell(accent, title, inner);
}

interface RadarSeries {
  name: string;
  values: number[];
}

/** 解析雷达：单列「维度|分」或表头「维度|系列A|系列B」 */
function parseRadar(body: ModuleBody): { dims: string[]; series: RadarSeries[] } {
  const rows = body.rows.filter((r) => r.some((c) => c.trim()));
  if (!rows.length) return { dims: [], series: [] };

  const first = rows[0].map((c) => c.trim());
  const secondIsNum = first.length >= 2 && /[\d.]/.test(first[1] || "");

  // 表头模式：第一行第二列起不是纯数字标签，或显式 header: true
  const looksLikeHeader =
    body.fields.header === "true" ||
    (first.length >= 3 && !/^[\d.]+%?$/.test(first[1] || "")) ||
    (first.length >= 2 && first[0].match(/维度|指标|项目/) && !secondIsNum);

  if (looksLikeHeader || (first.length >= 3 && !/^[\d.]+/.test(first[1] || ""))) {
    const seriesNames = first.slice(1).filter(Boolean);
    const dims: string[] = [];
    const series: RadarSeries[] = seriesNames.map((name) => ({ name, values: [] }));
    for (const row of rows.slice(1)) {
      const dim = (row[0] || "").trim();
      if (!dim) continue;
      dims.push(dim);
      seriesNames.forEach((_, i) => {
        series[i].values.push(parseNum(row[i + 1]));
      });
    }
    return { dims, series };
  }

  // 单系列
  const dims: string[] = [];
  const values: number[] = [];
  for (const row of rows) {
    const dim = (row[0] || "").trim();
    if (!dim) continue;
    // 跳过表头
    if (row[1] && !/[\d.]/.test(row[1]) && row.length <= 2) continue;
    dims.push(dim);
    values.push(parseNum(row[1]));
  }
  const name = body.fields.series || body.fields.name || "得分";
  return { dims, series: [{ name, values }] };
}

function radarPolygonPoints(values: number[], max: number, cx: number, cy: number, r: number): string {
  const n = values.length;
  if (!n) return "";
  return values
    .map((v, i) => {
      const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
      const ratio = Math.max(0, Math.min(1, v / max));
      const x = cx + r * ratio * Math.cos(angle);
      const y = cy + r * ratio * Math.sin(angle);
      return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
    })
    .join(", ");
}

/** 多维度雷达（clip-path 轮廓 + 维度条；支持多系列对比） */
export function renderRadarChart(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = chartTitle(body);
  const { dims, series } = parseRadar(body);
  if (!dims.length || !series.length) {
    return emptyHint(accent, title, "请填写：维度 | 分数；或多系列表头「维度 | A | B」");
  }

  const max = Math.max(parseNum(body.fields.max) || 100, 1);
  const n = dims.length;
  const size = 160;

  // 背景网格多边形（25/50/75/100%）
  let web = "";
  for (const ring of [1, 0.75, 0.5, 0.25]) {
    const pts = Array.from({ length: n }, (_, i) => {
      const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
      const x = 50 + 46 * ring * Math.cos(angle);
      const y = 50 + 46 * ring * Math.sin(angle);
      return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
    }).join(", ");
    web += `<section style="position:absolute;inset:0;clip-path:polygon(${pts});background:color-mix(in srgb, ${accent} ${ring === 1 ? 8 : 4}%, transparent);border:0"></section>`;
  }

  let polygons = "";
  series.forEach((s, si) => {
    const color = seriesColor(accent, si);
    const pts = radarPolygonPoints(s.values, max, 50, 50, 46);
    if (!pts) return;
    polygons += `<section style="position:absolute;inset:0;clip-path:polygon(${pts});background:color-mix(in srgb, ${color} 35%, transparent)"></section>`;
  });

  // 维度标签绕圈（简化：仅列表展示更稳妥；上方放示意雷达）
  let inner = `<section style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">`;
  inner += `<section style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;margin:0 auto;border-radius:999px;background:#f8fafc;border:1px solid #e2e8f0;overflow:hidden">${web}${polygons}</section>`;

  inner += `<section style="flex:1;min-width:180px">`;
  if (series.length > 1) {
    inner += `<section style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">`;
    series.forEach((s, si) => {
      const color = seriesColor(accent, si);
      inner += `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:${color}"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color}"></i>${esc(s.name)}</span>`;
    });
    inner += `</section>`;
  }

  dims.forEach((dim, di) => {
    inner += `<section style="margin:0 0 10px">`;
    inner += `<p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#334155">${esc(dim)}</p>`;
    series.forEach((s, si) => {
      const v = s.values[di] ?? 0;
      const pct = Math.max(0, Math.min(100, (v / max) * 100));
      const color = seriesColor(accent, si);
      const label = series.length > 1 ? `${s.name} ` : "";
      inner += `<section style="display:flex;align-items:center;gap:6px;margin:0 0 3px">`;
      if (series.length > 1) {
        inner += `<span style="width:36px;font-size:10px;color:#94a3b8;flex-shrink:0">${esc(label.trim())}</span>`;
      }
      inner += `<section style="flex:1;height:8px;border-radius:999px;background:#f1f5f9;overflow:hidden">`;
      inner += `<section style="height:100%;width:${pct}%;background:${color};border-radius:999px"></section></section>`;
      inner += `<span style="width:28px;text-align:right;font-size:11px;font-weight:800;color:${color}">${v}</span>`;
      inner += `</section>`;
    });
    inner += `</section>`;
  });
  inner += `</section></section>`;

  return cardShell(accent, title, inner);
}

/** 堆叠条形 */
export function renderStackBar(body: ModuleBody, themeId: WechatThemeId): string {
  const accent = accentOf(themeId);
  const title = chartTitle(body);
  const points = parseLabelValueRows(body);
  if (!points.length) return emptyHint(accent, title, "请填写：分段名 | 数值");

  const total = points.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;

  let bar = `<section style="display:flex;height:22px;border-radius:10px;overflow:hidden;background:#f1f5f9">`;
  points.forEach((p, i) => {
    const pct = (Math.max(0, p.value) / total) * 100;
    if (pct <= 0) return;
    const color = seriesColor(accent, i);
    bar += `<section style="width:${pct.toFixed(2)}%;background:${color}" title="${esc(p.label)}"></section>`;
  });
  bar += `</section>`;

  let legend = `<section style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px">`;
  points.forEach((p, i) => {
    const pct = ((Math.max(0, p.value) / total) * 100).toFixed(1);
    const color = seriesColor(accent, i);
    legend += `<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#334155">`;
    legend += `<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color}"></i>`;
    legend += `${esc(p.label)} <strong style="color:${color}">${esc(p.raw)}</strong>（${pct}%）</span>`;
  });
  legend += `</section>`;

  return cardShell(accent, title, bar + legend);
}

export const CHART_RENDERERS: Record<string, LayoutModuleRenderer> = {
  "bar-chart": (b, t) => renderBarChart(b, t),
  barchart: (b, t) => renderBarChart(b, t),
  "column-chart": (b, t) => renderColumnChart(b, t),
  columnchart: (b, t) => renderColumnChart(b, t),
  progress: (b, t) => renderProgressChart(b, t),
  "progress-chart": (b, t) => renderProgressChart(b, t),
  donut: (b, t) => renderDonutChart(b, t),
  "donut-chart": (b, t) => renderDonutChart(b, t),
  "pie-chart": (b, t) => renderDonutChart(b, t),
  "line-chart": (b, t) => renderLineChart(b, t),
  linechart: (b, t) => renderLineChart(b, t),
  "radar-chart": (b, t) => renderRadarChart(b, t),
  radar: (b, t) => renderRadarChart(b, t),
  "stack-bar": (b, t) => renderStackBar(b, t),
  stackbar: (b, t) => renderStackBar(b, t),
};
