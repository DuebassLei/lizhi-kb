<script setup lang="ts">

import { computed, ref, watch } from "vue";

import { ChevronRight, Eye, EyeOff, Shield, X } from "@lucide/vue";



import type { CcProviderInput, CcProviderPublic } from "../../../services/ccWorkbenchService";

import { OFFICIAL_PROVIDER_ID } from "../../../services/ccWorkbenchService";

import {

  buildProviderJsonConfig,

  detectProviderModeFromBaseUrl,

  formatProviderJsonConfig,
  loadProviderJsonEditor,
  parseProviderJsonConfig,
  type ProviderJsonFields,

} from "../../../utils/ccProviderJson";

import {

  CC_OFFICIAL_PRESET,

  CC_PROVIDER_PRESETS,

  findCcProviderPreset,

  normalizeBaseUrl,

  presetToProviderMode,

  type CcProviderPreset,

} from "../../../utils/ccProviderPresets";

import Btn from "../../ui/Btn.vue";

import Input from "../../ui/Input.vue";



const props = defineProps<{

  open: boolean;

  provider: CcProviderPublic | null;

  saving?: boolean;

}>();



const emit = defineEmits<{

  close: [];

  save: [input: CcProviderInput];

}>();



const name = ref("");

const remark = ref("");

const apiKey = ref("");

const providerMode = ref<"official" | "custom">("custom");

const baseUrl = ref("");

const model = ref("");

const sonnetModel = ref("");

const opusModel = ref("");

const fastModel = ref("");

const envExtras = ref<Record<string, string>>({});

const presetId = ref<string | null>(null);

const showModelMapping = ref(true);

const showJsonConfig = ref(true);

const jsonConfig = ref("");

const jsonError = ref("");

const topLevelExtras = ref<Record<string, unknown>>({});
const syncingFromJson = ref(false);
const showApiKey = ref(false);



const isEdit = computed(() => Boolean(props.provider?.id && props.provider.id !== OFFICIAL_PROVIDER_ID));



const dialogTitle = computed(() =>

  isEdit.value ? `编辑供应商: ${props.provider?.name ?? ""}` : "添加供应商",

);



const dialogDescription = computed(() =>

  isEdit.value

    ? "更新配置后将立即应用到当前供应商。"

    : "配置 Claude 兼容供应商，默认使用官方直连模式。",

);



function currentJsonFields(): ProviderJsonFields {

  return {

    apiKey: apiKey.value,

    baseUrl: baseUrl.value,

    model: model.value,

    sonnetModel: sonnetModel.value,

    opusModel: opusModel.value,

    fastModel: fastModel.value,

    envExtras: envExtras.value,

  };

}



function rebuildJsonConfig() {

  jsonConfig.value = buildProviderJsonConfig(currentJsonFields(), topLevelExtras.value);

  jsonError.value = "";

}



function updateEnvField(key: string, value: string) {

  try {

    const { parsed } = parseProviderJsonConfig(jsonConfig.value);

    const env =

      parsed && jsonConfig.value.trim()

        ? { ...buildEnvFromFields(parsed.fields), [key]: value }

        : { ...buildEnvFromFields(currentJsonFields()), [key]: value };



    const trimmed = value.trim();

    if (!trimmed) delete env[key];

    else env[key] = value;



    const normalized = Object.fromEntries(

      Object.entries(env).filter(([, v]) => v.trim()),

    );

    const config: Record<string, unknown> = { ...topLevelExtras.value };

    if (Object.keys(normalized).length > 0) config.env = normalized;

    else delete config.env;



    jsonConfig.value = JSON.stringify(config, null, 2);

    jsonError.value = "";

  } catch {

    // JSON 无效时仅更新表单字段，保存时再校验

  }

}



function buildEnvFromFields(fields: ProviderJsonFields): Record<string, string> {

  const env: Record<string, string> = {};

  if (fields.apiKey.trim()) env.ANTHROPIC_AUTH_TOKEN = fields.apiKey.trim();

  if (fields.baseUrl.trim()) env.ANTHROPIC_BASE_URL = fields.baseUrl.trim();

  if (fields.model.trim()) env.ANTHROPIC_MODEL = fields.model.trim();

  if (fields.sonnetModel.trim()) env.ANTHROPIC_DEFAULT_SONNET_MODEL = fields.sonnetModel.trim();

  if (fields.opusModel.trim()) env.ANTHROPIC_DEFAULT_OPUS_MODEL = fields.opusModel.trim();

  if (fields.fastModel.trim()) env.ANTHROPIC_DEFAULT_HAIKU_MODEL = fields.fastModel.trim();

  for (const [k, v] of Object.entries(fields.envExtras)) {

    if (v.trim()) env[k] = v.trim();

  }

  return env;

}



