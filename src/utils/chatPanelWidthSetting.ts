const KEY = "lizhi-kb-chat-panel-width";

export const CHAT_PANEL_WIDTH_DEFAULT = 320;
export const CHAT_PANEL_WIDTH_MIN = 280;
export const CHAT_PANEL_WIDTH_MAX = 560;

export function loadStoredChatPanelWidth(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return CHAT_PANEL_WIDTH_DEFAULT;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return CHAT_PANEL_WIDTH_DEFAULT;
    return clampChatPanelWidth(n);
  } catch {
    return CHAT_PANEL_WIDTH_DEFAULT;
  }
}

export function saveChatPanelWidth(px: number): void {
  try {
    localStorage.setItem(KEY, String(clampChatPanelWidth(px)));
  } catch {
    /* ignore quota */
  }
}

export function clampChatPanelWidth(px: number): number {
  return Math.min(
    CHAT_PANEL_WIDTH_MAX,
    Math.max(CHAT_PANEL_WIDTH_MIN, Math.round(px)),
  );
}
