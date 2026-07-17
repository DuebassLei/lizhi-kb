import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useChatStore } from "./chat";
import { useDocumentsStore } from "./documents";
import { useEditorStore } from "./editor";
import { useUiStore } from "./ui";
import { useVaultStore } from "./vault";
import {
  LLM_AUTO_TARGET,
  buildLlmOptions,
  findLlmOption,
  getAiConfig,
  getCloudFallbackTargets,
  isAutoTarget,
  isRetrievalTarget,
  llmTriggerLabel,
  resolveLlmTarget as resolveConfiguredLlmTarget,
  type AiConfigPublic,
  type LlmOption,
  type LlmTarget,
} from "../services/aiService";
import {
  streamWaIllustrationPrompts,
  streamWaTextStep,
  type WaTextStepId,
} from "../services/writingAssistantService";
import { assembleMarkdown } from "../utils/writingAssistant/assembleMarkdown";
import { WA_DEFAULT_CONFIG } from "../utils/writingAssistant/defaults";
import {
  isOutlineEffectivelyEmpty,
  isOutlineSkeletonOrEmpty,
  recommendFrameworkFromTopic,
  renderOutlineFramework,
  resolveSuggestedFramework,
} from "../utils/writingAssistant/outlineFrameworks";
import type { WaOutlineFramework } from "../types/writingAssistant";
import { markStaleAfter } from "../utils/writingAssistant/stale";
import { WA_BUILTIN_STYLE_PACKS } from "../utils/writingAssistant/stylePacks";
import {
  migrateWaConfig,
  pickStylePack,
} from "../utils/writingAssistant/stylePacks/stylePackUtils";
import type { WaStylePack } from "../utils/writingAssistant/stylePacks/types";
import type { WaStylePackWrite } from "../utils/writingAssistant/stylePacks/types";
import {
  deleteStylePack,
  loadMergedStylePacks,
  resetStylePack,
  saveStylePack,
} from "../services/writingStylePackService";
import {
  WA_STEP_ORDER,
  type WaConfig,
  type WaCoverAiStyle,
  type WaCoverSource,
  type WaCoverTemplateId,
  type WaIllustrationPrompt,
  type WaMood,
  type WaSessionSnapshot,
  type WaStepId,
  type WaTopicCandidate,
} from "../types/writingAssistant";

const DRAFT_KEY = "lizhi-kb-wa-draft";
const DEFAULTS_KEY = "lizhi-kb-wa-defaults";
const LLM_KEY = "lizhi-kb-wa-llm-target";

function loadWaLlmTarget(): LlmTarget {
  try {
    const raw = localStorage.getItem(LLM_KEY);
    if (raw) return raw as LlmTarget;
  } catch {
    /* ignore */
  }
  return LLM_AUTO_TARGET;
}

function saveWaLlmTarget(target: LlmTarget) {
  try {
    localStorage.setItem(LLM_KEY, target);
  } catch {
    /* ignore */
  }
}

function loadDefaults(): WaConfig {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    if (!raw) return { ...WA_DEFAULT_CONFIG };
    return migrateWaConfig(JSON.parse(raw) as Partial<WaConfig> & { stylePreset?: string });
  } catch {
    return { ...WA_DEFAULT_CONFIG };
  }
}

function saveDefaults(cfg: WaConfig) {
  try {
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

function emptySnapshot(config: WaConfig): WaSessionSnapshot {
  return {
    config,
    currentStep: "topic",
    topic: { done: false, stale: false },
    outline: { done: false, stale: false },
    body: { done: false, stale: false },
    humanize: { done: false, stale: false },
    topicCandidates: [],
    illustrations: [],
    coverTemplate: config.defaultCoverTemplate,
    coverSource: "template",
    coverOverlayText: true,
    coverAiStyle: "tech",
    coverMood: "neutral",
    finalizeMode: "create",
  };
}

function migrateCoverFields(snap: WaSessionSnapshot): WaSessionSnapshot {
  const legacyTpl = snap.coverTemplate as string;
  const tplMap: Record<string, WaCoverTemplateId> = {
    plain: "plain",
    grid: "grid",
    accent: "accent",
    banner: "plain",
    centered: "grid",
    splitBar: "accent",
  };
  snap.coverTemplate = tplMap[legacyTpl] ?? "plain";
  if (!snap.coverSource) snap.coverSource = "template";
  if (snap.coverOverlayText == null) snap.coverOverlayText = true;
  if (!snap.coverAiStyle) snap.coverAiStyle = "tech";
  if (!snap.coverMood) snap.coverMood = "neutral";
  return snap;
}

function loadDraft(): WaSessionSnapshot | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as WaSessionSnapshot;
    if (!snap.config) return null;
    snap.config = migrateWaConfig(
      snap.config as WaConfig & { stylePreset?: string },
    );
    return migrateCoverFields(snap);
  } catch {
    return null;
  }
}

