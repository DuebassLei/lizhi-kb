import { isAssetRef, resolveAssetUrl } from "../services/assetService";

async function assetRefToDataUrl(ref: string): Promise<string> {
  const url = await resolveAssetUrl(ref);
  if (url.startsWith("data:")) return url;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("图片读取失败");
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("图片读取失败"));
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
}

/** 将 Markdown 中的 asset:// 图片引用替换为 data URL，便于 HTML / Word 导出嵌入 */
export async function embedAssetsInMarkdown(content: string): Promise<string> {
  const refs = [...content.matchAll(/!\[[^\]]*\]\((asset:\/\/[^)]+)\)/g)]
    .map((m) => m[1])
    .filter((ref): ref is string => !!ref && isAssetRef(ref));

  let result = content;
  for (const ref of new Set(refs)) {
    try {
      const dataUrl = await assetRefToDataUrl(ref);
      result = result.split(ref).join(dataUrl);
    } catch {
      // Keep asset:// ref when resolution fails
    }
  }
  return result;
}

export type DocxImageType = "jpg" | "png" | "gif" | "bmp";

export function parseDataUrlImage(
  dataUrl: string,
): { bytes: Uint8Array; type: DocxImageType } | null {
  const match = dataUrl.match(/^data:image\/([\w+.-]+);base64,(.+)$/);
  if (!match) return null;

  let type = match[1].toLowerCase();
  if (type === "jpeg") type = "jpg";
  if (!["jpg", "png", "gif", "bmp"].includes(type)) return null;

  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, type: type as DocxImageType };
}

const DOCX_IMAGE_MAX_WIDTH = 520;

export function scaleImageDimensions(
  width: number,
  height: number,
  maxWidth = DOCX_IMAGE_MAX_WIDTH,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: maxWidth, height: Math.round(maxWidth * 0.75) };
  if (width <= maxWidth) return { width, height };
  const scale = maxWidth / width;
  return { width: maxWidth, height: Math.max(1, Math.round(height * scale)) };
}

export function readImageDimensionsFromDataUrl(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("图片尺寸读取失败"));
    img.src = dataUrl;
  });
}
