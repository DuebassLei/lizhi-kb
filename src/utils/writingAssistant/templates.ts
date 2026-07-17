import type {
  WaCoverTemplateId,
  WaIllustrationLayout,
  WaMood,
} from "../../types/writingAssistant";

/** 公众号封面比例（2.35:1） */
export const WA_COVER_WIDTH = 900;
export const WA_COVER_HEIGHT = 383;

/** 配图：宽图 16:9 */
export const WA_ILLUSTRATION_WIDTH = 960;
export const WA_ILLUSTRATION_HEIGHT = 540;

export interface WaMoodPalette {
  bg: string;
  bgAlt: string;
  accent: string;
  /** 科技感辅色（霓虹/电路） */
  neon: string;
  text: string;
  muted: string;
  /** 主标题强制高对比色 */
  title: string;
  /** 副标题区底/字对比用 */
  onAccent: string;
}

/** 封面色板：深底 + 克制辅色 */
export const WA_MOOD_PALETTES: Record<WaMood, WaMoodPalette> = {
  cool: {
    bg: "#0a1220",
    bgAlt: "#152238",
    accent: "#3ec4ff",
    neon: "#7b5cff",
    text: "#e8eef6",
    muted: "#7a90a8",
    title: "#ffffff",
    onAccent: "#041018",
  },
  warm: {
    bg: "#1a120e",
    bgAlt: "#2a1c14",
    accent: "#d4a574",
    neon: "#e08a5a",
    text: "#f6ece0",
    muted: "#b89272",
    title: "#fffaf4",
    onAccent: "#140e0a",
  },
  neutral: {
    bg: "#12141a",
    bgAlt: "#1c2028",
    accent: "#a8b0bc",
    neon: "#6ec8ff",
    text: "#eceef2",
    muted: "#858b98",
    title: "#ffffff",
    onAccent: "#0a0c10",
  },
};


export interface WaCoverTemplate {
  id: WaCoverTemplateId;
  label: string;
  /** 在 canvas 上绘制封面 */
  render: (
    ctx: CanvasRenderingContext2D,
    opts: {
      width: number;
      height: number;
      title: string;
      subtitle?: string;
      palette: WaMoodPalette;
    },
  ) => void;
}

export interface WaIllustrationTemplate {
  layout: WaIllustrationLayout;
  render: (
    ctx: CanvasRenderingContext2D,
    opts: {
      width: number;
      height: number;
      title: string;
      caption: string;
      keywords: string[];
      palette: WaMoodPalette;
    },
  ) => void;
}

/** 关键词 → 简笔装饰（有限映射，未知回退默认菱形） */
const KEYWORD_DECORATIONS: Record<string, "diamond" | "circle" | "grid" | "bars" | "rings"> = {
  data: "bars",
  chart: "bars",
  网络: "rings",
  生态: "rings",
  流程: "grid",
  结构: "grid",
  节点: "circle",
  核心: "diamond",
  重点: "diamond",
  增长: "bars",
  体系: "grid",
};

export function decorationForKeywords(keywords: string[]): "diamond" | "circle" | "grid" | "bars" | "rings" {
  for (const kw of keywords) {
    const k = kw.trim().toLowerCase();
    if (KEYWORD_DECORATIONS[k]) return KEYWORD_DECORATIONS[k];
  }
  return "diamond";
}

