<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Bot, ChevronRight, Cloud, Plus, Sparkles, Trash2 } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import Input from "../ui/Input.vue";
import {
  getAiConfig,
  setAiConfig,
  testAiConnection,
  type AiConfigPublic,
  type CloudProviderInput,
  type LlmTarget,
} from "../../services/aiService";
import { useChatStore } from "../../stores/chat";
import { useUiStore } from "../../stores/ui";
import {
  AI_CLOUD_PRESETS,
  findPresetByBaseUrl,
  providerMatchesPreset,
  type AiCloudPreset,
} from "../../utils/aiCloudPresets";

const ui = useUiStore();
const chat = useChatStore();

const loading = ref(true);
const saving = ref(false);
const testingId = ref<LlmTarget | null>(null);
const config = ref<AiConfigPublic | null>(null);

const localBaseUrl = ref("http://127.0.0.1:11434");
const localModel = ref("qwen2.5:7b");
const ragTopK = ref("8");

interface ProviderDraft {
  id?: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  apiKeyMasked: string;
}

const providerDrafts = ref<ProviderDraft[]>([]);
const selectedIndex = ref<number | null>(null);

const selectedProvider = computed(() =>
  selectedIndex.value !== null ? providerDrafts.value[selectedIndex.value] ?? null : null,
);

const selectedPreset = computed(() => {
  const provider = selectedProvider.value;
  if (!provider) return null;
  return findPresetByBaseUrl(provider.baseUrl) ?? null;
});

const selectedPresetModel = computed(() => {
  const preset = selectedPreset.value;
  const provider = selectedProvider.value;
  if (!preset || !provider) return null;
  return preset.models.find((m) => m.id === provider.model) ?? null;
});

function draftFromPreset(preset: AiCloudPreset): ProviderDraft {
  return {
    name: preset.name,
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey: "",
    apiKeyMasked: "",
  };
}

function newProviderDraft(): ProviderDraft {
  return {
    name: "新提供商",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKey: "",
    apiKeyMasked: "",
  };
}

function providerRowKey(index: number, provider: ProviderDraft): string {
  return provider.id ?? `new-${index}`;
}

function hasApiKey(provider: ProviderDraft): boolean {
  return Boolean(provider.apiKey.trim() || provider.apiKeyMasked);
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function loadConfig(revealKey = false, quiet = false) {
  if (!quiet) loading.value = true;
  try {
    config.value = await getAiConfig(revealKey);
    localBaseUrl.value = config.value.localBaseUrl;
    localModel.value = config.value.localModel;
    ragTopK.value = String(config.value.ragTopK);
    providerDrafts.value = config.value.cloudProviders.map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      model: p.model,
      apiKey: p.apiKey ?? "",
      apiKeyMasked: p.apiKeyMasked,
    }));
    if (
      selectedIndex.value !== null &&
      selectedIndex.value >= providerDrafts.value.length
    ) {
      selectedIndex.value = providerDrafts.value.length ? 0 : null;
    }
  } catch (e) {
    if (!quiet) {
      ui.showToast("error", e instanceof Error ? e.message : "加载 AI 配置失败");
    }
  } finally {
    if (!quiet) loading.value = false;
  }
}

function toProviderInput(d: ProviderDraft): CloudProviderInput {
  const input: CloudProviderInput = {
    id: d.id,
    name: d.name.trim(),
    baseUrl: d.baseUrl.trim(),
    model: d.model.trim(),
  };
  if (d.apiKey.trim()) {
    input.apiKey = d.apiKey.trim();
  }
  return input;
}

async function persist(
  update: Parameters<typeof setAiConfig>[0],
  options?: { quiet?: boolean },
) {
  if (!config.value) return;
  const quiet = options?.quiet ?? false;
  saving.value = true;
  try {
    config.value = await setAiConfig(update);
    if (!quiet) ui.showToast("success", "AI 配置已保存");
    void chat.loadAiEnabled();
    await loadConfig(true, quiet);
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "保存失败");
    await loadConfig(false, quiet);
  } finally {
    saving.value = false;
  }
}

async function onToggleEnabled(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  await persist({ enabled: checked });
}

async function onToggleCloud(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  await persist({ cloudEnabled: checked });
}

async function onToggleWrite(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  await persist({ writeEnabled: checked });
}

async function saveLocalSettings() {
  const topK = Number.parseInt(ragTopK.value, 10);
  await persist({
    localBaseUrl: localBaseUrl.value.trim(),
    localModel: localModel.value.trim(),
    ragTopK: Number.isFinite(topK) ? topK : 8,
  });
}

