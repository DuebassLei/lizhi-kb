import { domToBlob } from "modern-screenshot";
import html2canvas from "html2canvas-pro";
import { blobToUint8Array, saveBytesWithDialog } from "./writeExportBytes";

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}

type LayoutSnap = {
  scaleWrap: HTMLElement | null;
  frame: HTMLElement | null;
  wrapTransform: string;
  frameWidth: string;
  frameHeight: string;
  frameOverflow: string;
  stageOverflow: string;
  stage: HTMLElement | null;
};

/** 预览结构：.kc-card-frame > scaleWrap > .knowledge-card */
function prepareNativeLayout(cardEl: HTMLElement): LayoutSnap {
  const scaleWrap = cardEl.parentElement;
  const frame = scaleWrap?.parentElement ?? null;
  const stage = cardEl.closest(".kc-studio__stage") as HTMLElement | null;

  const snap: LayoutSnap = {
    scaleWrap,
    frame,
    wrapTransform: scaleWrap?.style.transform ?? "",
    frameWidth: frame?.style.width ?? "",
    frameHeight: frame?.style.height ?? "",
    frameOverflow: frame?.style.overflow ?? "",
    stageOverflow: stage?.style.overflow ?? "",
    stage,
  };

  const width =
    cardEl.offsetWidth ||
    Number.parseInt(getComputedStyle(cardEl).width, 10) ||
    1080;
  const height =
    cardEl.offsetHeight ||
    Number.parseInt(getComputedStyle(cardEl).height, 10) ||
    1440;

  // 去掉预览缩放，按真实卡片尺寸布局（有全屏遮罩，用户看不到闪动）
  if (scaleWrap) {
    scaleWrap.style.transform = "none";
  }
  if (frame) {
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.style.overflow = "hidden";
  }
  if (stage) {
    stage.style.overflow = "hidden";
  }

  cardEl.style.transform = "none";
  cardEl.scrollTop = 0;
  cardEl.scrollLeft = 0;

  return snap;
}

function restoreLayout(cardEl: HTMLElement, snap: LayoutSnap): void {
  if (snap.scaleWrap) {
    snap.scaleWrap.style.transform = snap.wrapTransform;
  }
  if (snap.frame) {
    snap.frame.style.width = snap.frameWidth;
    snap.frame.style.height = snap.frameHeight;
    snap.frame.style.overflow = snap.frameOverflow;
  }
  if (snap.stage) {
    snap.stage.style.overflow = snap.stageOverflow;
  }
  // CardRenderer 自身一般无 transform；清掉导出时写入的 inline
  if (cardEl.style.transform === "none") {
    cardEl.style.removeProperty("transform");
  }
}

async function captureWithModernScreenshot(cardEl: HTMLElement, scale: number): Promise<Blob> {
  const blob = await domToBlob(cardEl, {
    type: "image/png",
    quality: 1,
    scale,
    style: {
      transform: "none",
      margin: "0",
    },
    filter: (el) => {
      if (!(el instanceof Element)) return true;
      // 不截「内容已缩放」提示角标
      return !el.classList.contains("knowledge-card__scale-warn");
    },
  });
  if (!blob) throw new Error("PNG 生成失败");
  return blob;
}

async function captureWithHtml2Canvas(cardEl: HTMLElement, scale: number): Promise<Blob> {
  const width = cardEl.offsetWidth;
  const height = cardEl.offsetHeight;
  const canvas = await html2canvas(cardEl, {
    scale,
    backgroundColor: null,
    useCORS: true,
    logging: false,
    // SVG foreignObject 路径更接近浏览器真实排版
    foreignObjectRendering: true,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
  });
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 生成失败"))), "image/png");
  });
  return blob;
}

/**
 * 截取单张知识卡片：在导出遮罩下临时取消预览缩放，截「所见即所得」的真实 DOM。
 */
export async function captureCardPng(
  cardEl: HTMLElement,
  scale: number = 2,
): Promise<Blob> {
  const snap = prepareNativeLayout(cardEl);
  try {
    await yieldToUi();
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await yieldToUi();

    try {
      return await captureWithModernScreenshot(cardEl, scale);
    } catch {
      // 兜底：部分环境 foreignObject 失败时回退
      return await captureWithHtml2Canvas(cardEl, scale);
    }
  } finally {
    restoreLayout(cardEl, snap);
  }
}

export async function exportCardAsPNG(
  cardEl: HTMLElement,
  filename: string,
  scale: number = 2,
): Promise<boolean> {
  const blob = await captureCardPng(cardEl, scale);
  const bytes = await blobToUint8Array(blob);
  return saveBytesWithDialog(bytes, filename, [
    { name: "PNG 图片", extensions: ["png"] },
  ]);
}

export async function exportCardsAsPNGSequence(
  cardEls: HTMLElement[],
  baseFilename: string,
  scale: number = 2,
  onProgress?: (current: number, total: number) => void,
): Promise<number> {
  let saved = 0;
  for (let i = 0; i < cardEls.length; i += 1) {
    onProgress?.(i + 1, cardEls.length);
    await yieldToUi();
    const pageNum = String(i + 1).padStart(2, "0");
    const ok = await exportCardAsPNG(
      cardEls[i]!,
      `${baseFilename}-${pageNum}.png`,
      scale,
    );
    if (ok) saved += 1;
    else break;
  }
  return saved;
}
