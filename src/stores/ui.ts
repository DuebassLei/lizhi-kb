import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { fileToHeroBackgroundDataUrl } from "../utils/imageDataUrl";
import {
  clearInsightsHeroBackground,
  loadInsightsHeroBackground,
  saveInsightsHeroBackground,
} from "../utils/insightsHeroBackground";
import { applyTheme, loadStoredTheme } from "../utils/theme";
import {
  loadStoredWatermarkNickname,
  loadStoredWatermarkOn,
  normalizeWatermarkNickname,
  saveWatermarkNickname,
  saveWatermarkOn,
} from "../utils/watermarkSetting";
import { loadStoredSplitPreview, saveSplitPreview } from "../utils/splitPreviewSetting";
import { loadStoredSplitGraph, saveSplitGraph } from "../utils/splitGraphSetting";
import {
  loadStoredSplitPreviewKind,
  saveSplitPreviewKind,
  type SplitPreviewKind,
} from "../utils/splitPreviewKindSetting";
import {
  loadStoredSidebarCollapsed,
  saveSidebarCollapsed,
} from "../utils/sidebarCollapsedSetting";
import {
  loadStoredQuickNavVisibility,
  saveQuickNavVisibility,
} from "../utils/quickNavSetting";
import type { QuickNavId, QuickNavVisibility } from "../constants/quickNav";

export type EditorMode = "edit" | "preview";
export type WorkspaceViewMode = "edit" | "graph" | "mindmap";
export type ThemeId = "dark" | "light" | "warm" | "eye" | "reading";