function syncFieldsFromJson(raw: string) {

  const { parsed, error } = parseProviderJsonConfig(raw);

  if (error || !parsed) {

    jsonError.value = error ?? "JSON 格式无效";

    return;

  }

  syncingFromJson.value = true;

  apiKey.value = parsed.fields.apiKey;

  baseUrl.value = parsed.fields.baseUrl;

  model.value = parsed.fields.model;

  sonnetModel.value = parsed.fields.sonnetModel;

  opusModel.value = parsed.fields.opusModel;

  fastModel.value = parsed.fields.fastModel;

  envExtras.value = { ...parsed.fields.envExtras };

  topLevelExtras.value = { ...parsed.topLevelExtras };

  providerMode.value = detectProviderModeFromBaseUrl(parsed.fields.baseUrl);

  jsonError.value = "";

  syncingFromJson.value = false;

}



function onJsonChange(raw: string) {

  jsonConfig.value = raw;

  syncFieldsFromJson(raw);

}



function onFormatJson() {

  const { formatted, error } = formatProviderJsonConfig(jsonConfig.value);

  if (error) {

    jsonError.value = error;

    return;

  }

  jsonConfig.value = formatted;

  syncFieldsFromJson(formatted);

}



watch(

  () => [props.open, props.provider] as const,

  ([open, provider]) => {

    if (!open) return;

    if (!provider) {

      resetForCreate();

      return;

    }

    name.value = provider.name;

    remark.value = provider.remark;

    apiKey.value = provider.apiKey ?? "";

    providerMode.value = provider.providerMode;

    baseUrl.value = provider.baseUrl;

    model.value = provider.model;

    sonnetModel.value = provider.sonnetModel || provider.model;

    opusModel.value = provider.opusModel || provider.model;

    fastModel.value = provider.fastModel;

    envExtras.value = { ...(provider.envExtras ?? {}) };
    presetId.value = provider.presetId;
    showModelMapping.value = true;
    showJsonConfig.value = true;
    showApiKey.value = false;

    const loaded = loadProviderJsonEditor(provider);
    jsonConfig.value = loaded.json;
    syncFieldsFromJson(loaded.json);
    if (provider.apiKey) {
      apiKey.value = provider.apiKey;
      rebuildJsonConfig();
    }
  },

  { immediate: true },

);



function resetForCreate() {

  name.value = "";

  remark.value = "";

  apiKey.value = "";

  providerMode.value = "official";

  baseUrl.value = "";

  model.value = "";

  sonnetModel.value = "";

  opusModel.value = "";

  fastModel.value = "";

  envExtras.value = {};

  presetId.value = "official";
  topLevelExtras.value = {};
  showModelMapping.value = true;
  showJsonConfig.value = true;
  showApiKey.value = false;
  rebuildJsonConfig();
}



function applyPreset(preset: CcProviderPreset) {

  presetId.value = preset.id;

  providerMode.value = presetToProviderMode(preset);

  baseUrl.value = preset.baseUrl;

  model.value = preset.model;

  sonnetModel.value = preset.sonnetModel;

  opusModel.value = preset.opusModel;

  fastModel.value = preset.fastModel;

  envExtras.value = { ...(preset.envExtras ?? {}) };

  if (!name.value.trim()) name.value = preset.name;

  rebuildJsonConfig();

}



function onApiKeyChange(value: string) {

  apiKey.value = value;

  if (!syncingFromJson.value) updateEnvField("ANTHROPIC_AUTH_TOKEN", value);

}



function onBaseUrlChange(value: string) {

  baseUrl.value = value;

  providerMode.value = detectProviderModeFromBaseUrl(value);

  if (!syncingFromJson.value) updateEnvField("ANTHROPIC_BASE_URL", value);

}



function onModelChange(value: string) {

  model.value = value;

  if (!syncingFromJson.value) updateEnvField("ANTHROPIC_MODEL", value);

}



function onSonnetChange(value: string) {

  sonnetModel.value = value;

  if (!syncingFromJson.value) updateEnvField("ANTHROPIC_DEFAULT_SONNET_MODEL", value);

}



function onOpusChange(value: string) {

  opusModel.value = value;

  if (!syncingFromJson.value) updateEnvField("ANTHROPIC_DEFAULT_OPUS_MODEL", value);

}



function onFastChange(value: string) {

  fastModel.value = value;

  if (!syncingFromJson.value) updateEnvField("ANTHROPIC_DEFAULT_HAIKU_MODEL", value);

}



