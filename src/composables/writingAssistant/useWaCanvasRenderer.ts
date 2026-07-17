import { saveAsset, saveAssetFromBlob, toAssetRef } from "../../services/assetService";
import {
  WA_COVER_HEIGHT,
  WA_COVER_TEMPLATES,
  WA_COVER_WIDTH,
  WA_ILLUSTRATION_HEIGHT,
  WA_ILLUSTRATION_TEMPLATES,
  WA_ILLUSTRATION_WIDTH,
  WA_MOOD_PALETTES,
  findCoverTemplate,
  findIllustrationTemplate,
} from "../../utils/writingAssistant/templates";
import type {
  WaCoverTemplateId,
  WaIllustrationLayout,
  WaIllustrationPrompt,
  WaMood,
} from "../../types/writingAssistant";

export interface RenderCoverOpts {
  title: string;
  subtitle?: string;
  mood?: WaMood;
  templateId?: WaCoverTemplateId;
  width?: number;
  height?: number;
}

export interface RenderIllustrationOpts {
  title: string;
  caption: string;
  keywords: string[];
  layout: WaIllustrationLayout;
  mood: WaMood;
  width?: number;
  height?: number;
}

export interface ComposeCoverFromImageOpts {
  title: string;
  subtitle?: string;
  overlayText?: boolean;
  width?: number;
  height?: number;
}

function getCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法获取 Canvas 2D 上下文");
  return ctx;
}

export function renderCoverToCanvas(canvas: HTMLCanvasElement, opts: RenderCoverOpts) {
  const tpl = findCoverTemplate(opts.templateId ?? "plain");
  const width = opts.width ?? WA_COVER_WIDTH;
  const height = opts.height ?? WA_COVER_HEIGHT;
  canvas.width = width;
  canvas.height = height;
  const ctx = getCtx(canvas);
  ctx.clearRect(0, 0, width, height);
  tpl.render(ctx, {
    width,
    height,
    title: opts.title,
    subtitle: opts.subtitle,
    palette: WA_MOOD_PALETTES[opts.mood ?? "neutral"],
  });
}

export function renderIllustrationToCanvas(
  canvas: HTMLCanvasElement,
  opts: RenderIllustrationOpts,
) {
  const tpl = findIllustrationTemplate(opts.layout);
  const width = opts.width ?? WA_ILLUSTRATION_WIDTH;
  const height = opts.height ?? WA_ILLUSTRATION_HEIGHT;
  canvas.width = width;
  canvas.height = height;
  const ctx = getCtx(canvas);
  ctx.clearRect(0, 0, width, height);
  tpl.render(ctx, {
    width,
    height,
    title: opts.title,
    caption: opts.caption,
    keywords: opts.keywords,
    palette: WA_MOOD_PALETTES[opts.mood],
  });
}

function loadImage(src: Blob | HTMLImageElement | ImageBitmap): Promise<CanvasImageSource> {
  if (src instanceof HTMLImageElement || (typeof ImageBitmap !== "undefined" && src instanceof ImageBitmap)) {
    return Promise.resolve(src);
  }
  return createImageBitmap(src);
}

/** cover 裁切：填满画布（可能裁边） */
function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  width: number,
  height: number,
) {
  const iw = "width" in img ? Number(img.width) : width;
  const ih = "height" in img ? Number(img.height) : height;
  const scale = Math.max(width / iw, height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  subtitle?: string,
) {
  // 底部渐变遮罩，保证白字可读
  const g = ctx.createLinearGradient(0, height * 0.45, 0, height);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.55, "rgba(0,0,0,0.45)");
  g.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = g;
  ctx.fillRect(0, height * 0.45, width, height * 0.55);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 42px 'Inter','Noto Sans SC',system-ui,sans-serif";
  const maxW = width - 96;
  const chars = Array.from(title || "未命名");
  const lines: string[] = [];
  let cur = "";
  for (const ch of chars) {
    const test = cur + ch;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = ch;
      if (lines.length >= 2) break;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < 3) lines.push(cur);

  const startY = height - (subtitle?.trim() ? 88 : 56);
  lines.forEach((line, i) => {
    ctx.fillText(line, 48, startY - (lines.length - 1 - i) * 48);
  });

  if (subtitle?.trim()) {
    ctx.font = "600 18px 'Inter','Noto Sans SC',system-ui,sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText(subtitle.trim().slice(0, 40), 48, height - 36);
  }
}

/** 将任意图合成到封面尺寸，可选叠字 */
export async function composeCoverFromImage(
  canvas: HTMLCanvasElement,
  source: Blob | HTMLImageElement | ImageBitmap,
  opts: ComposeCoverFromImageOpts,
) {
  const width = opts.width ?? WA_COVER_WIDTH;
  const height = opts.height ?? WA_COVER_HEIGHT;
  canvas.width = width;
  canvas.height = height;
  const ctx = getCtx(canvas);
  ctx.clearRect(0, 0, width, height);
  const img = await loadImage(source);
  drawCoverFit(ctx, img, width, height);
  if (opts.overlayText !== false) {
    drawTextOverlay(ctx, width, height, opts.title, opts.subtitle);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas 导出失败"));
        return;
      }
      resolve(blob);
    }, type);
  });
}

/** 渲染封面并保存为 asset，返回 asset:// ref */
export async function renderCoverBlobAndSave(opts: RenderCoverOpts): Promise<string> {
  const canvas = document.createElement("canvas");
  renderCoverToCanvas(canvas, opts);
  const blob = await canvasToBlob(canvas);
  return saveAssetFromBlob(blob, `wa-cover-${Date.now()}.png`);
}

/** 从图合成封面并落盘 */
export async function composeCoverBlobAndSave(
  source: Blob,
  opts: ComposeCoverFromImageOpts,
): Promise<string> {
  const canvas = document.createElement("canvas");
  await composeCoverFromImage(canvas, source, opts);
  const blob = await canvasToBlob(canvas);
  return saveAssetFromBlob(blob, `wa-cover-${Date.now()}.png`);
}

/** 渲染单张配图并保存为 asset，返回 asset:// ref */
export async function renderIllustrationBlobAndSave(
  opts: RenderIllustrationOpts,
): Promise<string> {
  const canvas = document.createElement("canvas");
  renderIllustrationToCanvas(canvas, opts);
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], `wa-illust-${Date.now()}.png`, { type: "image/png" });
  return saveAsset(file);
}

export function useWaCanvasRenderer() {
  return {
    renderCoverToCanvas,
    renderIllustrationToCanvas,
    composeCoverFromImage,
    canvasToBlob,
    renderCoverBlobAndSave,
    composeCoverBlobAndSave,
    renderIllustrationBlobAndSave,
    toAssetRef,
    WA_COVER_TEMPLATES,
    WA_ILLUSTRATION_TEMPLATES,
  };
}

export type WaIllustrationPromptWithRef = WaIllustrationPrompt;