function saveDraft(snap: WaSessionSnapshot) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(snap));
  } catch {
    // ignore
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export const useWritingAssistantStore = defineStore("writingAssistant", () => {
  const ui = useUiStore();
  const vault = useVaultStore();
  const documents = useDocumentsStore();
  const editor = useEditorStore();
  const chat = useChatStore();

  const open = ref(false);
  const config = ref<WaConfig>(loadDefaults());
  const snapshot = ref<WaSessionSnapshot>(emptySnapshot(config.value));

  const aiEnabled = ref(false);
  const aiConfigCache = ref<AiConfigPublic | null>(null);
  const llmTarget = ref<LlmTarget>(loadWaLlmTarget());
  const isStreaming = ref(false);
  const streamStep = ref<WaStepId | null>(null);
  const errorMessage = ref<string | null>(null);
  const stylePacks = ref<WaStylePack[]>(WA_BUILTIN_STYLE_PACKS.map((p) => ({ ...p })));
  const stylePacksLoading = ref(false);
  /** 选题采用后关键词推荐的框架（可为空） */
  const topicFrameworkSuggestion = ref<WaOutlineFramework | null>(null);

  let cancelFlag = false;

  /** 写作助手可选模型（排除「仅检索」） */
  const llmOptions = computed<LlmOption[]>(() => {
    const cfg = aiConfigCache.value;
    if (!cfg) return [];
    return buildLlmOptions(cfg).filter((o) => !isRetrievalTarget(o.id));
  });

  const llmLabel = computed(() =>
    llmTriggerLabel(llmTarget.value, llmOptions.value, aiConfigCache.value),
  );

  function reloadFromDraft() {
    const draft = loadDraft();
    if (draft) {
      snapshot.value = draft;
      config.value = draft.config;
    } else {
      snapshot.value = emptySnapshot(config.value);
    }
  }

  async function refreshStylePacks() {
    stylePacksLoading.value = true;
    try {
      const packs = await loadMergedStylePacks();
      stylePacks.value = packs;
      const ids = new Set(packs.map((p) => p.id));
      config.value = migrateWaConfig(
        config.value as WaConfig & { stylePreset?: string },
        ids,
      );
      snapshot.value.config = config.value;
      saveDefaults(config.value);
    } finally {
      stylePacksLoading.value = false;
    }
  }

  function currentStylePack(): WaStylePack {
    return pickStylePack(stylePacks.value, config.value.stylePackId);
  }

  async function saveStylePackToVault(pack: WaStylePackWrite) {
    await saveStylePack(pack);
    await refreshStylePacks();
  }

  async function deleteStylePackFromVault(id: string) {
    await deleteStylePack(id);
    if (config.value.stylePackId === id) {
      updateConfig({ stylePackId: "default" });
    }
    await refreshStylePacks();
  }

  async function resetStylePackInVault(id: string) {
    await resetStylePack(id);
    await refreshStylePacks();
  }

  function persist() {
    saveDraft(snapshot.value);
  }

  function openDialog() {
    if (!aiEnabled.value) {
      // 仍允许打开，UI 会引导去设置
    }
    reloadFromDraft();
    open.value = true;
    void loadAiState();
    void refreshStylePacks();
    if (snapshot.value.currentStep === "outline") {
      ensureOutlineSkeleton();
    }
  }

  function closeDialog() {
    open.value = false;
    persist();
  }

  function abandon() {
    snapshot.value = emptySnapshot(config.value);
    clearDraft();
    errorMessage.value = null;
    isStreaming.value = false;
    streamStep.value = null;
    cancelFlag = false;
  }

  function updateConfig(patch: Partial<WaConfig>) {
    config.value = { ...config.value, ...patch };
    saveDefaults(config.value);
    snapshot.value.config = config.value;
    const frameworkChanged = patch.outlineFramework != null;
    if (frameworkChanged) {
      const draft = snapshot.value.outline.draft ?? "";
      if (isOutlineSkeletonOrEmpty(draft)) {
        applyOutlineFramework(true);
      }
    }
    persist();
  }

  /**
   * 综合建议框架：关键词（选题）> 风格软绑定
   */
  const suggestedOutlineFramework = computed(() => {
    const topicText =
      snapshot.value.topic.adopted ?? snapshot.value.topic.draft ?? "";
    return resolveSuggestedFramework({
      topicText,
      stylePackId: config.value.stylePackId,
    });
  });

  /**
   * 应用建议的大纲框架。
   * @returns appliedSkeleton 是否已写入骨架；skippedContent 是否因已有内容未覆盖
   */
  function applySuggestedFramework(): {
    ok: boolean;
    appliedSkeleton: boolean;
    skippedContent: boolean;
    label?: WaOutlineFramework;
  } {
    const suggested = suggestedOutlineFramework.value;
    if (!suggested) return { ok: false, appliedSkeleton: false, skippedContent: false };
    const draft = snapshot.value.outline.draft ?? "";
    const canOverwrite = isOutlineSkeletonOrEmpty(draft);
    updateConfig({ outlineFramework: suggested });
    if (!canOverwrite) {
      return {
        ok: true,
        appliedSkeleton: false,
        skippedContent: true,
        label: suggested,
      };
    }
    return {
      ok: true,
      appliedSkeleton: true,
      skippedContent: false,
      label: suggested,
    };
  }

  function resetConfig() {
    config.value = { ...WA_DEFAULT_CONFIG };
    saveDefaults(config.value);
    snapshot.value.config = config.value;
    persist();
  }

  const visibleSteps = computed<WaStepId[]>(() => {
    return WA_STEP_ORDER.filter((id) => {
      if (id === "illustrations" && !config.value.enableIllustrations) return false;
      if (id === "cover" && !config.value.enableCover) return false;
      return true;
    });
  });

  const currentStep = computed(() => snapshot.value.currentStep);

  function setCurrentStep(id: WaStepId) {
    if (!visibleSteps.value.includes(id)) return;
    snapshot.value.currentStep = id;
    if (id === "outline") {
      ensureOutlineSkeleton();
    }
    persist();
  }

  /** 大纲为空时套入结构框架骨架 */
  function ensureOutlineSkeleton() {
    const s = snapshot.value;
    const current = s.outline.draft ?? s.outline.adopted ?? "";
    if (!isOutlineEffectivelyEmpty(current)) return;
    applyOutlineFramework(false);
  }

  /**
   * 套用配置中的结构框架到大纲草稿。
   * @param force 为 true 时覆盖已有内容
   */
  function applyOutlineFramework(force = false): boolean {
    const s = snapshot.value;
    const current = s.outline.draft ?? "";
    if (!force && !isOutlineEffectivelyEmpty(current)) return false;
    const text = renderOutlineFramework(s.config.outlineFramework, {
      title: (s.topic.adopted ?? s.topic.draft ?? "").trim() || undefined,
    });
    s.outline = { ...s.outline, draft: text, done: false, stale: false };
    persist();
    return true;
  }

  function stepStatus(id: WaStepId): "todo" | "current" | "done" | "stale" {
    const s = snapshot.value;
    if (s.currentStep === id) return "current";
    const stateMap: Record<WaStepId, { done: boolean; stale: boolean }> = {
      topic: s.topic,
      outline: s.outline,
      body: s.body,
      humanize: s.humanize,
      illustrations: { done: s.illustrations.length > 0, stale: false },
      cover: { done: Boolean(s.coverAssetRef), stale: false },
      finalize: { done: false, stale: false },
    };
    const st = stateMap[id];
    if (st.stale) return "stale";
    if (st.done) return "done";
    return "todo";
  }

  /** 采用当前步内容 */
  function adopt(id: WaStepId, content: string) {
    const s = snapshot.value;
    if (id === "topic") {
      s.topic = { done: true, stale: false, adopted: content, draft: content };
      s.topicCandidates = [];
      topicFrameworkSuggestion.value = recommendFrameworkFromTopic(content) ?? null;
    } else if (id === "outline") {
      s.outline = { done: true, stale: false, adopted: content, draft: content };
    } else if (id === "body") {
      s.body = { done: true, stale: false, adopted: content, draft: content };
    } else if (id === "humanize") {
      s.humanize = { done: true, stale: false, adopted: content, draft: content };
      // humanize 采用后回写 body
      s.body = { ...s.body, adopted: content, draft: content, done: true };
    }
    // 标记下游 stale
    const downstream = markStaleAfter(id);
    for (const did of downstream) {
      if (did === "outline") s.outline = { ...s.outline, stale: true };
      else if (did === "body") s.body = { ...s.body, stale: true };
      else if (did === "humanize") s.humanize = { ...s.humanize, stale: true };
    }
    // 移动到下一个可见步骤
    const vis = visibleSteps.value;
    const idx = vis.indexOf(id);
    if (idx >= 0 && idx + 1 < vis.length) {
      s.currentStep = vis[idx + 1];
      if (s.currentStep === "outline") {
        const cur = s.outline.draft ?? s.outline.adopted ?? "";
        if (isOutlineEffectivelyEmpty(cur)) {
          const text = renderOutlineFramework(s.config.outlineFramework, {
            title: (s.topic.adopted ?? "").trim() || undefined,
          });
          s.outline = { ...s.outline, draft: text, done: false, stale: false };
        }
      }
    }
    persist();
  }

  function setStepDraft(id: WaStepId, content: string) {
    const s = snapshot.value;
    if (id === "topic") s.topic = { ...s.topic, draft: content };
    else if (id === "outline") s.outline = { ...s.outline, draft: content };
    else if (id === "body") s.body = { ...s.body, draft: content };
    else if (id === "humanize") s.humanize = { ...s.humanize, draft: content };
  }

  function setTopicCandidates(candidates: WaTopicCandidate[]) {
    snapshot.value.topicCandidates = candidates;
    persist();
  }

  function setIllustrations(prompts: WaIllustrationPrompt[]) {
    snapshot.value.illustrations = prompts;
    persist();
  }

  function updateIllustration(index: number, patch: Partial<WaIllustrationPrompt>) {
    const list = [...snapshot.value.illustrations];
    list[index] = { ...list[index], ...patch };
    snapshot.value.illustrations = list;
    persist();
  }

  function setCoverAssetRef(ref: string | undefined) {
    snapshot.value.coverAssetRef = ref;
    persist();
  }

  function setCoverTemplate(id: WaCoverTemplateId) {
    snapshot.value.coverTemplate = id;
    persist();
  }

  function setCoverSubtitle(sub: string) {
    snapshot.value.coverSubtitle = sub;
    persist();
  }

  function setCoverTitle(title: string) {
    snapshot.value.coverTitle = title;
    persist();
  }

  function setCoverSource(source: WaCoverSource) {
    snapshot.value.coverSource = source;
    persist();
  }

  function setCoverOverlayText(on: boolean) {
    snapshot.value.coverOverlayText = on;
    persist();
  }

  function setCoverAiStyle(style: WaCoverAiStyle) {
    snapshot.value.coverAiStyle = style;
    persist();
  }

  function setCoverAiPrompt(prompt: string) {
    snapshot.value.coverAiPrompt = prompt;
    persist();
  }

  function setCoverMood(mood: WaMood) {
    snapshot.value.coverMood = mood;
    persist();
  }

  function setCoverComposeKey(key: string | undefined) {
    snapshot.value.coverComposeKey = key;
    persist();
  }

  function setFinalizeMode(mode: "create" | "replace") {
    snapshot.value.finalizeMode = mode;
    persist();
  }

  function setLlmTarget(target: LlmTarget) {
    if (isRetrievalTarget(target)) {
      target = LLM_AUTO_TARGET;
    }
    llmTarget.value = target;
    saveWaLlmTarget(target);
    errorMessage.value = null;
  }

  function syncLlmTargetToOptions(cfg: AiConfigPublic) {
    const opts = buildLlmOptions(cfg).filter((o) => !isRetrievalTarget(o.id));
    if (!opts.some((o) => o.id === llmTarget.value)) {
      const next =
        opts.find((o) => o.id === LLM_AUTO_TARGET)?.id ??
        opts.find((o) => o.id === "local")?.id ??
        opts[0]?.id ??
        LLM_AUTO_TARGET;
      setLlmTarget(next);
    }
  }

  function resolveLlmTarget(): LlmTarget {
    const selected = llmTarget.value || LLM_AUTO_TARGET;
    if (isRetrievalTarget(selected)) {
      const cfg = aiConfigCache.value;
      return cfg ? resolveConfiguredLlmTarget(LLM_AUTO_TARGET, cfg) : "local";
    }
    const cfg = aiConfigCache.value;
    if (cfg) return resolveConfiguredLlmTarget(selected, cfg);
    if (isAutoTarget(selected)) return "local";
    return selected;
  }

  async function loadAiState() {
    try {
      const cfg = await getAiConfig();
      aiConfigCache.value = cfg;
      aiEnabled.value = cfg.enabled;
      syncLlmTargetToOptions(cfg);
      if (!chat.aiConfig) {
        await chat.loadAiEnabled();
      }
    } catch {
      aiEnabled.value = false;
      aiConfigCache.value = null;
    }
  }

  function buildCtx(): import("../services/writingAssistantService").WaStreamContext {
    const s = snapshot.value;
    return {
      config: config.value,
      stylePack: currentStylePack(),
      intent: s.topic.draft ?? s.topic.adopted ?? "",
      topicTitle: s.topic.adopted ?? "",
      outline: s.outline.adopted ?? s.outline.draft ?? "",
      body: s.humanize.adopted ?? s.body.adopted ?? s.body.draft ?? "",
      llmTarget: resolveLlmTarget(),
    };
  }

  function formatWaError(raw: string | null | undefined, usedTarget?: LlmTarget): string {
    const msg = (raw ?? "").trim();
    const target = usedTarget ?? resolveLlmTarget();
    const opt = findLlmOption(llmOptions.value, llmTarget.value);
    const isCloud =
      target !== "local" &&
      !isAutoTarget(llmTarget.value) &&
      (opt?.group === "cloud" || /https?:\/\//i.test(msg));
    const modelHint = opt
      ? `当前模型：${opt.shortLabel || opt.label}${opt.group === "cloud" ? `（${opt.description}）` : ""}`
      : `当前目标：${String(llmTarget.value)}`;

    if (/error sending request|connection refused|Failed to fetch|os error 10061|请求失败:/i.test(msg)) {
      if (isCloud || /https?:\/\//i.test(msg)) {
        return `${modelHint}。云端请求失败（${msg.replace(/^请求失败:\s*/i, "")}）。请更换模型，或检查该供应商网络 / API Key / 代理地址。`;
      }
      return `${modelHint}。无法连接本地模型（${msg}）。请启动 Ollama，或在上方切换到可用的云端模型。`;
    }
    if (!msg || msg === "请求失败") {
      return `${modelHint}。请求失败，请在上方切换模型后重试，并检查 AI 设置。`;
    }
    return `${modelHint}。${msg}`;
  }

  async function runTextStep(kind: WaTextStepId): Promise<string> {
    if (isStreaming.value) return "";
    isStreaming.value = true;
    streamStep.value = kind;
    cancelFlag = false;
    errorMessage.value = null;

    if (!aiConfigCache.value) {
      await loadAiState();
    }
    if (!aiEnabled.value) {
      errorMessage.value = "AI 未启用，请先在设置中开启助手";
      isStreaming.value = false;
      streamStep.value = null;
      return "";
    }

    const prevDraft = (() => {
      const s = snapshot.value;
      if (kind === "topic") return s.topic.draft ?? "";
      if (kind === "outline") return s.outline.draft ?? "";
      if (kind === "body") return s.body.draft ?? "";
      return s.humanize.draft ?? "";
    })();

    const selectedForUi = llmTarget.value || LLM_AUTO_TARGET;
    const cfg = aiConfigCache.value;
    const primary = resolveLlmTarget();
    const targets: LlmTarget[] = [primary];
    if (cfg && isAutoTarget(selectedForUi) && primary === "local") {
      for (const t of getCloudFallbackTargets(cfg)) {
        if (!targets.includes(t)) targets.push(t);
      }
    }

    let acc = "";
    let lastError: string | null = null;
    let lastFailedTarget: LlmTarget | null = null;
    let cleared = false;
    const appendToken = (t: string) => {
      if (!cleared) {
        cleared = true;
        setStepDraft(kind, "");
        acc = "";
      }
      acc += t;
      setStepDraft(kind, acc);
    };

    try {
      for (const target of targets) {
        if (cancelFlag) break;
        lastError = null;
        acc = "";
        cleared = false;
        const ctx = { ...buildCtx(), llmTarget: target };
        await streamWaTextStep(kind, ctx, {
          onToken: (t) => {
            if (cancelFlag) return;
            appendToken(t);
          },
          onError: (msg) => {
            lastError = msg;
            lastFailedTarget = target;
          },
          shouldCancel: () => cancelFlag,
        });
        if (cancelFlag) break;
        if (!lastError && acc.trim()) {
          errorMessage.value = null;
          break;
        }
        if (!acc.trim() && prevDraft) {
          setStepDraft(kind, prevDraft);
        }
      }
      if (lastError && !cancelFlag) {
        errorMessage.value = formatWaError(lastError, lastFailedTarget ?? primary);
        if (!acc.trim()) {
          if (prevDraft.trim()) setStepDraft(kind, prevDraft);
          else if (kind === "outline") ensureOutlineSkeleton();
        }
      } else if (!acc.trim() && !cancelFlag && !lastError) {
        errorMessage.value = formatWaError("模型未返回内容", primary);
        if (prevDraft.trim()) setStepDraft(kind, prevDraft);
        else if (kind === "outline") ensureOutlineSkeleton();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errorMessage.value = formatWaError(msg, primary);
      if (prevDraft.trim()) setStepDraft(kind, prevDraft);
      else if (kind === "outline") ensureOutlineSkeleton();
    } finally {
      isStreaming.value = false;
      streamStep.value = null;
      persist();
    }
    return acc;
  }

  function stopStream() {
    cancelFlag = true;
    isStreaming.value = false;
    streamStep.value = null;
  }

  async function runIllustrations(): Promise<WaIllustrationPrompt[] | null> {
    if (isStreaming.value) return null;
    isStreaming.value = true;
    streamStep.value = "illustrations";
    cancelFlag = false;
    errorMessage.value = null;
    const ctx = buildCtx();
    try {
      const { prompts } = await streamWaIllustrationPrompts(ctx, {
        onToken: () => {
          /* 配图步不展示 token，仅完成后展示结构化字段 */
        },
        onError: (msg) => {
          errorMessage.value = formatWaError(msg, resolveLlmTarget());
        },
        shouldCancel: () => cancelFlag,
      });
      if (prompts) setIllustrations(prompts);
      return prompts;
    } finally {
      isStreaming.value = false;
      streamStep.value = null;
    }
  }

  function buildFinalMarkdown(): string {
    const s = snapshot.value;
    const title = (s.topic.adopted ?? "").trim() || "无标题";
    const body = s.humanize.adopted ?? s.body.adopted ?? s.body.draft ?? "";
    const coverId = s.coverAssetRef?.startsWith("asset://")
      ? s.coverAssetRef.slice("asset://".length)
      : s.coverAssetRef;
    return assembleMarkdown({
      title,
      body,
      coverAssetId: coverId,
      coverSubtitle: s.coverSubtitle,
      illustrations: s.illustrations,
    });
  }

  async function finalize(): Promise<{ ok: boolean; message: string }> {
    const s = snapshot.value;
    const md = buildFinalMarkdown();
    const title = (s.topic.adopted ?? "").trim() || "无标题";
    try {
      if (s.finalizeMode === "replace") {
        if (!documents.activeId) {
          return { ok: false, message: "当前没有打开的文档，无法写入" };
        }
        documents.updateContent(md);
        await editor.saveNow();
        ui.showToast("success", "已写入当前文档");
      } else {
        await documents.createFromContent(title, md);
        ui.showToast("success", "已新建文档并打开");
      }
      closeDialog();
      return { ok: true, message: "定稿完成" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "定稿失败";
      ui.showToast("error", msg);
      return { ok: false, message: msg };
    }
  }

  watch(
    () => vault.isLocked,
    (locked) => {
      if (locked) {
        abandon();
        open.value = false;
      }
    },
  );

  return {
    open,
    config,
    snapshot,
    aiEnabled,
    aiConfigCache,
    llmTarget,
    llmOptions,
    llmLabel,
    isStreaming,
    streamStep,
    errorMessage,
    stylePacks,
    stylePacksLoading,
    topicFrameworkSuggestion,
    suggestedOutlineFramework,
    visibleSteps,
    currentStep,
    openDialog,
    closeDialog,
    abandon,
    updateConfig,
    resetConfig,
    applySuggestedFramework,
    setLlmTarget,
    setCurrentStep,
    stepStatus,
    adopt,
    applyOutlineFramework,
    ensureOutlineSkeleton,
    setStepDraft,
    setTopicCandidates,
    setIllustrations,
    updateIllustration,
    setCoverAssetRef,
    setCoverTemplate,
    setCoverSubtitle,
    setCoverTitle,
    setCoverSource,
    setCoverOverlayText,
    setCoverAiStyle,
    setCoverAiPrompt,
    setCoverMood,
    setCoverComposeKey,
    setFinalizeMode,
    resolveLlmTarget,
    loadAiState,
    refreshStylePacks,
    currentStylePack,
    saveStylePackToVault,
    deleteStylePackFromVault,
    resetStylePackInVault,
    runTextStep,
    runIllustrations,
    stopStream,
    buildFinalMarkdown,
    finalize,
  };
});
