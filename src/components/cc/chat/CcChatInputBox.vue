<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Check,
  ChevronDown,
  File,
  FolderOpen,
  Loader2,
  Paperclip,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  X,
  Zap,
} from "@lucide/vue";

import { useCcInputCompletions, preloadCcSlashCommands, type CcCompletionItem } from "../../../composables/cc/useCcInputCompletions";
import type { CcChatModelOption, CcPermissionMode, CcReasoningEffort } from "../../../utils/ccChatModels";
import {
  PERMISSION_MODE_LABELS,
  PERMISSION_MODE_OPTIONS,
  REASONING_EFFORT_LABELS,
  strip1mSuffix,
} from "../../../utils/ccChatModels";
import { groupModelOptions, modelSupports1mContext } from "../../../utils/ccModelCatalog";
import type { CcAgentEntry, CcProviderPublic, CwdMode } from "../../../services/ccWorkbenchService";
import { enhanceCcPrompt, testCcModel } from "../../../services/ccWorkbenchService";
import type { CcChatAttachment } from "../../../utils/ccAttachments";
import { isTauriRuntime } from "../../../services/vaultService";
import CcAddModelDialog from "./CcAddModelDialog.vue";
import CcAgentSelect from "./CcAgentSelect.vue";
import CcFileContextPicker from "./CcFileContextPicker.vue";
import CcInputDropdown from "./CcInputDropdown.vue";
import CcPromptEnhancerDialog from "./CcPromptEnhancerDialog.vue";
import CcProviderSelect from "./CcProviderSelect.vue";
import CcTokenIndicator from "./CcTokenIndicator.vue";

const props = defineProps<{
  modelValue: string;
  streaming?: boolean;
  disabled?: boolean;
  modelOptions: CcChatModelOption[];
  selectedModelId: string;
  providers?: CcProviderPublic[];
  activeProviderId?: string | null;
  switchingProvider?: boolean;
  longContextEnabled?: boolean;
  permissionMode: CcPermissionMode;
  reasoningEffort: CcReasoningEffort;
  cwdModeLabel?: string;
  contextLabel?: string;
  contextPercentage?: number;
  contextUsedTokens?: number;
  contextMaxTokens?: number;
  cwdMode?: CwdMode;
  projectPath?: string | null;
  openedFiles?: string[];
  attachments?: CcChatAttachment[];
  disableThinking?: boolean;
  selectedAgent?: CcAgentEntry | null;
  activeDocumentPath?: string | null;
  runtimeReady?: boolean;
  runtimeHint?: string | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:selectedModelId": [id: string];
  "update:longContextEnabled": [enabled: boolean];
  "switch-provider": [id: string];
  "add-custom-model": [payload: { id: string; label?: string }];
  "update:permissionMode": [mode: CcPermissionMode];
  "update:reasoningEffort": [effort: CcReasoningEffort];
  "update:openedFiles": [files: string[]];
  "update:attachments": [files: CcChatAttachment[]];
  "update:disableThinking": [value: boolean];
  "update:selectedAgent": [agent: CcAgentEntry | null];
  "remove-opened-file": [path: string];
  "remove-attachment": [path: string];
  "clear-context": [];
  "clear-attachments": [];
  "pick-attachments": [];
  "attach-files-from-browser": [paths: string[]];
  "attach-current-document": [];
  submit: [];
  stop: [];
}>();

const modelOpen = ref(false);
const modeOpen = ref(false);
const effortOpen = ref(false);
const addModelOpen = ref(false);
const filePickerOpen = ref(false);
const attachmentInputRef = ref<HTMLInputElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const enhancerOpen = ref(false);
const enhancerLoading = ref(false);
const originalPrompt = ref("");
const enhancedPrompt = ref("");

type ModelTestStatus = "idle" | "testing" | "ok" | "error";
const MODEL_TEST_TIMEOUT_MS = 20_000;
const modelTestMap = ref<Record<string, { status: ModelTestStatus; error?: string }>>({});
let modelTestRunId = 0;

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function markAllModelsUnavailable(error: string) {
  modelTestMap.value = Object.fromEntries(
    props.modelOptions.map((opt) => [opt.id, { status: "error" as const, error }]),
  );
}