function onSave() {

  const { parsed, error } = parseProviderJsonConfig(jsonConfig.value);

  if (error || !parsed) {

    jsonError.value = error ?? "JSON 格式无效";

    return;

  }



  const fields = parsed.fields;

  const main = fields.model.trim();

  const sonnet = fields.sonnetModel.trim() || main;

  const opus = fields.opusModel.trim() || main;

  const fast = fields.fastModel.trim() || main;



  emit("save", {

    id: props.provider?.id,

    name: name.value.trim(),

    remark: remark.value.trim(),

    presetId: presetId.value,

    providerMode: detectProviderModeFromBaseUrl(fields.baseUrl),

    baseUrl: normalizeBaseUrl(fields.baseUrl),

    model: main,

    sonnetModel: sonnet,

    opusModel: opus,

    fastModel: fast,

    apiKey: fields.apiKey || apiKey.value,
    envExtras: Object.keys(fields.envExtras).length ? fields.envExtras : {},
    settingsConfig: jsonConfig.value.trim() || undefined,
  });
}

</script>



<template>

  <Teleport to="body">

    <Transition name="cc-dialog">

      <div v-if="open" class="cc-provider-dialog__overlay" @click.self="emit('close')">

        <div class="cc-provider-dialog" role="dialog" aria-modal="true">

          <header class="cc-provider-dialog__header">

            <h3 class="text-sm font-semibold">{{ dialogTitle }}</h3>

            <button type="button" class="cc-provider-dialog__close" @click="emit('close')">

              <X class="h-4 w-4" />

            </button>

          </header>



          <div class="cc-provider-dialog__body">

            <p class="cc-provider-dialog__desc">{{ dialogDescription }}</p>

            <div class="cc-provider-dialog__notice">
              <Shield class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>声明：当前设置全部在您电脑本地，本项目100%开源，请放心使用</span>
            </div>

            <div class="cc-provider-dialog__section">

              <span class="cc-provider-dialog__section-label">官方直连 API</span>

              <div class="cc-provider-dialog__presets">

                <button

                  type="button"

                  class="cc-preset-chip"

                  :class="{ 'cc-preset-chip--active': presetId === 'official' }"

                  @click="applyPreset(CC_OFFICIAL_PRESET)"

                >

                  Anthropic 官方直连

                </button>

              </div>

              <p class="cc-provider-dialog__hint">

                使用您手动填写的凭证，并直接连接到官方端点 https://api.anthropic.com。

              </p>

            </div>



            <div class="cc-provider-dialog__section">

              <span class="cc-provider-dialog__section-label">第三方 / 代理预设</span>

              <div class="cc-provider-dialog__presets">

                <button

                  v-for="preset in CC_PROVIDER_PRESETS"

                  :key="preset.id"

                  type="button"

                  class="cc-preset-chip"

                  :class="{ 'cc-preset-chip--active': presetId === preset.id }"

                  @click="applyPreset(preset)"

                >

                  {{ preset.name }}

                </button>

              </div>

              <p class="cc-provider-dialog__hint">

                以下预设会把请求路由到第三方或代理供应商端点，而不是 Anthropic 官方 API。

              </p>

            </div>



            <label class="cc-field">

              <span>供应商名称 <span class="text-[var(--color-danger,#e53e3e)]">*</span></span>

              <Input v-model="name" placeholder="例如：DeepSeek 官方" />

            </label>

            <label class="cc-field">

              <span>备注（可选）</span>

              <Input v-model="remark" placeholder="用途说明" />

            </label>



            <label class="cc-field">
              <span>Auth Token / API Key <span class="text-[var(--color-danger,#e53e3e)]">*</span></span>
              <div class="relative">
                <Input
                  :model-value="apiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  placeholder="sk-…"
                  autocomplete="off"
                  class="pr-9"
                  @update:model-value="onApiKeyChange"
                />
                <button
                  type="button"
                  class="cc-provider-dialog__visibility-toggle focus-ring"
                  :aria-label="showApiKey ? '隐藏' : '显示'"
                  :title="showApiKey ? '隐藏' : '显示'"
                  @click="showApiKey = !showApiKey"
                >
                  <EyeOff v-if="showApiKey" class="h-3.5 w-3.5" aria-hidden="true" />
                  <Eye v-else class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </label>

            <p v-if="provider?.apiKeyMasked && !apiKey" class="text-xs text-muted">

              已配置：{{ provider.apiKeyMasked }}

            </p>



            <template v-if="providerMode === 'custom'">

              <label class="cc-field">

                <span>请求地址 (API Base URL) <span class="text-[var(--color-danger,#e53e3e)]">*</span></span>

                <Input

                  :model-value="baseUrl"

                  placeholder="https://api.deepseek.com/anthropic"

                  @update:model-value="onBaseUrlChange"

                />

              </label>

              <p class="cc-provider-dialog__hint">

                填写兼容 Claude API 的服务端点。

              </p>

              <label class="cc-field">

                <span>默认模型（ANTHROPIC_MODEL，可选）</span>

                <Input

                  :model-value="model"

                  placeholder="留空则仅使用下方分级映射"

                  @update:model-value="onModelChange"

                />

              </label>

              <a

                v-if="presetId && findCcProviderPreset(presetId)?.docsUrl"

                :href="findCcProviderPreset(presetId)!.docsUrl"

                target="_blank"

                rel="noopener noreferrer"

                class="text-xs text-link hover:underline"

              >

                {{ findCcProviderPreset(presetId)!.docsLabel ?? "文档" }} →

              </a>

            </template>



            <div class="cc-provider-dialog__section">

              <button

                type="button"

                class="cc-provider-dialog__toggle"

                @click="showModelMapping = !showModelMapping"

              >

                <ChevronRight

                  class="h-3.5 w-3.5 transition-transform"

                  :class="{ 'rotate-90': showModelMapping }"

                />

                模型映射（会注入到 JSON 的 env 里）

              </button>

              <div v-if="showModelMapping" class="grid grid-cols-1 gap-2 sm:grid-cols-3">

                <label class="cc-field">

                  <span>Sonnet 默认模型</span>

                  <Input

                    :model-value="sonnetModel"

                    placeholder="例如：claude-sonnet-4-6"

                    @update:model-value="onSonnetChange"

                  />

                </label>

                <label class="cc-field">

                  <span>Opus 默认模型</span>

                  <Input

                    :model-value="opusModel"

                    placeholder="例如：claude-opus-4-6"

                    @update:model-value="onOpusChange"

                  />

                </label>

                <label class="cc-field">

                  <span>Haiku 默认模型</span>

                  <Input

                    :model-value="fastModel"

                    placeholder="例如：claude-haiku-4-5"

                    @update:model-value="onFastChange"

                  />

                </label>

              </div>

              <p v-if="showModelMapping" class="cc-provider-dialog__hint">

                可选：指定默认使用的 Claude 模型，留空则使用系统默认。

              </p>

            </div>



            <details class="cc-provider-dialog__json-section" :open="showJsonConfig">

              <summary

                class="cc-provider-dialog__toggle"

                @click.prevent="showJsonConfig = !showJsonConfig"

              >

                <ChevronRight

                  class="h-3.5 w-3.5 transition-transform"

                  :class="{ 'rotate-90': showJsonConfig }"

                />

                配置 JSON

              </summary>

              <div v-if="showJsonConfig" class="cc-provider-dialog__json-body">

                <p class="cc-provider-dialog__hint">

                  此处可配置完整的 settings.json 内容，支持所有字段（如 model、alwaysThinkingEnabled、ccSwitchProviderId 等）

                </p>

                <div class="cc-provider-dialog__json-toolbar">

                  <Btn variant="ghost" size="sm" @click="onFormatJson">格式化</Btn>

                </div>

                <textarea

                  class="cc-provider-dialog__json-editor"

                  :value="jsonConfig"

                  rows="12"

                  spellcheck="false"

                  placeholder='{

  "env": {

    "ANTHROPIC_AUTH_TOKEN": "",

    "ANTHROPIC_BASE_URL": "",

    "ANTHROPIC_DEFAULT_SONNET_MODEL": "",

    "ANTHROPIC_DEFAULT_OPUS_MODEL": "",

    "ANTHROPIC_DEFAULT_HAIKU_MODEL": ""

  }

}'

                  @input="onJsonChange(($event.target as HTMLTextAreaElement).value)"

                />

                <p v-if="jsonError" class="cc-provider-dialog__json-error">{{ jsonError }}</p>

              </div>

            </details>

          </div>



          <footer class="cc-provider-dialog__footer">

            <Btn variant="ghost" size="sm" @click="emit('close')">取消</Btn>

            <Btn variant="secondary" size="sm" :disabled="saving || !!jsonError" @click="onSave">

              {{ saving ? "保存中…" : isEdit ? "保存更改" : "确认添加" }}

            </Btn>

          </footer>

        </div>

      </div>

    </Transition>

  </Teleport>

