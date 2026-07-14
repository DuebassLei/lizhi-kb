import { onBeforeUnmount, onMounted } from "vue";
import { useFoldersStore } from "../stores/folders";
import { useDocumentsStore } from "../stores/documents";
import { useVaultStore } from "../stores/vault";
import { reloadVaultUiStateFromDisk } from "../services/vaultUiStateService";
import { isTauriRuntime } from "../services/vaultService";
import { loadFolderState } from "../utils/folderTree";

/** 窗口可见时轮询磁盘文件夹树，承接 MCP ensure 写入 */
const POLL_MS = 8_000;

/**
 * 从磁盘拉取 vault-ui-state（含 MCP 注册的文件夹树），
 * 避免侧栏滞后导致文档误入「收件箱」。
 */
export function useVaultUiStateSync() {
  let syncing = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastFolderSignature = "";

  function folderSignature(): string {
    try {
      const state = loadFolderState();
      return state.folders
        .map((f) => f.id)
        .sort()
        .join("\0");
    } catch {
      return "";
    }
  }

  async function syncFromDisk(forceTreeRefresh = false) {
    if (!isTauriRuntime() || syncing) return;
    const vault = useVaultStore();
    if (vault.isLocked) return;

    syncing = true;
    try {
      const before = folderSignature();
      await reloadVaultUiStateFromDisk();
      useFoldersStore().load();
      const after = folderSignature();
      if (forceTreeRefresh || after !== before || after !== lastFolderSignature) {
        lastFolderSignature = after;
        await useDocumentsStore().fetchTree();
      } else {
        lastFolderSignature = after;
      }
    } catch {
      // 磁盘不可用时保持内存状态
    } finally {
      syncing = false;
    }
  }

  function onVisibilityChange() {
    if (!document.hidden) {
      void syncFromDisk(true);
      startPoll();
    } else {
      stopPoll();
    }
  }

  function onWindowFocus() {
    void syncFromDisk(true);
  }

  function startPoll() {
    stopPoll();
    if (document.hidden) return;
    pollTimer = setInterval(() => {
      void syncFromDisk(false);
    }, POLL_MS);
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  onMounted(() => {
    lastFolderSignature = folderSignature();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    startPoll();
  });

  onBeforeUnmount(() => {
    stopPoll();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("focus", onWindowFocus);
  });
}