async function testAllModels() {
  if (!props.modelOptions.length || modelTesting.value) return;
  const runId = ++modelTestRunId;

  if (!props.runtimeReady) {
    markAllModelsUnavailable(props.runtimeHint ?? "运行时未就绪");
    return;
  }

  for (const opt of props.modelOptions) {
    if (runId !== modelTestRunId) return;
    modelTestMap.value = {
      ...modelTestMap.value,
      [opt.id]: { status: "testing" },
    };
    try {
      const result = await withTimeout(
        testCcModel(opt.id, opt.slot),
        MODEL_TEST_TIMEOUT_MS,
        "模型测试超时，请检查网络或 API 配置",
      );
      if (runId !== modelTestRunId) return;
      modelTestMap.value = {
        ...modelTestMap.value,
        [opt.id]: {
          status: result.success ? "ok" : "error",
          error: result.error ?? undefined,
        },
      };
    } catch (error) {
      if (runId !== modelTestRunId) return;
      modelTestMap.value = {
        ...modelTestMap.value,
        [opt.id]: {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

const modelTesting = computed(() =>
  Object.values(modelTestMap.value).some((entry) => entry.status === "testing"),
);

function modelTestStatus(modelId: string): ModelTestStatus {
  return modelTestMap.value[modelId]?.status ?? "idle";
}

function modelTestError(modelId: string): string | undefined {
  return modelTestMap.value[modelId]?.error;
}

const localOpenedFiles = computed({
  get: () => props.openedFiles ?? [],
  set: (value: string[]) => emit("update:openedFiles", value),
});

const localAttachments = computed({
  get: () => props.attachments ?? [],
  set: (value: CcChatAttachment[]) => emit("update:attachments", value),
});

const localDisableThinking = computed({
  get: () => props.disableThinking ?? false,
  set: (value: boolean) => emit("update:disableThinking", value),
});

const completions = useCcInputCompletions({
  text: toRef(props, "modelValue"),
  cwdMode: computed(() => props.cwdMode ?? "vault"),
  projectPath: computed(() => props.projectPath ?? null),
});

const completionState = completions.state;
const completionLoading = completions.loading;

const selectedModel = computed(
  () =>
    props.modelOptions.find((m) => m.id === props.selectedModelId)
    ?? props.modelOptions.find((m) => m.baseId === strip1mSuffix(props.selectedModelId))
    ?? props.modelOptions[0]
    ?? null,
);

const modelGroups = computed(() => groupModelOptions(props.modelOptions));

const selectedBaseId = computed(() => strip1mSuffix(props.selectedModelId));

const canToggle1m = computed(() => modelSupports1mContext(selectedBaseId.value));

const longContextOn = computed({
  get: () => props.longContextEnabled ?? true,
  set: (value: boolean) => emit("update:longContextEnabled", value),
});

function modelOptionKey(opt: CcChatModelOption): string {
  return opt.source === "slot" && opt.slot ? `slot:${opt.slot}` : `${opt.source}:${opt.baseId}`;
}

function selectModel(opt: CcChatModelOption) {
  emit("update:selectedModelId", opt.id);
  modelOpen.value = false;
}

function onAddCustomModel(payload: { id: string; label?: string }) {
  emit("add-custom-model", payload);
}

const modelDisplay = computed(() => {
  const m = selectedModel.value;
  if (!m) return "未配置模型";
  const suffix = m.supports1m ? " (1M上下文)" : "";
  return `${m.label}${suffix}`;
});

const fileContextLabel = computed(() => {
  const count = localOpenedFiles.value.length;
  return count ? `文件上下文 (${count})` : "文件上下文";
});

const projectPathTitle = computed(() => {
  if (props.cwdMode === "project" && props.projectPath?.trim()) {
    return props.projectPath.trim();
  }
  return undefined;
});

const showTokenIndicator = computed(() => {
  const max = props.contextMaxTokens;
  return typeof max === "number" && Number.isFinite(max) && max > 0;
});

const safeContextPercentage = computed(() => {
  const pct = props.contextPercentage;
  if (typeof pct !== "number" || !Number.isFinite(pct)) return 0;
  return pct;
});

function closeMenus() {
  modelOpen.value = false;
  modeOpen.value = false;
  effortOpen.value = false;
}

function onDocClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest(".cc-chat-select")) closeMenus();
}

onMounted(() => {
  document.addEventListener("click", onDocClick);
  preloadCcSlashCommands();
});
onUnmounted(() => document.removeEventListener("click", onDocClick));

function setText(value: string, cursor?: number) {
  emit("update:modelValue", value);
  void nextTick(() => {
    const el = textareaRef.value;
    if (!el) return;
    if (typeof cursor === "number") {
      el.selectionStart = el.selectionEnd = cursor;
    }
    el.focus();
  });
}

function onInput(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  emit("update:modelValue", el.value);
  void completions.syncFromCursor(el.selectionStart);
}

function onEditorClick(event: MouseEvent) {
  const el = event.target as HTMLTextAreaElement;
  void completions.syncFromCursor(el.selectionStart);
}

function onSelectCompletion(item: CcCompletionItem) {
  const { nextText, nextCursor, selectedAgent } = completions.applySelection(item);
  setText(nextText, nextCursor);
  if (selectedAgent) {
    emit("update:selectedAgent", selectedAgent);
  }
  if (item.kind === "file" && item.meta && "path" in item.meta) {
    const path = item.meta.path;
    if (!localOpenedFiles.value.includes(path)) {
      emit("update:openedFiles", [...localOpenedFiles.value, path]);
    }
  }
}

function onKeydown(event: KeyboardEvent) {
  if (completionState.value.open) {
    if (event.key === "ArrowDown" && completionState.value.items.length) {
      event.preventDefault();
      completions.moveActive(1);
      return;
    }
    if (event.key === "ArrowUp" && completionState.value.items.length) {
      event.preventDefault();
      completions.moveActive(-1);
      return;
    }
    if ((event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) && completionState.value.items.length) {
      const item = completions.activeItem.value;
      if (item) {
        event.preventDefault();
        onSelectCompletion(item);
        return;
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      completions.close();
      return;
    }
  }

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!props.disabled && !props.streaming && props.modelValue.trim()) {
      emit("submit");
    }
  }
}

async function onEnhancePrompt() {
  const text = props.modelValue.trim();
  if (!text || props.streaming || props.disabled) return;
  const slot = props.modelOptions.find((m) => m.id === props.selectedModelId)?.slot ?? null;
  originalPrompt.value = text;
  enhancedPrompt.value = "";
  enhancerOpen.value = true;
  enhancerLoading.value = true;
  try {
    const result = await enhanceCcPrompt(text, props.selectedModelId || null, slot);
    if (result.success) {
      enhancedPrompt.value = result.enhancedPrompt;
    } else {
      enhancedPrompt.value = result.error ?? "增强失败";
    }
  } catch (error) {
    enhancedPrompt.value = error instanceof Error ? error.message : String(error);
  } finally {
    enhancerLoading.value = false;
  }
}

function useEnhancedPrompt() {
  if (enhancedPrompt.value && !enhancerLoading.value) {
    setText(enhancedPrompt.value);
  }
  enhancerOpen.value = false;
}

function onPickAttachments() {
  if (props.disabled) return;
  if (isTauriRuntime()) {
    emit("pick-attachments");
    return;
  }
  attachmentInputRef.value?.click();
}

function onBrowserAttachmentChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (!files.length) return;
  emit(
    "attach-files-from-browser",
    files.map((file) => file.name),
  );
  input.value = "";
}

function attachmentPreviewUrl(path: string): string | null {
  if (!isTauriRuntime()) return null;
  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
}

function toggleThinking() {
  localDisableThinking.value = !localDisableThinking.value;
}

watch(
  () => props.modelValue,
  () => {
    const el = textareaRef.value;
    if (!el || document.activeElement !== el) return;
    void completions.syncFromCursor(el.selectionStart);
  },
);

watch(
  () => props.modelOptions.map((m) => m.id).join("|"),
  () => {
    modelTestMap.value = {};
  },
);
</script>

<template>
  <div class="cc-chat-input" data-testid="cc-chat-input">
    <div class="cc-chat-input__header">
      <div class="cc-chat-input__header-left">
        <button
          type="button"
          class="cc-chat-input__chip cc-chat-input__chip--icon"
          title="添加附件"
          aria-label="添加附件"
          :disabled="disabled"
          @click="onPickAttachments"
        >
          <Paperclip class="h-3.5 w-3.5" />
        </button>
        <CcTokenIndicator
          v-if="showTokenIndicator"
          :percentage="safeContextPercentage"
          :used-tokens="contextUsedTokens"
          :max-tokens="contextMaxTokens"
        />
        <span v-if="contextLabel" class="cc-chat-input__context">{{ contextLabel }}</span>
        <span class="cc-chat-input__header-divider" aria-hidden="true" />
        <button
          type="button"
          class="cc-chat-input__file-context-btn"
          :disabled="disabled"
          @click="filePickerOpen = true"
        >
          <FolderOpen class="h-3.5 w-3.5" />
          {{ fileContextLabel }}
        </button>
        <button
          v-if="activeDocumentPath && cwdMode === 'vault'"
          type="button"
          class="cc-chat-input__chip cc-chat-input__chip--accent"
          title="附加当前打开的笔记"
          :disabled="disabled"
          @click="emit('attach-current-document')"
        >
          当前笔记
        </button>
        <span v-if="selectedAgent" class="cc-chat-input__agent">
          #{{ selectedAgent.name }}
          <button
            type="button"
            class="cc-chat-input__agent-clear"
            aria-label="清除智能体"
            @click="emit('update:selectedAgent', null)"
          >
            ×
          </button>
        </span>
      </div>
      <span
        v-if="cwdModeLabel"
        class="cc-chat-input__cwd"
        :title="projectPathTitle"
      >{{ cwdModeLabel }}</span>
    </div>

    <div v-if="localAttachments.length" class="cc-chat-input__attachments">
      <span
        v-for="item in localAttachments"
        :key="item.path"
        class="cc-chat-input__attachment"
        :title="item.path"
      >
        <img
          v-if="item.kind === 'image' && attachmentPreviewUrl(item.path)"
          :src="attachmentPreviewUrl(item.path) ?? undefined"
          :alt="item.name"
          class="cc-chat-input__attachment-thumb"
        />
        <File v-else class="cc-chat-input__attachment-icon" />
        {{ item.name }}
        <button
          type="button"
          class="cc-chat-input__attachment-remove"
          aria-label="移除附件"
          @click="emit('remove-attachment', item.path)"
        >
          ×
        </button>
      </span>
      <button
        type="button"
        class="cc-chat-input__attachments-clear"
        @click="emit('clear-attachments')"
      >
        清空附件
      </button>
    </div>

    <div v-if="localOpenedFiles.length" class="cc-chat-input__file-context">
      <span v-for="path in localOpenedFiles" :key="path" class="cc-chat-input__context-chip">
        @{{ path }}
        <button
          type="button"
          class="cc-chat-input__context-chip-remove"
          aria-label="移除上下文文件"
          @click="emit('remove-opened-file', path)"
        >
          ×
        </button>
      </span>
      <button
        type="button"
        class="cc-chat-input__file-context-clear"
        @click="emit('clear-context')"
      >
        清空上下文
      </button>
    </div>

    <div class="cc-chat-input__editor-wrap">
      <CcInputDropdown
        :open="completionState.open"
        :kind="completionState.kind"
        :items="completionState.items"
        :active-index="completionState.activeIndex"
        :loading="completionLoading"
        :anchor-el="textareaRef"
        @select="onSelectCompletion"
      />
      <textarea
        ref="textareaRef"
        :value="modelValue"
        class="cc-chat-input__editor"
        rows="3"
        :disabled="disabled"
        placeholder="@引用文件，#唤起智能体，!插入提示词，Enter 发送"
        @input="onInput"
        @keydown="onKeydown"
        @click="onEditorClick"
      />
    </div>

    <div class="cc-chat-input__footer">
      <div class="cc-chat-input__footer-left">
        <button
          type="button"
          class="cc-chat-input__icon-btn"
          :class="{ 'cc-chat-input__icon-btn--active': enhancerLoading }"
          :disabled="disabled || streaming || !modelValue.trim() || enhancerLoading"
          title="增强提示"
          @click="onEnhancePrompt"
        >
          <Sparkles class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class="cc-chat-input__icon-btn"
          :class="{ 'cc-chat-input__icon-btn--off': localDisableThinking }"
          :disabled="disabled || streaming"
          :title="localDisableThinking ? '已关闭思考模式（点击开启）' : '思考模式已开启（点击关闭）'"
          @click="toggleThinking"
        >
          <Zap class="h-3.5 w-3.5" />
        </button>
      </div>

      <div class="cc-chat-input__selectors">
        <CcAgentSelect
          :selected-agent="selectedAgent"
          :disabled="disabled || streaming"
          @update:selected-agent="emit('update:selectedAgent', $event)"
        />

        <div class="cc-chat-select">
          <button
            type="button"
            class="cc-chat-select__trigger"
            @click.stop="modeOpen = !modeOpen; modelOpen = false; effortOpen = false"
          >
            {{ PERMISSION_MODE_LABELS[permissionMode] }}
            <ChevronDown class="h-3 w-3" />
          </button>
          <div v-if="modeOpen" class="cc-chat-select__menu cc-chat-select__menu--mode">
            <button
              v-for="opt in PERMISSION_MODE_OPTIONS"
              :key="opt.mode"
              type="button"
              class="cc-chat-select__item cc-chat-select__item--mode"
              :class="{ 'cc-chat-select__item--active': permissionMode === opt.mode }"
              @click="emit('update:permissionMode', opt.mode); modeOpen = false"
            >
              <div class="cc-chat-select__item-main">
                <span class="font-medium">{{ opt.label }}</span>
                <span class="cc-chat-select__desc">{{ opt.description }}</span>
              </div>
            </button>
          </div>
        </div>

        <CcProviderSelect
          v-if="providers?.length"
          :providers="providers"
          :active-provider-id="activeProviderId"
          :switching="switchingProvider"
          :disabled="disabled || streaming"
          @switch="emit('switch-provider', $event)"
        />

        <div class="cc-chat-select">
          <button
            type="button"
            class="cc-chat-select__trigger cc-chat-select__trigger--model"
            @click.stop="
              modelOpen = !modelOpen;
              modeOpen = false;
              effortOpen = false;
            "
          >
            <span class="truncate">{{ modelDisplay }}</span>
            <ChevronDown class="h-3 w-3 shrink-0" />
          </button>
          <div v-if="modelOpen" class="cc-chat-select__menu cc-chat-select__menu--wide cc-chat-select__menu--models">
            <div class="cc-chat-select__menu-header">
              <span>模型可用性</span>
              <button
                type="button"
                class="cc-chat-select__test-btn"
                :disabled="modelTesting || !modelOptions.length"
                @click.stop="testAllModels"
              >
                <Loader2 v-if="modelTesting" class="h-3 w-3 animate-spin" />
                <RefreshCw v-else class="h-3 w-3" />
                测试
              </button>
            </div>
            <div class="cc-chat-select__groups">
              <div v-for="group in modelGroups" :key="group.source" class="cc-chat-select__group">
                <p class="cc-chat-select__group-label">{{ group.label }}</p>
                <button
                  v-for="opt in group.items"
                  :key="modelOptionKey(opt)"
                  type="button"
                  class="cc-chat-select__item cc-chat-select__item--model"
                  :class="{ 'cc-chat-select__item--active': selectedModelId === opt.id }"
                  :title="modelTestError(opt.id)"
                  @click="selectModel(opt)"
                >
                  <div class="cc-chat-select__item-main">
                    <span class="font-medium">{{ opt.label }}</span>
                    <span class="cc-chat-select__desc">{{ opt.description }}</span>
                  </div>
                  <Loader2
                    v-if="modelTestStatus(opt.id) === 'testing'"
                    class="cc-chat-select__status cc-chat-select__status--testing"
                  />
                  <Check
                    v-else-if="modelTestStatus(opt.id) === 'ok'"
                    class="cc-chat-select__status cc-chat-select__status--ok"
                  />
                  <X
                    v-else-if="modelTestStatus(opt.id) === 'error'"
                    class="cc-chat-select__status cc-chat-select__status--error"
                  />
                </button>
              </div>
            </div>
            <div class="cc-chat-select__menu-footer">
              <label
                class="cc-chat-select__long-context"
                :class="{ 'cc-chat-select__long-context--disabled': !canToggle1m }"
                @click.stop
              >
                <span>1M 上下文</span>
                <input
                  type="checkbox"
                  class="cc-chat-select__switch"
                  :checked="longContextOn && canToggle1m"
                  :disabled="!canToggle1m"
                  @change="longContextOn = ($event.target as HTMLInputElement).checked"
                />
              </label>
              <button
                type="button"
                class="cc-chat-select__add-model"
                @click.stop="addModelOpen = true; modelOpen = false"
              >
                + 添加自定义模型
              </button>
            </div>
            <p v-if="!runtimeReady && runtimeHint" class="cc-chat-select__hint">{{ runtimeHint }}</p>
            <p v-if="!modelOptions.length" class="cc-chat-select__empty">请先在设置中配置供应商模型</p>
          </div>
        </div>

        <div class="cc-chat-select">
          <button
            type="button"
            class="cc-chat-select__trigger"
            @click.stop="effortOpen = !effortOpen; modelOpen = false; modeOpen = false"
          >
            {{ REASONING_EFFORT_LABELS[reasoningEffort] }}
            <ChevronDown class="h-3 w-3" />
          </button>
          <div v-if="effortOpen" class="cc-chat-select__menu">
            <button
              v-for="(label, effort) in REASONING_EFFORT_LABELS"
              :key="effort"
              type="button"
              class="cc-chat-select__item"
              :class="{ 'cc-chat-select__item--active': reasoningEffort === effort }"
              @click="emit('update:reasoningEffort', effort as CcReasoningEffort); effortOpen = false"
            >
              {{ label }}
            </button>
          </div>
        </div>
      </div>

      <button
        v-if="streaming"
        type="button"
        class="cc-chat-input__send cc-chat-input__send--stop"
        aria-label="停止"
        @click="emit('stop')"
      >
        <Square class="h-3.5 w-3.5" />
      </button>
      <button
        v-else
        type="button"
        class="cc-chat-input__send"
        :disabled="disabled || !modelValue.trim()"
        aria-label="发送"
        @click="emit('submit')"
      >
        <Send class="h-3.5 w-3.5" />
      </button>
    </div>

    <CcFileContextPicker
      :open="filePickerOpen"
      :cwd-mode="cwdMode ?? 'vault'"
      :project-path="projectPath"
      :model-value="localOpenedFiles"
      @update:model-value="emit('update:openedFiles', $event)"
      @close="filePickerOpen = false"
    />

    <CcAddModelDialog :open="addModelOpen" @close="addModelOpen = false" @add="onAddCustomModel" />

    <CcPromptEnhancerDialog
      :open="enhancerOpen"
      :loading="enhancerLoading"
      :original-prompt="originalPrompt"
      :enhanced-prompt="enhancedPrompt"
      @close="enhancerOpen = false"
      @keep-original="enhancerOpen = false"
      @use-enhanced="useEnhancedPrompt"
    />

    <input
      ref="attachmentInputRef"
      type="file"
      class="cc-chat-input__attachment-input"
      multiple
      accept="image/*,.md,.txt,.json,.pdf,.csv,.ts,.js,.py,.rs,.vue,.html,.css"
      @change="onBrowserAttachmentChange"
    />
  </div>
</template>

<style scoped>
.cc-chat-input {
  border-radius: 0.875rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 70%, var(--color-surface-0));
  overflow: visible;
}