export const useUiStore = defineStore("ui", () => {
  const theme = ref<ThemeId>(loadStoredTheme());
  const watermarkOn = ref(loadStoredWatermarkOn());
  const watermarkNickname = ref(loadStoredWatermarkNickname());
  const workspaceViewMode = ref<WorkspaceViewMode>("edit");
  const sidebarCollapsed = ref(loadStoredSidebarCollapsed());
  const quickNavVisibility = ref<QuickNavVisibility>(loadStoredQuickNavVisibility());
  const backlinksVisible = ref(false);
  const chatPanelVisible = ref(false);
  const commandPaletteOpen = ref(false);
  const focusMode = ref(false);
  const typewriterMode = ref(false);
  const tocVisible = ref(false);
  const insightsHeroBackground = ref<string | null>(loadInsightsHeroBackground());
  const splitPreviewVisible = ref(loadStoredSplitPreview());
  const splitGraphVisible = ref(loadStoredSplitGraph());
  const splitPreviewKind = ref<SplitPreviewKind>(loadStoredSplitPreviewKind());
  const previewOnlyMode = ref(false);
  const toast = ref<{ type: "success" | "error"; message: string } | null>(null);
  const pendingHeadingScroll = ref<string | null>(null);
  /** 导图正文/列表节点：按行号滚到编辑器 */
  const pendingLineScroll = ref<number | null>(null);
  /** 侧栏等非编辑器区域请求在光标处插入 markdown */
  const pendingEditorInsert = ref<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  watch(theme, (t) => applyTheme(t), { immediate: false });
  watch(watermarkOn, (on) => saveWatermarkOn(on));
  watch(watermarkNickname, (nickname) => saveWatermarkNickname(nickname));
  watch(splitPreviewVisible, (visible) => saveSplitPreview(visible));
  watch(splitGraphVisible, (visible) => saveSplitGraph(visible));
  watch(splitPreviewKind, (kind) => saveSplitPreviewKind(kind));
  watch(sidebarCollapsed, (collapsed) => saveSidebarCollapsed(collapsed));
  watch(quickNavVisibility, (visibility) => saveQuickNavVisibility(visibility), { deep: true });

  function setInsightsHeroBackground(dataUrl: string | null) {
    insightsHeroBackground.value = dataUrl;
    if (dataUrl) saveInsightsHeroBackground(dataUrl);
    else clearInsightsHeroBackground();
  }

  async function pickInsightsHeroBackground(file: File) {
    const dataUrl = await fileToHeroBackgroundDataUrl(file);
    setInsightsHeroBackground(dataUrl);
  }

  function resetInsightsHeroBackground() {
    setInsightsHeroBackground(null);
  }

  function setWorkspaceView(mode: WorkspaceViewMode) {
    workspaceViewMode.value = mode;
  }

  function toggleSidebarCollapsed() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function setSidebarCollapsed(collapsed: boolean) {
    sidebarCollapsed.value = collapsed;
  }

  function setQuickNavVisible(id: QuickNavId, visible: boolean) {
    quickNavVisibility.value = { ...quickNavVisibility.value, [id]: visible };
  }

  function setQuickNavVisibility(visibility: QuickNavVisibility) {
    quickNavVisibility.value = { ...visibility };
  }

  function toggleFocusMode() {
    focusMode.value = !focusMode.value;
  }

  function toggleTypewriterMode() {
    typewriterMode.value = !typewriterMode.value;
  }

  function toggleToc() {
    tocVisible.value = !tocVisible.value;
  }

  function toggleSplitPreview() {
    splitPreviewVisible.value = !splitPreviewVisible.value;
    if (!splitPreviewVisible.value) previewOnlyMode.value = false;
  }

  function setSplitPreview(visible: boolean) {
    splitPreviewVisible.value = visible;
    if (!visible) previewOnlyMode.value = false;
  }

  function togglePreviewOnly() {
    if (previewOnlyMode.value) {
      previewOnlyMode.value = false;
      splitPreviewVisible.value = false;
      return;
    }
    previewOnlyMode.value = true;
    splitPreviewVisible.value = true;
  }

  function setPreviewOnly(visible: boolean) {
    previewOnlyMode.value = visible;
    if (visible) splitPreviewVisible.value = true;
  }

  function toggleSplitGraph() {
    splitGraphVisible.value = !splitGraphVisible.value;
    if (splitGraphVisible.value) {
      workspaceViewMode.value = "edit";
    }
  }

  function setSplitGraph(visible: boolean) {
    splitGraphVisible.value = visible;
    if (visible) workspaceViewMode.value = "edit";
  }

  function setSplitPreviewKind(kind: SplitPreviewKind) {
    splitPreviewKind.value = kind;
  }

  function setTheme(t: ThemeId) {
    theme.value = t;
    applyTheme(t);
  }

  function setWatermarkNickname(raw: string) {
    watermarkNickname.value = normalizeWatermarkNickname(raw);
  }

  function toggleChatPanel() {
    chatPanelVisible.value = !chatPanelVisible.value;
    if (chatPanelVisible.value) {
      backlinksVisible.value = false;
    }
  }

  function setChatPanelVisible(visible: boolean) {
    chatPanelVisible.value = visible;
    if (visible) {
      backlinksVisible.value = false;
    }
  }

  function toggleBacklinksPanel() {
    backlinksVisible.value = !backlinksVisible.value;
    if (backlinksVisible.value) {
      chatPanelVisible.value = false;
    }
  }

  function showToast(type: "success" | "error", message: string) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.value = { type, message };
    toastTimer = setTimeout(() => {
      toast.value = null;
      toastTimer = null;
    }, 4000);
  }

  function requestHeadingScroll(text: string) {
    pendingHeadingScroll.value = text.trim();
  }

  function clearHeadingScroll() {
    pendingHeadingScroll.value = null;
  }

  function requestLineScroll(lineIndex: number) {
    if (!Number.isFinite(lineIndex) || lineIndex < 0) return;
    pendingLineScroll.value = Math.floor(lineIndex);
  }

  function clearLineScroll() {
    pendingLineScroll.value = null;
  }

  function requestEditorInsert(markdown: string) {
    const trimmed = markdown.trim();
    if (!trimmed) return;
    pendingEditorInsert.value = trimmed;
  }

  function clearEditorInsert() {
    pendingEditorInsert.value = null;
  }

  return {
    theme,
    splitPreviewVisible,
    splitGraphVisible,
    splitPreviewKind,
    previewOnlyMode,
    watermarkOn,
    watermarkNickname,
    workspaceViewMode,
    sidebarCollapsed,
    quickNavVisibility,
    backlinksVisible,
    chatPanelVisible,
    toggleChatPanel,
    setChatPanelVisible,
    toggleBacklinksPanel,
    commandPaletteOpen,
    focusMode,
    typewriterMode,
    tocVisible,
    insightsHeroBackground,
    setInsightsHeroBackground,
    pickInsightsHeroBackground,
    resetInsightsHeroBackground,
    setWorkspaceView,
    toggleSidebarCollapsed,
    setSidebarCollapsed,
    setQuickNavVisible,
    setQuickNavVisibility,
    toggleFocusMode,
    toggleTypewriterMode,
    toggleToc,
    toggleSplitPreview,
    setSplitPreview,
    toggleSplitGraph,
    setSplitGraph,
    togglePreviewOnly,
    setPreviewOnly,
    setSplitPreviewKind,
    setTheme,
    setWatermarkNickname,
    toast,
    showToast,
    pendingHeadingScroll,
    requestHeadingScroll,
    clearHeadingScroll,
    pendingLineScroll,
    requestLineScroll,
    clearLineScroll,
    pendingEditorInsert,
    requestEditorInsert,
    clearEditorInsert,
  };
});