</template>



<style scoped>

.cc-provider-dialog__overlay {

  position: fixed;

  inset: 0;

  z-index: 60;

  display: flex;

  align-items: center;

  justify-content: center;

  background: var(--color-overlay, rgba(0, 0, 0, 0.45));

  padding: 1rem;

}



.cc-provider-dialog {

  width: min(100%, 36rem);

  max-height: min(90vh, 48rem);

  overflow: hidden;

  display: flex;

  flex-direction: column;

  border-radius: 0.875rem;

  border: 1px solid var(--color-border);

  background: var(--color-surface-0);

  box-shadow: 0 24px 48px color-mix(in srgb, #000 25%, transparent);

}



.cc-provider-dialog__header,

.cc-provider-dialog__footer {

  display: flex;

  align-items: center;

  justify-content: space-between;

  padding: 0.875rem 1rem;

  border-bottom: 1px solid var(--color-border);

}



.cc-provider-dialog__footer {

  border-bottom: none;

  border-top: 1px solid var(--color-border);

  justify-content: flex-end;

  gap: 0.5rem;

}



.cc-provider-dialog__body {

  overflow-y: auto;

  padding: 1rem;

  display: flex;

  flex-direction: column;

  gap: 0.75rem;

}



.cc-provider-dialog__desc {
  font-size: 0.75rem;
  color: var(--color-muted);
  margin: 0;
}

.cc-provider-dialog__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.5rem;
  border: 1px solid color-mix(in srgb, var(--color-link) 35%, transparent);
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  font-size: 0.6875rem;
  line-height: 1.45;
  color: var(--color-link);
}