.cc-chat-input__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  padding: 0.4375rem 0.75rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-chat-input__header-left {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}

.cc-chat-input__header-divider {
  flex-shrink: 0;
  width: 1px;
  height: 0.875rem;
  background: color-mix(in srgb, var(--color-border) 70%, transparent);
}

.cc-chat-input__file-context-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  border-radius: 0.375rem;
  padding: 0.1875rem 0.4375rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-chat-input__file-context-btn:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-surface-1);
}

.cc-chat-input__file-context-btn:disabled {
  opacity: 0.45;
}

.cc-chat-input__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 0.375rem;
  padding: 0.125rem 0.375rem;
  color: var(--color-muted);
}

.cc-chat-input__chip--icon {
  padding: 0.1875rem;
}

.cc-chat-input__chip:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-surface-1);
}

.cc-chat-input__chip:disabled {
  opacity: 0.45;
}

.cc-chat-input__chip--accent {
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
}

.cc-chat-input__context {
  font-variant-numeric: tabular-nums;
  color: var(--color-muted);
  font-size: 0.625rem;
}

.cc-chat-input__agent {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  background: color-mix(in srgb, #8b5cf6 12%, transparent);
  padding: 0.125rem 0.5rem;
  color: #7c3aed;
}

.cc-chat-input__agent-clear {
  font-size: 0.75rem;
  line-height: 1;
  color: inherit;
  opacity: 0.7;
}

.cc-chat-input__agent-clear:hover {
  opacity: 1;
}

.cc-chat-input__cwd {
  max-width: min(16rem, 48vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
  color: var(--color-link);
}

.cc-chat-input__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  padding: 0.375rem 0.75rem;
}

.cc-chat-input__attachment {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  padding: 0.125rem 0.4375rem;
  font-size: 0.625rem;
  color: var(--color-text);
}

.cc-chat-input__attachment-thumb {
  height: 1rem;
  width: 1rem;
  border-radius: 0.1875rem;
  object-fit: cover;
}

.cc-chat-input__attachment-icon {
  height: 0.75rem;
  width: 0.75rem;
  color: var(--color-muted);
}

.cc-chat-input__attachment-remove {
  font-size: 0.75rem;
  line-height: 1;
  color: var(--color-muted);
}

.cc-chat-input__attachment-remove:hover {
  color: var(--color-danger);
}

.cc-chat-input__attachments-clear {
  margin-left: auto;
  font-size: 0.625rem;
  color: var(--color-link);
}

.cc-chat-input__file-context {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  padding: 0.375rem 0.75rem;
}

.cc-chat-input__context-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
  padding: 0.125rem 0.4375rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-chat-input__context-chip-remove {
  font-size: 0.75rem;
  line-height: 1;
  color: var(--color-muted);
}

.cc-chat-input__context-chip-remove:hover {
  color: var(--color-danger);
}

.cc-chat-input__file-context-clear {
  margin-left: auto;
  font-size: 0.625rem;
  color: var(--color-link);
}

.cc-chat-input__attachment-input {
  display: none;
}

.cc-chat-input__editor-wrap {
  position: relative;
}

.cc-chat-input__editor {
  display: block;
  width: 100%;
  min-height: 4.5rem;
  max-height: 12rem;
  resize: vertical;
  border: none;
  background: transparent;
  padding: 0.75rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  outline: none;
  color: var(--color-text);
}

.cc-chat-input__editor::placeholder {
  color: var(--color-muted);
}

.cc-chat-input__footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  padding: 0.5rem 0.625rem;
}