async function saveCloudProviders(quiet = false) {
  const topK = Number.parseInt(ragTopK.value, 10);
  await persist(
    {
      cloudProviders: providerDrafts.value.map(toProviderInput),
      ragTopK: Number.isFinite(topK) ? topK : 8,
      activeCloudProviderId:
        config.value?.activeCloudProviderId ??
        providerDrafts.value[0]?.id ??
        null,
    },
    { quiet },
  );
}

function selectProvider(index: number) {
  selectedIndex.value = index;
}

function addProvider() {
  providerDrafts.value.push(newProviderDraft());
  selectedIndex.value = providerDrafts.value.length - 1;
}

async function addProviderFromPreset(preset: AiCloudPreset) {
  const existingIndex = providerDrafts.value.findIndex((p) =>
    providerMatchesPreset(p, preset),
  );
  if (existingIndex >= 0) {
    selectedIndex.value = existingIndex;
    ui.showToast("success", `已选中「${preset.name}」配置`);
    return;
  }
  if (config.value && !config.value.cloudEnabled) {
    await persist({ cloudEnabled: true });
  }
  providerDrafts.value.push(draftFromPreset(preset));
  selectedIndex.value = providerDrafts.value.length - 1;
}

function isPresetConfigured(preset: AiCloudPreset): boolean {
  return providerDrafts.value.some((p) => providerMatchesPreset(p, preset));
}

function removeSelectedProvider() {
  if (selectedIndex.value === null) return;
  const index = selectedIndex.value;
  providerDrafts.value.splice(index, 1);
  if (!providerDrafts.value.length) {
    selectedIndex.value = null;
    return;
  }
  selectedIndex.value = Math.min(index, providerDrafts.value.length - 1);
}

async function runTest(target: LlmTarget) {
  testingId.value = target;
  try {
    if (target === "local") {
      await saveLocalSettings();
    } else {
      const draft = providerDrafts.value.find((p) => p.id === target);
      if (draft && !hasApiKey(draft)) {
        ui.showToast("error", "请先填写 API Key");
        return;
      }
      await saveCloudProviders(true);
    }
    const result = await testAiConnection(target);
    ui.showToast(result.ok ? "success" : "error", result.message);
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "连接测试失败");
  } finally {
    testingId.value = null;
  }
}

async function testSelectedProvider() {
  const provider = selectedProvider.value;
  if (!provider) return;

  if (!provider.id) {
    if (!hasApiKey(provider)) {
      ui.showToast("error", "请先填写 API Key 并保存");
      return;
    }
    await saveCloudProviders(true);
  }

  const targetId = selectedProvider.value?.id;
  if (!targetId) {
    ui.showToast("error", "请先保存提供商配置");
    return;
  }
  await runTest(targetId);
}

function isTestingProvider(provider: ProviderDraft): boolean {
  return testingId.value !== null && testingId.value === provider.id;
}

const networkHint = computed(() => {
  if (!config.value?.enabled) return "AI 未启用 · 零外联";
  if (config.value.cloudEnabled && config.value.cloudProviders.length > 0) {
    return `AI 外联：已配置 ${config.value.cloudProviders.length} 个云端提供商`;
  }
  if (config.value.cloudEnabled) return "AI 外联：已开启，请添加云端提供商";
  return "AI：本地模型；知识库可选用「仅检索」模式（零外联、无需大模型）";
});

watch(
  () => config.value?.cloudEnabled,
  (enabled) => {
    if (!enabled) selectedIndex.value = null;
  },
);

onMounted(() => {
  void loadConfig(true);
});
</script>