function drawDecoration(
  ctx: CanvasRenderingContext2D,
  kind: "diamond" | "circle" | "grid" | "bars" | "rings",
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  switch (kind) {
    case "diamond": {
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x + size / 2, y);
      ctx.lineTo(x, y + size / 2);
      ctx.lineTo(x - size / 2, y);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "circle": {
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "grid": {
      const n = 3;
      const step = size / n;
      for (let i = 0; i <= n; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x - size / 2, y - size / 2 + i * step);
        ctx.lineTo(x + size / 2, y - size / 2 + i * step);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - size / 2 + i * step, y - size / 2);
        ctx.lineTo(x - size / 2 + i * step, y + size / 2);
        ctx.stroke();
      }
      break;
    }
    case "bars": {
      const n = 4;
      const bw = size / (n * 2 - 1);
      for (let i = 0; i < n; i += 1) {
        const h = size * (0.3 + (i + 1) / (n + 1) * 0.7);
        ctx.fillRect(x - size / 2 + i * bw * 2, y + size / 2 - h, bw, h);
      }
      break;
    }
    case "rings": {
      for (let i = 1; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.arc(x, y, (size / 2) * (i / 3), 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4,
): string[] {
  const chars = Array.from(text);
  const lines: string[] = [];
  let cur = "";
  for (const ch of chars) {
    const test = cur + ch;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines.slice(0, maxLines) : [""];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillLinear(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: Array<[number, string]>,
) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}

function fillRadial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r0: number,
  r1: number,
  c0: string,
  c1: string,
) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** 氛围底：渐变光晕 + 科技网格/电路 + 漫画网点/速度线 */
export const WA_COVER_TEMPLATES: WaCoverTemplate[] = [
  {
    id: "plain",
    label: "极简杂志",
    render: (ctx, { width, height, title, subtitle, palette }) => {
      ctx.fillStyle = fillLinear(ctx, 0, 0, width, height, [
        [0, palette.bg],
        [1, palette.bgAlt],
      ]);
      ctx.fillRect(0, 0, width, height);

      // 右侧柔光
      ctx.fillStyle = fillRadial(
        ctx,
        width * 0.85,
        height * 0.3,
        20,
        width * 0.5,
        withAlpha(palette.accent, 0.18),
        withAlpha(palette.accent, 0),
      );
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = palette.accent;
      ctx.fillRect(48, 48, 4, height - 96);

      ctx.fillStyle = palette.muted;
      ctx.font = "600 13px 'Inter','Noto Sans SC',system-ui,sans-serif";
      ctx.fillText("LIZHI  ·  COVER", 72, 56);

      ctx.fillStyle = palette.title;
      ctx.font = "700 52px 'Inter','Noto Sans SC',system-ui,sans-serif";
      const lines = wrapText(ctx, title, width * 0.62, 3);
      const lh = 60;
      const titleY = height * 0.38;
      lines.forEach((line, i) => ctx.fillText(line, 72, titleY + i * lh));

      if (subtitle?.trim()) {
        const sub = subtitle.trim().slice(0, 36);
        ctx.font = "600 16px 'Inter','Noto Sans SC',system-ui,sans-serif";
        const tw = Math.min(ctx.measureText(sub).width + 28, width * 0.5);
        ctx.fillStyle = palette.accent;
        roundRect(ctx, 72, titleY + lines.length * lh + 16, tw, 30, 3);
        ctx.fill();
        ctx.fillStyle = palette.onAccent;
        ctx.fillText(sub, 86, titleY + lines.length * lh + 36);
      } else {
        ctx.fillStyle = palette.accent;
        ctx.fillRect(72, height - 56, 56, 3);
      }
    },
  },
  {
    id: "grid",
    label: "硬科技 HUD",
    render: (ctx, { width, height, title, subtitle, palette }) => {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);

      // 疏网格
      ctx.strokeStyle = withAlpha(palette.accent, 0.12);
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // HUD 角标
      const m = 28;
      const L = 20;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2;
      for (const [cx, cy, dx, dy] of [
        [m, m, 1, 1],
        [width - m, m, -1, 1],
        [m, height - m, 1, -1],
        [width - m, height - m, -1, -1],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + dy * L);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + dx * L, cy);
        ctx.stroke();
      }

      // 右侧雷达环（单一锚点）
      const rx = width - 140;
      const ry = height / 2;
      ctx.strokeStyle = withAlpha(palette.neon, 0.45);
      ctx.lineWidth = 1.5;
      for (let i = 1; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.arc(rx, ry, 28 * i, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.arc(rx, ry, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette.muted;
      ctx.font = "600 12px 'Inter',system-ui,sans-serif";
      ctx.fillText("SYS // HUD", 56, 52);

      ctx.fillStyle = palette.title;
      ctx.font = "700 48px 'Inter','Noto Sans SC',system-ui,sans-serif";
      const lines = wrapText(ctx, title, width - 320, 3);
      lines.forEach((line, i) => ctx.fillText(line, 56, height * 0.36 + i * 56));

      if (subtitle?.trim()) {
        ctx.fillStyle = withAlpha(palette.accent, 0.9);
        ctx.font = "600 16px 'Inter','Noto Sans SC',system-ui,sans-serif";
        ctx.fillText(subtitle.trim().slice(0, 40), 56, height - 48);
      }
    },
  },
  {
    id: "accent",
    label: "漫画分镜",
    render: (ctx, { width, height, title, subtitle, palette }) => {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);

      const leftW = Math.round(width * 0.34);
      ctx.fillStyle = fillLinear(ctx, 0, 0, 0, height, [
        [0, palette.accent],
        [1, palette.neon],
      ]);
      ctx.fillRect(0, 0, leftW, height);

      // 粗墨框
      ctx.strokeStyle = palette.onAccent;
      ctx.lineWidth = 4;
      ctx.strokeRect(12, 12, leftW - 24, height - 24);

      // 左栏少量速度线
      ctx.strokeStyle = withAlpha(palette.onAccent, 0.25);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i += 1) {
        const y = 40 + i * ((height - 80) / 7);
        ctx.beginPath();
        ctx.moveTo(28, y);
        ctx.lineTo(leftW - 28, y + (i % 2 === 0 ? 8 : -8));
        ctx.stroke();
      }

      ctx.fillStyle = palette.onAccent;
      ctx.font = "700 12px 'Inter','Noto Sans SC',system-ui,sans-serif";
      ctx.fillText("PANEL 01", 28, 40);

      // 右栏分镜框
      ctx.strokeStyle = withAlpha(palette.accent, 0.55);
      ctx.lineWidth = 3;
      ctx.strokeRect(leftW + 20, 20, width - leftW - 40, height - 40);

      ctx.fillStyle = palette.title;
      ctx.font = "700 46px 'Inter','Noto Sans SC',system-ui,sans-serif";
      const lines = wrapText(ctx, title, width - leftW - 100, 3);
      lines.forEach((line, i) =>
        ctx.fillText(line, leftW + 44, height * 0.36 + i * 54),
      );

      if (subtitle?.trim()) {
        const sub = subtitle.trim().slice(0, 36);
        ctx.font = "600 15px 'Inter','Noto Sans SC',system-ui,sans-serif";
        const tw = ctx.measureText(sub).width + 24;
        ctx.fillStyle = palette.accent;
        roundRect(ctx, leftW + 44, height - 72, tw, 28, 2);
        ctx.fill();
        ctx.fillStyle = palette.onAccent;
        ctx.fillText(sub, leftW + 56, height - 52);
      }
    },
  },
];


export const WA_ILLUSTRATION_TEMPLATES: WaIllustrationTemplate[] = [
  {
    layout: "hero",
    render: (ctx, { width, height, title, caption, keywords, palette }) => {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = palette.bgAlt;
      ctx.fillRect(0, height - 120, width, 120);

      drawDecoration(
        ctx,
        decorationForKeywords(keywords),
        width - 160,
        height / 2 - 40,
        180,
        palette.accent,
      );

      ctx.fillStyle = palette.text;
      ctx.font = "600 48px 'Inter','Noto Sans SC',sans-serif";
      const lines = wrapText(ctx, title, width - 360);
      lines.forEach((line, i) => ctx.fillText(line, 64, height / 2 - 20 + i * 56));

      if (caption) {
        ctx.fillStyle = palette.muted;
        ctx.font = "400 22px 'Inter','Noto Sans SC',sans-serif";
        const caps = wrapText(ctx, caption, width - 128);
        caps.slice(0, 2).forEach((line, i) => ctx.fillText(line, 64, height - 60 + i * 28));
      }
    },
  },
  {
    layout: "split",
    render: (ctx, { width, height, title, caption, keywords, palette }) => {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width / 2, height);
      ctx.fillStyle = palette.bgAlt;
      ctx.fillRect(width / 2, 0, width / 2, height);

      drawDecoration(
        ctx,
        decorationForKeywords(keywords),
        width * 0.75,
        height / 2,
        Math.min(220, height - 80),
        palette.accent,
      );

      ctx.fillStyle = palette.text;
      ctx.font = "600 44px 'Inter','Noto Sans SC',sans-serif";
      const lines = wrapText(ctx, title, width / 2 - 96);
      lines.forEach((line, i) => ctx.fillText(line, 48, height / 2 - 20 + i * 52));

      if (caption) {
        ctx.fillStyle = palette.muted;
        ctx.font = "400 20px 'Inter','Noto Sans SC',sans-serif";
        const caps = wrapText(ctx, caption, width / 2 - 96);
        caps.slice(0, 3).forEach((line, i) => ctx.fillText(line, 48, height / 2 + 80 + i * 28));
      }
    },
  },
  {
    layout: "bullets",
    render: (ctx, { width, height, title, caption, keywords, palette }) => {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(0, 0, 8, height);

      ctx.fillStyle = palette.text;
      ctx.font = "600 44px 'Inter','Noto Sans SC',sans-serif";
      const lines = wrapText(ctx, title, width - 128);
      lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, 48, 80 + i * 52));

      const bullets = keywords.slice(0, 5);
      ctx.font = "400 24px 'Inter','Noto Sans SC',sans-serif";
      bullets.forEach((kw, i) => {
        const y = 200 + i * 56;
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(64, y - 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.text;
        ctx.fillText(kw.slice(0, 24), 88, y);
      });

      if (caption) {
        ctx.fillStyle = palette.muted;
        ctx.font = "400 20px 'Inter','Noto Sans SC',sans-serif";
        const caps = wrapText(ctx, caption, width - 128);
        caps.slice(0, 2).forEach((line, i) =>
          ctx.fillText(line, 48, height - 60 + i * 28),
        );
      }
    },
  },
];

export function findCoverTemplate(id: WaCoverTemplateId | string): WaCoverTemplate {
  const map: Record<string, WaCoverTemplateId> = {
    plain: "plain",
    grid: "grid",
    accent: "accent",
    banner: "plain",
    centered: "grid",
    splitBar: "accent",
  };
  const resolved = map[id] ?? "plain";
  return WA_COVER_TEMPLATES.find((t) => t.id === resolved) ?? WA_COVER_TEMPLATES[0];
}

export function findIllustrationTemplate(layout: WaIllustrationLayout): WaIllustrationTemplate {
  return WA_ILLUSTRATION_TEMPLATES.find((t) => t.layout === layout) ?? WA_ILLUSTRATION_TEMPLATES[0];
}
