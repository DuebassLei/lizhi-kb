const ASSET_ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const HERO_ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_WIDTH = 1920;
const JPEG_QUALITY = 0.85;

/** 微信粘贴：单图 data URL 字符上限（约 650KB 原图，留余量给整篇 HTML） */
export const WECHAT_MAX_IMAGE_DATA_URL_CHARS = 900_000;
const WECHAT_MAX_WIDTH = 1080;
const WECHAT_MIN_WIDTH = 480;
const WECHAT_JPEG_QUALITIES = [0.85, 0.72, 0.6, 0.48, 0.38, 0.3];

export interface CompressedImage {
  bytes: Uint8Array;
  mime: string;
  ext: string;
  dataUrl: string;
}

export async function compressImageForAsset(file: File): Promise<CompressedImage> {
  if (!ASSET_ACCEPTED_TYPES.has(file.type)) {
    throw new Error("仅支持 JPG、PNG、WebP、GIF 格式");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("图片过大，请选择 10MB 以内的文件");
  }

  if (file.type === "image/gif") {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("图片不能超过 5MB");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dataUrl = await fileToDataUrl(file);
    return { bytes, mime: file.type, ext: "gif", dataUrl };
  }

  const bitmap = await loadImageSource(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_WIDTH);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法处理图片");

  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const ext = mime === "image/png" ? "png" : "jpg";
  const dataUrl = canvas.toDataURL(mime, mime === "image/jpeg" ? JPEG_QUALITY : undefined);
  const bytes = dataUrlToBytes(dataUrl);
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("图片不能超过 5MB");
  }
  return { bytes, mime, ext, dataUrl };
}

export async function fileToHeroBackgroundDataUrl(file: File): Promise<string> {
  if (!HERO_ACCEPTED_TYPES.has(file.type)) {
    throw new Error("仅支持 JPG、PNG、WebP 格式");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("图片过大，请选择 10MB 以内的文件");
  }

  const bitmap = await loadImageSource(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_WIDTH);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法处理图片");

  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  if (dataUrl.length > 4_500_000) {
    throw new Error("图片处理后仍过大，请选择更小或更简单的图片");
  }
  return dataUrl;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** 将 Blob 转为 data URL（供微信粘贴等场景内联图片） */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("无法读取图片"));
    };
    reader.onerror = () => reject(new Error("无法读取图片"));
    reader.readAsDataURL(blob);
  });
}

/** 将可访问的图片 URL（含 asset.localhost / blob:）转为 data URL */
export async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`图片读取失败 (${res.status})`);
  return blobToDataUrl(await res.blob());
}

/** 将 data URL 压缩到微信粘贴可接受的大小（过大时自动缩小尺寸与质量） */
export async function compressDataUrlForWechat(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  if (dataUrl.length <= WECHAT_MAX_IMAGE_DATA_URL_CHARS) return dataUrl;

  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const source = await loadImageSourceFromBlob(blob);

  try {
    return await compressImageSourceForWechat(source);
  } finally {
    if ("close" in source && typeof source.close === "function") {
      source.close();
    }
  }
}

/** URL → data URL，并按微信限制压缩 */
export async function urlToDataUrlForWechat(url: string): Promise<string> {
  const raw = await urlToDataUrl(url);
  return compressDataUrlForWechat(raw);
}

async function compressImageSourceForWechat(
  source: ImageBitmap | HTMLImageElement,
): Promise<string> {
  const srcW = source.width;
  const srcH = source.height;
  const widthSteps = [WECHAT_MAX_WIDTH, 960, 800, 640, WECHAT_MIN_WIDTH];

  for (const maxW of widthSteps) {
    const { width, height } = fitWithin(srcW, srcH, maxW);
    for (const quality of WECHAT_JPEG_QUALITIES) {
      const dataUrl = renderJpegDataUrl(source, width, height, quality);
      if (dataUrl.length <= WECHAT_MAX_IMAGE_DATA_URL_CHARS) {
        return dataUrl;
      }
    }
  }

  const { width, height } = fitWithin(srcW, srcH, WECHAT_MIN_WIDTH);
  const fallback = renderJpegDataUrl(
    source,
    width,
    height,
    WECHAT_JPEG_QUALITIES[WECHAT_JPEG_QUALITIES.length - 1],
  );
  if (fallback.length > WECHAT_MAX_IMAGE_DATA_URL_CHARS) {
    throw new Error("图片过大，压缩后仍超出微信粘贴限制，请换更小的图片");
  }
  return fallback;
}

function renderJpegDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法处理图片");
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("无法读取图片"));
    };
    reader.onerror = () => reject(new Error("无法读取图片"));
    reader.readAsDataURL(file);
  });
}

function fitWithin(w: number, h: number, maxW: number): { width: number; height: number } {
  if (w <= maxW) return { width: w, height: h };
  const scale = maxW / w;
  return { width: maxW, height: Math.round(h * scale) };
}

async function loadImageSource(file: File): Promise<ImageBitmap | HTMLImageElement> {
  return loadImageSourceFromBlob(file);
}

async function loadImageSourceFromBlob(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob);
  }
  return loadViaBlobUrl(blob);
}

function loadViaBlobUrl(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片"));
    };
    img.src = url;
  });
}
