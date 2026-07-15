import { saveAsset, toAssetRef } from "../../services/assetService";
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

async function blobToAssetRef(blob: Blob): Promise<string> {
  const file = new File([blob], `wa-${Date.now()}.png`, { type: "image/png" });
  return saveAsset(file);
}

/** 渲染封面并保存为 asset，返回 asset:// ref */
export async function renderCoverBlobAndSave(opts: RenderCoverOpts): Promise<string> {
  const canvas = document.createElement("canvas");
  renderCoverToCanvas(canvas, opts);
  const blob = await canvasToBlob(canvas);
  return blobToAssetRef(blob);
}

/** 渲染单张配图并保存为 asset，返回 asset:// ref */
export async function renderIllustrationBlobAndSave(
  opts: RenderIllustrationOpts,
): Promise<string> {
  const canvas = document.createElement("canvas");
  renderIllustrationToCanvas(canvas, opts);
  const blob = await canvasToBlob(canvas);
  return blobToAssetRef(blob);
}

export function useWaCanvasRenderer() {
  return {
    renderCoverToCanvas,
    renderIllustrationToCanvas,
    canvasToBlob,
    renderCoverBlobAndSave,
    renderIllustrationBlobAndSave,
    toAssetRef,
    WA_COVER_TEMPLATES,
    WA_ILLUSTRATION_TEMPLATES,
  };
}

export type WaIllustrationPromptWithRef = WaIllustrationPrompt;
