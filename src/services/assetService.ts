import { convertFileSrc } from "@tauri-apps/api/core";
import { tauriInvoke } from "../composables/useTauriCommand";
import { compressImageForAsset, compressDataUrlForWechat, urlToDataUrl } from "../utils/imageDataUrl";

export const ASSET_PREFIX = "asset://";

const ASSETS_STORAGE_KEY = "lizhi-kb-assets";

type AssetStore = Record<string, string>;

function isTauriRuntime(): boolean {
  return !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

export function isAssetRef(src: string): boolean {
  return src.startsWith(ASSET_PREFIX);
}

export function toAssetRef(id: string): string {
  return `${ASSET_PREFIX}${id}`;
}

export function parseAssetId(ref: string): string | null {
  if (!isAssetRef(ref)) return null;
  const id = ref.slice(ASSET_PREFIX.length);
  return id || null;
}

function loadLocalAssets(): AssetStore {
  try {
    const raw = localStorage.getItem(ASSETS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AssetStore;
  } catch {
    return {};
  }
}

function saveLocalAssets(store: AssetStore): void {
  localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(store));
}

function localSaveAsset(dataUrl: string, ext: string): string {
  const id = `${crypto.randomUUID()}.${ext}`;
  const store = loadLocalAssets();
  store[id] = dataUrl;
  saveLocalAssets(store);
  return id;
}

function localResolveAsset(id: string): string {
  const url = loadLocalAssets()[id];
  if (!url) throw new Error("找不到图片资源");
  return url;
}

async function tauriSaveAsset(bytes: Uint8Array, ext: string): Promise<string> {
  return tauriInvoke<string>("save_asset", {
    bytes: Array.from(bytes),
    extension: ext,
  });
}

async function tauriResolveAsset(id: string): Promise<string> {
  const path = await tauriInvoke<string>("get_asset_path", { id });
  return convertFileSrc(path);
}

export async function saveAsset(file: File): Promise<string> {
  const { bytes, ext, dataUrl } = await compressImageForAsset(file);

  if (isTauriRuntime()) {
    try {
      const id = await tauriSaveAsset(bytes, ext);
      return toAssetRef(id);
    } catch {
      throw new Error("图片保存失败，请重试");
    }
  }

  try {
    const id = localSaveAsset(dataUrl, ext);
    return toAssetRef(id);
  } catch {
    throw new Error("图片保存失败，请重试");
  }
}

export async function resolveAssetUrl(src: string): Promise<string> {
  if (!isAssetRef(src)) return src;

  const id = parseAssetId(src);
  if (!id) return src;

  if (isTauriRuntime()) {
    try {
      return await tauriResolveAsset(id);
    } catch {
      return src;
    }
  }

  try {
    return localResolveAsset(id);
  } catch {
    return src;
  }
}

/** 将 asset:// 或本地 asset 协议 URL 转为 data URL，供微信公众号粘贴 */
export async function resolveAssetAsDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;

  const url = isAssetRef(src) ? await resolveAssetUrl(src) : src;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("asset://")) {
    throw new Error("找不到图片资源");
  }

  return compressDataUrlForWechat(await urlToDataUrl(url));
}