.cc-chat-input__footer-left {
  display: flex;
  gap: 0.25rem;
}

.cc-chat-input__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.4375rem;
  padding: 0.3125rem;
  color: var(--color-muted);
}

.cc-chat-input__icon-btn:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-surface-1);
}

.cc-chat-input__icon-btn--active {
  color: var(--color-link);
}

.cc-chat-input__icon-btn--off {
  opacity: 0.45;
}

.cc-chat-input__icon-btn:disabled {
  opacity: 0.35;
}

.cc-chat-input__selectors {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.375rem;
}

.cc-chat-select {
  position: relative;
}

.cc-chat-select__trigger {
  display: inline-flex;
  max-width: 12rem;
  align-items: center;
  gap: 0.25rem;
  border-radius: 0.4375rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.3125rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-text);
}

.cc-chat-select__trigger--model {
  max-width: 14rem;
}

.cc-chat-select__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.25rem);
  z-index: 20;
  min-width: 8rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 8px 24px color-mix(in srgb, black 14%, transparent);
  padding: 0.25rem;
}

.cc-chat-select__menu--models {
  min-width: 15rem;
  max-height: min(22rem, 60vh);
  display: flex;
  flex-direction: column;
}

.cc-chat-select__groups {
  overflow-y: auto;
  max-height: min(14rem, 42vh);
}