<template>
  <section id="settings-ai" class="settings-section mb-8 max-w-lg scroll-mt-6" data-testid="ai-settings-panel">
    <div class="mb-3 flex items-center gap-2">
      <Sparkles class="h-4 w-4 text-link" aria-hidden="true" />
      <h2 class="text-sm font-medium uppercase tracking-wide text-text-secondary">AI 助手</h2>
    </div>

    <div v-if="loading" class="text-sm text-muted">加载中…</div>

    <div
      v-else-if="config"
      class="space-y-4 rounded-lg border border-border bg-surface-0 p-4"
    >
      <p class="text-sm text-muted">
        应用内 AI 对话：闲聊（通用对话）、知识库（检索问答）、笔记助手（操作笔记）。可配置多个云端 API，在对话时动态切换模型。
      </p>

      <p class="rounded-md border border-divider bg-surface-1 px-3 py-2 text-xs text-muted">
        {{ networkHint }}
      </p>

      <label
        class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between rounded-md border border-divider px-3 py-3 text-sm"
      >
        <span>
          启用 AI 助手
          <span class="mt-0.5 block text-xs text-muted">开启后工作区与 /ai 页面可用</span>
        </span>
        <input
          type="checkbox"
          class="accent-link"
          :checked="config.enabled"
          :disabled="saving"
          data-testid="ai-enabled-toggle"
          @change="onToggleEnabled"
        />
      </label>

      <div class="space-y-3 rounded-md border border-divider bg-surface-1 px-3 py-3 text-sm">
        <p class="flex items-center gap-1.5 font-medium">
          <Bot class="h-3.5 w-3.5" aria-hidden="true" />
          本地模型（Ollama）
        </p>
        <div>
          <label class="mb-1 block text-xs text-muted">服务地址</label>
          <Input v-model="localBaseUrl" :disabled="saving" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted">模型名称</label>
          <Input v-model="localModel" :disabled="saving" placeholder="qwen2.5:7b" />
        </div>
        <Btn
          variant="secondary"
          size="sm"
          :disabled="saving || testingId === 'local'"
          data-testid="ai-test-local"
          @click="runTest('local')"
        >
          {{ testingId === "local" ? "测试中…" : "测试本地连接" }}
        </Btn>
      </div>

      <details class="text-sm" :open="config.cloudEnabled || providerDrafts.length > 0">
        <summary class="cursor-pointer text-muted hover:text-text">云端 API（opt-in，可多个）</summary>
        <div class="mt-3 space-y-3 rounded-md border border-divider bg-surface-1 px-3 py-3">
          <div class="rounded-md border border-divider bg-surface-0 px-3 py-3">
            <p class="mb-2 text-xs font-medium text-muted">快速添加外部 AI</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="preset in AI_CLOUD_PRESETS"
                :key="preset.id"
                type="button"
                class="focus-ring inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
                :class="
                  isPresetConfigured(preset)
                    ? 'border-link/40 bg-link/10 text-link'
                    : 'border-divider bg-surface-1 text-[var(--color-text)] hover:bg-surface-2'
                "
                :data-testid="`ai-preset-${preset.id}`"
                :disabled="saving"
                @click="addProviderFromPreset(preset)"
              >
                <Sparkles class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {{ preset.name }}
                <span v-if="isPresetConfigured(preset)" class="text-[10px] text-muted">
                  已添加
                </span>
              </button>
            </div>
            <p class="mt-2 text-[10px] leading-relaxed text-muted">
              预设使用 OpenAI 兼容
              <code class="text-link">/v1/chat/completions</code>
              接口，认证方式为
              <code class="text-link">Authorization: Bearer API_KEY</code>。
              Base URL 填到
              <code class="text-link">/v1</code>
              即可（如小鲸鱼：
              <code class="text-link">https://lab.iwhalecloud.com/gpt-proxy/v1</code>）。
            </p>
          </div>

          <label class="flex items-center justify-between">
            <span class="text-sm">启用云端 API</span>
            <input
              type="checkbox"
              class="accent-link"
              :checked="config.cloudEnabled"
              :disabled="saving"
              @change="onToggleCloud"
            />
          </label>

          <div v-if="config.cloudEnabled" class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-medium text-muted">已配置提供商</p>
              <Btn variant="ghost" size="sm" :disabled="saving" @click="addProvider">
                <Plus class="mr-1 h-3.5 w-3.5" />
                添加
              </Btn>
            </div>

            <div
              v-if="!providerDrafts.length"
              class="rounded-lg border border-dashed border-divider px-3 py-6 text-center text-xs text-muted"
            >
              暂无云端提供商，点击「添加」创建
            </div>

            <ul
              v-else
              class="overflow-hidden rounded-lg border border-divider"
              role="listbox"
              aria-label="云端提供商列表"
            >
              <li
                v-for="(provider, index) in providerDrafts"
                :key="providerRowKey(index, provider)"
              >
                <button
                  type="button"
                  role="option"
                  class="focus-ring flex w-full items-center gap-2.5 border-b border-divider px-2.5 py-2 text-left transition-colors last:border-b-0"
                  :class="
                    selectedIndex === index
                      ? 'bg-link/10'
                      : 'bg-surface-0 hover:bg-surface-2'
                  "
                  :aria-selected="selectedIndex === index"
                  :data-testid="`ai-cloud-provider-row-${index}`"
                  @click="selectProvider(index)"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400"
                    aria-hidden="true"
                  >
                    <Cloud class="h-4 w-4" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-[var(--color-text)]">
                      {{ provider.name || "未命名提供商" }}
                    </span>
                    <span class="block truncate text-xs text-muted">
                      {{ provider.model }} · {{ hostLabel(provider.baseUrl) }}
                    </span>
                  </span>
                  <span
                    v-if="hasApiKey(provider)"
                    class="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-border"
                  >
                    Key
                  </span>
                  <ChevronRight
                    class="h-4 w-4 shrink-0 text-muted"
                    :class="selectedIndex === index ? 'text-link' : ''"
                    aria-hidden="true"
                  />
                </button>
              </li>
            </ul>

            <div
              v-if="selectedProvider && selectedIndex !== null"
              class="space-y-3 rounded-lg border border-divider bg-surface-0 p-3"
              data-testid="ai-cloud-provider-editor"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-medium text-muted">
                  编辑 · {{ selectedProvider.name || "未命名提供商" }}
                </p>
                <button
                  type="button"
                  class="focus-ring rounded p-1 text-muted hover:text-danger"
                  aria-label="删除此提供商"
                  :disabled="saving"
                  @click="removeSelectedProvider"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>

              <div class="grid gap-2 sm:grid-cols-2">
                <div class="sm:col-span-2">
                  <label class="mb-1 block text-xs text-muted">显示名称</label>
                  <Input
                    v-model="providerDrafts[selectedIndex].name"
                    :disabled="saving"
                    placeholder="DeepSeek"
                  />
                </div>
                <div class="sm:col-span-2">
                  <label class="mb-1 block text-xs text-muted">API Base URL</label>
                  <Input
                    v-model="providerDrafts[selectedIndex].baseUrl"
                    :disabled="saving"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">模型</label>
                  <select
                    v-if="selectedPreset"
                    v-model="providerDrafts[selectedIndex].model"
                    class="input-field focus-ring w-full rounded-md border border-border bg-surface-1 px-3 py-1.5 text-sm"
                    :disabled="saving"
                  >
                    <option
                      v-for="m in selectedPreset.models"
                      :key="m.id"
                      :value="m.id"
                    >
                      {{ m.label }}
                    </option>
                  </select>
                  <Input
                    v-else
                    v-model="providerDrafts[selectedIndex].model"
                    :disabled="saving"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">API Key</label>
                  <Input
                    v-model="providerDrafts[selectedIndex].apiKey"
                    type="password"
                    :disabled="saving"
                    :placeholder="selectedProvider.apiKeyMasked || (selectedPreset ? 'ailab_…（勿填 Bearer 前缀）' : 'sk-…')"
                    autocomplete="off"
                  />
                  <p class="mt-1 text-[10px] text-muted">
                    仅填写 Key 本身，无需加
                    <code class="text-link">Bearer</code>
                    前缀（保存时会自动处理）。
                  </p>
                </div>
              </div>

              <p
                v-if="selectedPresetModel?.kind === 'image'"
                class="text-[10px] leading-relaxed text-warning"
              >
                图像模型使用
                <code class="text-link">/v1/images/generations</code>
                接口（文生图/图生图），AI 对话请选用 Agnes 2.0 Flash。
              </p>

              <p
                v-if="selectedPreset"
                class="text-[10px] leading-relaxed text-muted"
              >
                {{ selectedPreset.description }} ·
                <a
                  :href="selectedPreset.docsUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-link hover:underline"
                >
                  查看文档
                </a>
              </p>

              <div class="flex flex-wrap gap-2">
                <Btn
                  variant="secondary"
                  size="sm"
                  :disabled="saving || isTestingProvider(selectedProvider)"
                  data-testid="ai-test-cloud"
                  @click="testSelectedProvider"
                >
                  {{
                    isTestingProvider(selectedProvider) ? "测试中…" : "测试连接"
                  }}
                </Btn>
                <Btn
                  variant="primary"
                  size="sm"
                  :disabled="saving"
                  @click="saveCloudProviders"
                >
                  保存
                </Btn>
              </div>
            </div>

            <p
              v-else-if="providerDrafts.length"
              class="text-center text-xs text-muted"
            >
              选择列表中的提供商以编辑
            </p>

            <div>
              <label class="mb-1 block text-xs text-muted">RAG 检索条数（1–20）</label>
              <Input v-model="ragTopK" type="number" min="1" max="20" :disabled="saving" />
            </div>
          </div>
        </div>
      </details>

      <label
        class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between rounded-md border border-divider px-3 py-3 text-sm"
      >
        <span>
          笔记助手允许写笔记
          <span class="mt-0.5 block text-xs text-muted">关闭时笔记助手仅可搜索与读取</span>
        </span>
        <input
          type="checkbox"
          class="accent-link"
          :checked="config.writeEnabled"
          :disabled="saving"
          data-testid="ai-write-enabled-toggle"
          @change="onToggleWrite"
        />
      </label>

      <Btn variant="secondary" size="sm" :disabled="saving" @click="saveLocalSettings">
        保存本地设置
      </Btn>
    </div>
  </section>
</template>
