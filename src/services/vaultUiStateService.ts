import { tauriInvoke } from "../composables/useTauriCommand";
import type { FolderUiState } from "../types/folder";
import type { DocTagsMap } from "../utils/documentTags";
import { loadFolderState } from "../utils/folderTree";
import { loadChatSessionStore, type ChatSessionStore } from "../utils/chatSessionStorage";
import { loadInsightsHeroBackground } from "../utils/insightsHeroBackground";
import { loadGraphNodePositions } from "../composables/useSvgPanZoom";
import { loadPinnedIds } from "../utils/pinnedDocs";
import { loadRecentDocIds } from "../utils/recentDocs";
import { isTauriRuntime } from "./vaultService";

const FOLDERS_KEY = "lizhi-kb-folders";
const TAGS_KEY = "lizhi-kb-doc-tags";
const CHAT_KEY = "lizhi-kb-chat-sessions-v1";
const HERO_BG_KEY = "lizhi-kb-insights-hero-bg";
const GRAPH_POS_KEY = "lizhi-kb-graph-node-pos";
const PINNED_KEY = "lizhi-kb-pinned";
const RECENT_KEY = "lizhi-kb-recent-docs";

/** 看板背景 data URL 超过此大小时不写入备份（避免 .lizhi 膨胀） */
const HERO_BG_BACKUP_MAX_BYTES = 2 * 1024 * 1024;

export interface VaultUiState {
  schemaVersion?: number;
  folders?: FolderUiState;
  documentTags?: DocTagsMap;
  chatSessions?: ChatSessionStore;
  insightsHeroBackground?: string | null;
  graphNodePositions?: Record<string, { x: number; y: number }>;
  pinnedDocIds?: string[];
  recentDocIds?: string[];
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function heroBgForBackup(): string | null {
  const bg = loadInsightsHeroBackground();
  if (!bg) return null;
  if (bg.length > HERO_BG_BACKUP_MAX_BYTES) return null;
  return bg;
}

export function buildVaultUiStateFromLocal(): VaultUiState {
  const folders = loadFolderState();
  let documentTags: DocTagsMap = {};
  try {
    const raw = localStorage.getItem(TAGS_KEY);
    if (raw) documentTags = JSON.parse(raw) as DocTagsMap;
  } catch {
    documentTags = {};
  }
  return {
    schemaVersion: 2,
    folders,
    documentTags,
    chatSessions: loadChatSessionStore(),
    insightsHeroBackground: heroBgForBackup(),
    graphNodePositions: loadGraphNodePositions(),
    pinnedDocIds: loadPinnedIds(),
    recentDocIds: loadRecentDocIds(),
  };
}

export function applyVaultUiStateToLocal(state: VaultUiState): void {
  if (state.folders) {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(state.folders));
  }
  if (state.documentTags) {
    localStorage.setItem(TAGS_KEY, JSON.stringify(state.documentTags));
  }
  if (state.chatSessions) {
    localStorage.setItem(CHAT_KEY, JSON.stringify(state.chatSessions));
  }
  if (state.insightsHeroBackground) {
    localStorage.setItem(HERO_BG_KEY, state.insightsHeroBackground);
  }
  if (state.graphNodePositions) {
    localStorage.setItem(GRAPH_POS_KEY, JSON.stringify(state.graphNodePositions));
  }
  if (state.pinnedDocIds) {
    localStorage.setItem(PINNED_KEY, JSON.stringify(state.pinnedDocIds));
  }
  if (state.recentDocIds) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(state.recentDocIds));
  }
}

function diskStateHasContent(state: VaultUiState): boolean {
  if (state.folders && state.folders.folders.length > 0) return true;
  if (state.documentTags && Object.keys(state.documentTags).length > 0) return true;
  if (state.chatSessions) {
    const ws = state.chatSessions.workspace?.sessions?.length ?? 0;
    const st = state.chatSessions.standalone?.sessions?.length ?? 0;
    if (ws + st > 0) return true;
  }
  if (state.insightsHeroBackground) return true;
  if (state.graphNodePositions && Object.keys(state.graphNodePositions).length > 0) return true;
  if (state.pinnedDocIds && state.pinnedDocIds.length > 0) return true;
  if (state.recentDocIds && state.recentDocIds.length > 0) return true;
  return false;
}

/** 启动时：磁盘 SSOT → localStorage；无磁盘快照则把本地推到磁盘 */
export async function hydrateVaultUiState(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const disk = await tauriInvoke<VaultUiState>("get_vault_ui_state");
    if (diskStateHasContent(disk)) {
      applyVaultUiStateToLocal(disk);
      return;
    }
    await persistVaultUiStateNow();
  } catch {
    // 磁盘不可用时仍可用 localStorage
  }
}

export function schedulePersistVaultUiState(): void {
  if (!isTauriRuntime()) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistVaultUiStateNow();
  }, 400);
}

export async function persistVaultUiStateNow(): Promise<void> {
  if (!isTauriRuntime()) return;
  const state = buildVaultUiStateFromLocal();
  await tauriInvoke("save_vault_ui_state", { state });
}

/** 合并恢复设置后重新加载 UI 状态 */
export async function reloadVaultUiStateFromDisk(): Promise<void> {
  if (!isTauriRuntime()) return;
  const disk = await tauriInvoke<VaultUiState>("get_vault_ui_state");
  applyVaultUiStateToLocal(disk);
}