.cc-chat-select__group + .cc-chat-select__group {
  margin-top: 0.25rem;
}

.cc-chat-select__group-label {
  padding: 0.25rem 0.375rem 0.125rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-muted);
}

.cc-chat-select__menu-footer {
  margin-top: 0.25rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  padding-top: 0.25rem;
}

.cc-chat-select__long-context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.6875rem;
}

.cc-chat-select__long-context--disabled {
  opacity: 0.45;
}

.cc-chat-select__switch {
  accent-color: var(--color-link);
}

.cc-chat-select__add-model {
  display: block;
  width: 100%;
  border-radius: 0.375rem;
  padding: 0.4375rem 0.5rem;
  text-align: left;
  font-size: 0.6875rem;
  color: var(--color-link);
}

.cc-chat-select__add-model:hover {
  background: color-mix(in srgb, var(--color-link) 8%, transparent);
}

.cc-chat-select__menu--wide {
  min-width: 14rem;
  max-width: min(18rem, 80vw);
}

.cc-chat-select__menu--mode {
  min-width: 16rem;
  width: max-content;
  max-width: min(24rem, 92vw);
}

.cc-chat-select__menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0.375rem 0.375rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-chat-select__test-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 0.375rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  color: var(--color-link);
}

.cc-chat-select__test-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
}

