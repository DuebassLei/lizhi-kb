<script setup lang="ts">
import { computed } from "vue";
import Btn from "../../ui/Btn.vue";
import Input from "../../ui/Input.vue";
import type { ProviderDraft, TestFeedback } from "../../../composables/useAiSettings";
import type { AiCloudPreset } from "../../../utils/aiCloudPresets";

const props = defineProps<{
  open: boolean;
  mode: "local" | "cloud";
  saving?: boolean;
  testing?: boolean;
  testFeedback?: TestFeedback | null;
  localBaseUrl: string;
  localModel: string;
  provider: ProviderDraft | null;
  preset: AiCloudPreset | null;
}>();

const emit = defineEmits<{
  close: [];
  save: [];
  test: [];
  "update:localBaseUrl": [value: string];
  "update:localModel": [value: string];
  "update:provider": [value: ProviderDraft];
}>();

const title = computed(() =>
  props.mode === "local" ? "编辑本地 Ollama" : `编辑 ${props.provider?.name || "云端模型"}`,
);

function patchProvider(patch: Partial<ProviderDraft>) {
  if (!props.provider) return;
  emit("update:provider", { ...props.provider, ...patch });
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="ai-model-dialog-backdrop"
      data-testid="ai-model-dialog"
      @click.self="emit('close')"
    >
      <div class="ai-model-dialog" role="dialog" aria-modal="true" :aria-label="title">
        <header class="ai-model-dialog__head">
          <h3 class="ai-model-dialog__title">{{ title }}</h3>
          <button type="button" class="ai-model-dialog__close focus-ring" aria-label="关闭" @click="emit('close')">
            ×
          </button>
        </header>

        <div v-if="mode === 'local'" class="ai-model-dialog__body">
          <div>
            <label class="ai-model-dialog__label">服务地址</label>
            <Input
              :model-value="localBaseUrl"
              :disabled="saving"
              @update:model-value="emit('update:localBaseUrl', $event)"
            />
          </div>
          <div>
            <label class="ai-model-dialog__label">模型名称</label>
            <Input
              :model-value="localModel"
              :disabled="saving"
              placeholder="qwen2.5:7b"
              @update:model-value="emit('update:localModel', $event)"
            />
          </div>
        </div>

        <div v-else-if="provider" class="ai-model-dialog__body">
          <p v-if="preset" class="ai-model-dialog__preset-hint">
            {{ preset.description }}
            <a
              v-if="preset.docsUrl"
              :href="preset.docsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="ai-model-dialog__docs-link"
            >
              {{ preset.docsLabel }} →
            </a>
          </p>
          <div>
            <label class="ai-model-dialog__label">显示名称</label>
            <Input
              :model-value="provider.name"
              :disabled="saving"
              @update:model-value="patchProvider({ name: $event })"
            />
          </div>
          <div>
            <label class="ai-model-dialog__label">API Base URL</label>
            <Input
              :model-value="provider.baseUrl"
              :disabled="saving"
              @update:model-value="patchProvider({ baseUrl: $event })"
            />
          </div>
          <div>
            <label class="ai-model-dialog__label">对话模型</label>
            <Input
              :model-value="provider.model"
              :disabled="saving"
              :list="preset ? 'ai-model-preset-chat' : undefined"
              :placeholder="preset?.models.find((m) => m.kind === 'chat')?.id"
              @update:model-value="patchProvider({ model: $event })"
            />
            <datalist v-if="preset" id="ai-model-preset-chat">
              <option
                v-for="m in preset.models.filter((x) => x.kind === 'chat')"
                :key="m.id"
                :value="m.id"
              >
                {{ m.label }}
              </option>
            </datalist>
            <p v-if="preset" class="ai-model-dialog__field-hint">可从列表选择或手动输入模型 ID</p>
          </div>
          <div>
            <label class="ai-model-dialog__label">图片模型（文生图，可选）</label>
            <Input
              :model-value="provider.imageModel"
              :disabled="saving"
              :list="preset ? 'ai-model-preset-image' : undefined"
              :placeholder="preset?.models.find((m) => m.kind === 'image')?.id || '留空则不可 AI 生图'"
              @update:model-value="patchProvider({ imageModel: $event })"
            />
            <datalist v-if="preset" id="ai-model-preset-image">
              <option
                v-for="m in preset.models.filter((x) => x.kind === 'image')"
                :key="m.id"
                :value="m.id"
              >
                {{ m.label }}
              </option>
            </datalist>
            <p class="ai-model-dialog__field-hint">
              用于写作助手封面 AI 生图（OpenAI 兼容 /images/generations）
            </p>
          </div>
          <div>
            <label class="ai-model-dialog__label">API Key</label>
            <Input
              :model-value="provider.apiKey"
              type="password"
              :disabled="saving"
              :placeholder="provider.apiKeyMasked || 'sk-…'"
              autocomplete="off"
              @update:model-value="patchProvider({ apiKey: $event })"
            />
          </div>
        </div>

        <p
          v-if="testFeedback"
          class="ai-model-dialog__test-result"
          :class="testFeedback.type === 'success' ? 'ai-model-dialog__test-result--success' : 'ai-model-dialog__test-result--error'"
          role="status"
          aria-live="polite"
          data-testid="ai-model-test-feedback"
        >
          {{ testFeedback.message }}
        </p>

        <footer class="ai-model-dialog__foot">
          <Btn variant="ghost" size="sm" :disabled="saving" @click="emit('close')">取消</Btn>
          <Btn variant="secondary" size="sm" :disabled="saving || testing" @click="emit('test')">
            {{ testing ? "测试中…" : "测试连接" }}
          </Btn>
          <Btn variant="primary" size="sm" :disabled="saving" @click="emit('save')">保存</Btn>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ai-model-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.45);
}

.ai-model-dialog {
  width: min(100%, 24rem);
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 16px 48px rgb(0 0 0 / 0.2);
}

.ai-model-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.ai-model-dialog__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.ai-model-dialog__close {
  border: 0;
  background: transparent;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--color-muted);
  cursor: pointer;
}

.ai-model-dialog__body {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}

.ai-model-dialog__preset-hint {
  margin: 0;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-link) 6%, var(--color-surface-1));
  padding: 0.5rem 0.625rem;
  font-size: 0.6875rem;
  line-height: 1.45;
  color: var(--color-muted);
}

.ai-model-dialog__docs-link {
  display: inline-block;
  margin-top: 0.25rem;
  color: var(--color-link);
}

.ai-model-dialog__label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.ai-model-dialog__field-hint {
  margin: 0.25rem 0 0;
  font-size: 0.625rem;
  line-height: 1.4;
  color: var(--color-muted);
}

.ai-model-dialog__foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--color-border);
}

.ai-model-dialog__test-result {
  margin: 0 1rem 0.75rem;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  line-height: 1.45;
}

.ai-model-dialog__test-result--success {
  border: 1px solid color-mix(in srgb, var(--color-secure) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-secure) 10%, var(--color-surface-1));
  color: var(--color-secure);
}

.ai-model-dialog__test-result--error {
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface-1));
  color: var(--color-danger);
}
</style>
