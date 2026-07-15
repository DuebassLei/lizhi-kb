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
  text: string;
  muted: string;
}

export const WA_MOOD_PALETTES: Record<WaMood, WaMoodPalette> = {
  cool: {
    bg: "#1e2a3a",
    bgAlt: "#28384f",
    accent: "#6b9fd8",
    text: "#e8eef6",
    muted: "#9ab0c8",
  },
  warm: {
    bg: "#2a2118",
    bgAlt: "#3a2d20",
    accent: "#d4a574",
    text: "#f6ece0",
    muted: "#c8a888",
  },
  neutral: {
    bg: "#252932",
    bgAlt: "#2d333f",
    accent: "#a0a6b0",
    text: "#e3e5e8",
    muted: "#787f8c",
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
  return lines.length > 0 ? lines.slice(0, 4) : [""];
}

export const WA_COVER_TEMPLATES: WaCoverTemplate[] = [
  {
    id: "plain",
    label: "纯色主标题",
    render: (ctx, { width, height, title, subtitle, palette }) => {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = palette.bgAlt;
      ctx.fillRect(0, height - 6, width, 6);

      ctx.fillStyle = palette.accent;
      ctx.fillRect(48, 48, 6, height - 96);

      ctx.fillStyle = palette.text;
      ctx.font = "600 56px 'Inter','Noto Sans SC',sans-serif";
      const lines = wrapText(ctx, title, width - 160);
      lines.forEach((line, i) => ctx.fillText(line, 80, height / 2 - 20 + i * 64));

      if (subtitle) {
        ctx.fillStyle = palette.muted;
        ctx.font = "400 22px 'Inter','Noto Sans SC',sans-serif";
        ctx.fillText(subtitle.slice(0, 40), 80, height - 56);
      }
    },
  },
  {
    id: "grid",
    label: "网格分块",
    render: (ctx, { width, height, title, subtitle, palette }) => {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = palette.bgAlt;
      ctx.fillRect(width - 280, 0, 280, height);

      ctx.strokeStyle = palette.accent;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.moveTo(width - 280 + 40, 40 + i * 60);
        ctx.lineTo(width - 40, 40 + i * 60);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = palette.text;
      ctx.font = "600 52px 'Inter','Noto Sans SC',sans-serif";
      const lines = wrapText(ctx, title, width - 360);
      lines.forEach((line, i) => ctx.fillText(line, 64, height / 2 - 10 + i * 60));

      if (subtitle) {
        ctx.fillStyle = palette.muted;
        ctx.font = "400 20px 'Inter','Noto Sans SC',sans-serif";
        ctx.fillText(subtitle.slice(0, 36), 64, height - 56);
      }
    },
  },
  {
    id: "accent",
    label: "色块强调",
    render: (ctx, { width, height, title, subtitle, palette }) => {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(0, 0, width * 0.42, height);

      ctx.fillStyle = palette.bg;
      ctx.font = "600 56px 'Inter','Noto Sans SC',sans-serif";
      const lines = wrapText(ctx, title, width * 0.42 - 64);
      lines.forEach((line, i) => ctx.fillText(line, 48, height / 2 - 20 + i * 64));

      ctx.fillStyle = palette.text;
      ctx.font = "600 40px 'Inter','Noto Sans SC',sans-serif";
      const right = wrapText(ctx, title, width * 0.55 - 96);
      right.slice(0, 3).forEach((line, i) => ctx.fillText(line, width * 0.42 + 48, height / 2 - 40 + i * 52));

      if (subtitle) {
        ctx.fillStyle = palette.muted;
        ctx.font = "400 20px 'Inter','Noto Sans SC',sans-serif";
        ctx.fillText(subtitle.slice(0, 36), width * 0.42 + 48, height - 56);
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

export function findCoverTemplate(id: WaCoverTemplateId): WaCoverTemplate {
  return WA_COVER_TEMPLATES.find((t) => t.id === id) ?? WA_COVER_TEMPLATES[0];
}

export function findIllustrationTemplate(layout: WaIllustrationLayout): WaIllustrationTemplate {
  return WA_ILLUSTRATION_TEMPLATES.find((t) => t.layout === layout) ?? WA_ILLUSTRATION_TEMPLATES[0];
}