.cc-chat-select__test-btn:disabled {
  opacity: 0.5;
}

.cc-chat-select__item--model,
.cc-chat-select__item--mode {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.cc-chat-select__item--mode .cc-chat-select__desc {
  white-space: nowrap;
}

.cc-chat-select__item-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
}

.cc-chat-select__status {
  height: 0.875rem;
  width: 0.875rem;
  flex-shrink: 0;
}

.cc-chat-select__status--testing {
  animation: spin 1s linear infinite;
  color: var(--color-muted);
}

.cc-chat-select__status--ok {
  color: #16a34a;
}

.cc-chat-select__status--error {
  color: #dc2626;
}

.cc-chat-select__item {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  border-radius: 0.375rem;
  padding: 0.4375rem 0.5rem;
  text-align: left;
  font-size: 0.6875rem;
  color: var(--color-text);
}

.cc-chat-select__item:hover,
.cc-chat-select__item--active {
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
}

.cc-chat-select__desc {
  margin-top: 0.125rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-chat-select__empty {
  padding: 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-chat-select__hint {
  margin: 0 0.375rem 0.375rem;
  border-radius: 0.375rem;
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  padding: 0.375rem 0.5rem;
  font-size: 0.625rem;
  color: #b45309;
}

.cc-chat-input__send {
  display: inline-flex;
  height: 2rem;
  width: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: var(--color-link);
  color: white;
}

.cc-chat-input__send:disabled {
  opacity: 0.4;
}

.cc-chat-input__send--stop {
  background: color-mix(in srgb, #ef4444 85%, var(--color-link));
}
</style>