.cc-provider-dialog__visibility-toggle {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  border-radius: 0.25rem;
  padding: 0.125rem;
  color: var(--color-muted);
}

.cc-provider-dialog__visibility-toggle:hover {
  color: var(--color-text);
}

.cc-provider-dialog__section {

  display: flex;

  flex-direction: column;

  gap: 0.375rem;

}



.cc-provider-dialog__section-label {

  font-size: 0.75rem;

  font-weight: 500;

  color: var(--color-text);

}



.cc-provider-dialog__presets {

  display: flex;

  flex-wrap: wrap;

  gap: 0.375rem;

}



.cc-preset-chip {

  border-radius: 999px;

  border: 1px solid var(--color-border);

  padding: 0.25rem 0.625rem;

  font-size: 0.6875rem;

  color: var(--color-muted);

}



.cc-preset-chip--active {

  border-color: var(--color-link);

  background: color-mix(in srgb, var(--color-link) 10%, transparent);

  color: var(--color-link);

}



.cc-field {

  display: flex;

  flex-direction: column;

  gap: 0.25rem;

  font-size: 0.75rem;

  color: var(--color-muted);

}



.cc-provider-dialog__hint {

  font-size: 0.6875rem;

  color: var(--color-muted);

  margin: 0;

  line-height: 1.4;

}



.cc-provider-dialog__toggle {

  display: flex;

  align-items: center;

  gap: 0.25rem;

  font-size: 0.75rem;

  font-weight: 500;

  color: var(--color-text);

  text-align: left;

}



.cc-provider-dialog__json-section {

  border-top: 1px solid var(--color-border);

  padding-top: 0.75rem;

}



.cc-provider-dialog__json-section > summary {

  list-style: none;

  cursor: pointer;

}



.cc-provider-dialog__json-section > summary::-webkit-details-marker {

  display: none;

}



.cc-provider-dialog__json-body {

  margin-top: 0.5rem;

  display: flex;

  flex-direction: column;

  gap: 0.5rem;

}



.cc-provider-dialog__json-toolbar {

  display: flex;

  justify-content: flex-end;

}



.cc-provider-dialog__json-editor {

  width: 100%;

  min-height: 12rem;

  resize: vertical;

  border-radius: 0.5rem;

  border: 1px solid var(--color-border);

  background: var(--color-surface-1, var(--color-surface-0));

  padding: 0.625rem 0.75rem;

  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  font-size: 0.6875rem;

  line-height: 1.5;

  color: var(--color-text);

}



.cc-provider-dialog__json-editor:focus {

  outline: 2px solid color-mix(in srgb, var(--color-link) 40%, transparent);

  outline-offset: 1px;

}



.cc-provider-dialog__json-error {

  font-size: 0.6875rem;

  color: var(--color-danger, #e53e3e);

  margin: 0;

}



.cc-provider-dialog__close {

  color: var(--color-muted);

}



.cc-dialog-enter-active,

.cc-dialog-leave-active {

  transition: opacity 0.18s ease;

}



.cc-dialog-enter-from,

.cc-dialog-leave-to {

  opacity: 0;

}

</style>

