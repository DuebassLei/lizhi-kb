const KEY = "lizhi-kb-watermark";
const NICKNAME_KEY = "lizhi-kb-watermark-nickname";

export const WATERMARK_NICKNAME_MAX_LEN = 20;

export function loadStoredWatermarkOn(): boolean {
  return localStorage.getItem(KEY) === "1";
}

export function saveWatermarkOn(on: boolean) {
  localStorage.setItem(KEY, on ? "1" : "0");
}

/** trim 并截断至最大长度；空字符串表示回退默认标识 */
export function normalizeWatermarkNickname(raw: string): string {
  return raw.trim().slice(0, WATERMARK_NICKNAME_MAX_LEN);
}

export function loadStoredWatermarkNickname(): string {
  const stored = localStorage.getItem(NICKNAME_KEY);
  return stored ? normalizeWatermarkNickname(stored) : "";
}

export function saveWatermarkNickname(nickname: string) {
  const normalized = normalizeWatermarkNickname(nickname);
  if (normalized) localStorage.setItem(NICKNAME_KEY, normalized);
  else localStorage.removeItem(NICKNAME_KEY);
}

const EXPORT_WM_KEY = "lizhi-kb-export-watermark";

export function loadExportWatermarkOn(): boolean {
  return localStorage.getItem(EXPORT_WM_KEY) !== "0";
}

export function saveExportWatermarkOn(on: boolean) {
  localStorage.setItem(EXPORT_WM_KEY, on ? "1" : "0");
}

export function buildExportWatermarkLabel(nickname: string): string {
  const name = normalizeWatermarkNickname(nickname) || "狸知";
  const ts = new Date().toLocaleString("zh-CN", { hour12: false });
  return `${name} · ${ts}`;
}
