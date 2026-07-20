<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { Check, ChevronDown, Cloud, Cpu, Pencil, Plus, Sparkles, Trash2 } from "@lucide/vue";
import Btn from "../../ui/Btn.vue";
import ConfirmDialog from "../../common/ConfirmDialog.vue";
import type { ProviderDraft } from "../../../composables/useAiSettings";
import { providerMatchesPreset, type AiCloudPreset } from "../../../utils/aiCloudPresets";

const props = defineProps<{
  localEnabled: boolean;
  localModel: string;
  localBaseUrl: string;
  cloudEnabled: boolean;
  providers: ProviderDraft[];
  activeCloudProviderId: string | null;
  presets: AiCloudPreset[];
  saving?: boolean;
  testingId?: string | null;
}>();

const emit = defineEmits<{
  toggleLocal: [enabled: boolean];
  editLocal: [];
  testLocal: [];
  toggleCloud: [index: number, enabled: boolean];
  setDefault: [providerId: string];
  editCloud: [index: number];
  deleteCloud: [index: number];
  testCloud: [index: number];
  quickPreset: [preset: AiCloudPreset];
  addCustom: [];
}>();

const addMenuOpen = ref(false);
const addMenuRef = ref<HTMLElement | null>(null);
const deletePending = ref<{ index: number; name: string } | null>(null);

function isPresetConfigured(preset: AiCloudPreset): boolean {
  return props.providers.some((p) => providerMatchesPreset(p, preset));
}

function providerKey(index: number, provider: ProviderDraft): string {
  return provider.id ?? `new-${index}`;
}

function onDelete(index: number) {
  const provider = props.providers[index];
  if (!provider) return;
  deletePending.value = { index, name: provider.name || "未命名" };
}

function confirmDelete() {
  if (!deletePending.value) return;
  const { index } = deletePending.value;
  deletePending.value = null;
  emit("deleteCloud", index);
}

function onQuickPreset(preset: AiCloudPreset) {
  addMenuOpen.value = false;
  emit("quickPreset", preset);
}

function onAddCustom() {
  addMenuOpen.value = false;
  emit("addCustom");
}

function onClickOutside(event: MouseEvent) {
  if (addMenuRef.value && !addMenuRef.value.contains(event.target as Node)) {
    addMenuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", onClickOutside);
});
</script>

<template>
  <div class="ai-model-list" data-testid="ai-model-list">
    <div class="ai-model-list__header">
      <div>
        <h3 class="text-sm font-medium">模型配置</h3>
        <p class="mt-0.5 text-xs text-muted">启用/停用各模型，对话时可切换；优先本地 Ollama</p>
      </div>
      <div ref="addMenuRef" class="ai-model-list__add-wrap">
        <Btn
          variant="secondary"
          size="sm"
          :disabled="saving"
          data-testid="ai-add-provider"
          @click="addMenuOpen = !addMenuOpen"
        >
          <Plus class="mr-1 h-3.5 w-3.5" />
          添加
          <ChevronDown class="ml-0.5 h-3 w-3 opacity-70" />
        </Btn>
        <div v-if="addMenuOpen" class="ai-model-list__add-menu" role="menu">
          <p class="ai-model-list__add-menu-label">常见模型快速添加</p>
          <button
            v-for="preset in presets"
            :key="preset.id"
            type="button"
            class="ai-model-list__add-menu-item focus-ring"
            :data-testid="`ai-add-preset-${preset.id}`"
            role="menuitem"
            @click="onQuickPreset(preset)"
          >
            <Sparkles class="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span class="min-w-0 flex-1 text-left">
              <span class="block font-medium">{{ preset.name }}</span>
              <span class="block truncate text-[0.625rem] opacity-70">{{ preset.description }}</span>
            </span>
            <Check v-if="isPresetConfigured(preset)" class="h-3.5 w-3.5 shrink-0 text-link" />
          </button>
          <button
            type="button"
            class="ai-model-list__add-menu-item ai-model-list__add-menu-item--custom focus-ring"
            role="menuitem"
            data-testid="ai-add-custom"
            @click="onAddCustom"
          >
            <Plus class="h-3.5 w-3.5 shrink-0 opacity-70" />
            自定义提供商…
          </button>
        </div>
      </div>
    </div>

    <div class="ai-model-list__presets">
      <p class="ai-model-list__presets-label">常见模型快速配置</p>
      <div class="ai-model-list__presets-row">
        <button
          v-for="preset in presets"
          :key="preset.id"
          type="button"
          class="ai-model-preset focus-ring"
          :class="{ 'ai-model-preset--active': isPresetConfigured(preset) }"
          :data-testid="`ai-preset-${preset.id}`"
          :disabled="saving"
          :title="preset.description"
          @click="emit('quickPreset', preset)"
        >
          <Sparkles class="h-3.5 w-3.5 shrink-0" />
          {{ preset.name }}
        </button>
      </div>
      <p v-if="!cloudEnabled" class="ai-model-list__presets-hint">
        点击预设将自动开启云端 API，填写 API Key 后保存即可使用
      </p>
    </div>

    <div class="ai-model-list__items">
      <article
        class="ai-model-card"
        :class="{ 'ai-model-card--active': localEnabled }"
        data-testid="ai-model-local"
      >
        <div class="ai-model-card__icon ai-model-card__icon--local">
          <Cpu class="h-3.5 w-3.5" />
        </div>
        <div class="ai-model-card__main">
          <div class="ai-model-card__title-row">
            <h4 class="ai-model-card__name">本地 Ollama</h4>
            <span v-if="localEnabled" class="ai-model-card__badge">
              <Check class="h-3 w-3" />
              已启用
            </span>
          </div>
          <p class="ai-model-card__remark">{{ localBaseUrl }}</p>
          <p class="ai-model-card__model">{{ localModel }}</p>
        </div>
        <div class="ai-model-card__actions">
          <button
            v-if="!localEnabled"
            type="button"
            class="ai-model-card__btn ai-model-card__btn--primary"
            :disabled="saving"
            @click="emit('toggleLocal', true)"
          >
            启用
          </button>
          <button
            v-else
            type="button"
            class="ai-model-card__btn"
            :disabled="saving"
            @click="emit('toggleLocal', false)"
          >
            停用
          </button>
          <button
            type="button"
            class="ai-model-card__btn"
            aria-label="编辑本地模型"
            :disabled="saving"
            @click="emit('editLocal')"
          >
            <Pencil class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="ai-model-card__btn"
            aria-label="测试本地连接"
            :disabled="saving || testingId === 'local'"
            data-testid="ai-test-local"
            @click="emit('testLocal')"
          >
            {{ testingId === "local" ? "…" : "测" }}
          </button>
        </div>
      </article>

      <template v-if="cloudEnabled">
        <article
          v-for="(provider, index) in providers"
          :key="providerKey(index, provider)"
          class="ai-model-card"
          :class="{
            'ai-model-card--active': provider.enabled !== false && provider.id === activeCloudProviderId,
          }"
          :data-testid="`ai-model-cloud-${index}`"
        >
          <div class="ai-model-card__icon ai-model-card__icon--cloud">
            <Cloud class="h-3.5 w-3.5" />
          </div>
          <div class="ai-model-card__main">
            <div class="ai-model-card__title-row">
              <h4 class="ai-model-card__name">{{ provider.name || "未命名" }}</h4>
              <span
                v-if="provider.id && provider.id === activeCloudProviderId && provider.enabled !== false"
                class="ai-model-card__badge"
              >
                <Check class="h-3 w-3" />
                默认
              </span>
              <span v-if="provider.enabled === false" class="ai-model-card__badge ai-model-card__badge--muted">
                已停用
              </span>
            </div>
            <p class="ai-model-card__remark">{{ provider.baseUrl }}</p>
            <p class="ai-model-card__model">{{ provider.model }}</p>
          </div>
          <div class="ai-model-card__actions">
            <button
              v-if="provider.enabled === false"
              type="button"
              class="ai-model-card__btn ai-model-card__btn--primary"
              :disabled="saving"
              @click="emit('toggleCloud', index, true)"
            >
              启用
            </button>
            <template v-else>
              <button
                v-if="provider.id && provider.id !== activeCloudProviderId"
                type="button"
                class="ai-model-card__btn ai-model-card__btn--primary"
                :disabled="saving"
                @click="provider.id && emit('setDefault', provider.id)"
              >
                设为默认
              </button>
              <button
                type="button"
                class="ai-model-card__btn"
                :disabled="saving"
                @click="emit('toggleCloud', index, false)"
              >
                停用
              </button>
            </template>
            <button
              type="button"
              class="ai-model-card__btn"
              aria-label="编辑"
              :disabled="saving"
              @click="emit('editCloud', index)"
            >
              <Pencil class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="ai-model-card__btn ai-model-card__btn--danger"
              aria-label="删除"
              :disabled="saving"
              @click="onDelete(index)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </article>
      </template>

      <p v-else-if="!providers.length" class="ai-model-list__hint">
        点击上方常见模型预设，或「添加」选择提供商
      </p>
    </div>

    <ConfirmDialog
      :open="!!deletePending"
      title="删除模型"
      :item-name="deletePending?.name"
      description="删除后无法恢复，请确认是否继续。"
      confirm-label="删除"
      destructive
      test-id="delete-ai-model-dialog"
      @confirm="confirmDelete"
      @cancel="deletePending = null"
    />
  </div>
</template>

<style scoped>
.ai-model-list__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.875rem;
}

.ai-model-list__add-wrap {
  position: relative;
  flex-shrink: 0;
}

.ai-model-list__add-menu {
  position: absolute;
  top: calc(100% + 0.375rem);
  right: 0;
  z-index: 20;
  width: min(18rem, 80vw);
  max-height: min(20rem, 60vh);
  overflow-y: auto;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.18);
  padding: 0.375rem;
}

.ai-model-list__add-menu-label {
  padding: 0.375rem 0.5rem 0.25rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.ai-model-list__add-menu-item {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 0.5rem;
  border-radius: 0.4375rem;
  padding: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text);
  text-align: left;
}

.ai-model-list__add-menu-item:hover {
  background: var(--color-surface-1);
}

.ai-model-list__add-menu-item--custom {
  margin-top: 0.25rem;
  border-top: 1px solid var(--color-border);
  border-radius: 0;
  padding-top: 0.625rem;
  color: var(--color-muted);
}

.ai-model-list__presets {
  margin-bottom: 0.875rem;
}

.ai-model-list__presets-label {
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.ai-model-list__presets-hint {
  margin-top: 0.375rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.ai-model-list__presets-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.375rem;
}

.ai-model-preset {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.3125rem 0.625rem;
  font-size: 0.6875rem;
  color: var(--color-text);
  background: var(--color-surface-0);
  cursor: pointer;
}

.ai-model-preset--active {
  border-color: color-mix(in srgb, var(--color-link) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  color: var(--color-link);
}

.ai-model-list__items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-model-list__hint {
  border: 1px dashed var(--color-border);
  border-radius: 0.625rem;
  padding: 1rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.ai-model-card {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-0) 80%, transparent);
  padding: 0.75rem 0.875rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.ai-model-card--active {
  border-color: color-mix(in srgb, var(--color-link) 45%, var(--color-border));
  box-shadow: inset 3px 0 0 var(--color-link);
}

.ai-model-card__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.4375rem;
}

.ai-model-card__icon--local {
  background: rgb(34 197 94 / 0.14);
  color: rgb(74 222 128);
}

.ai-model-card__icon--cloud {
  background: rgb(245 158 11 / 0.14);
  color: rgb(251 191 36);
}

.ai-model-card__main {
  min-width: 0;
  flex: 1;
}

.ai-model-card__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ai-model-card__name {
  font-size: 0.8125rem;
  font-weight: 600;
}

.ai-model-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-link) 15%, transparent);
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
  color: var(--color-link);
}

.ai-model-card__badge--muted {
  background: var(--color-surface-1);
  color: var(--color-muted);
}

.ai-model-card__remark,
.ai-model-card__model {
  margin-top: 0.2rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
  word-break: break-all;
}

.ai-model-card__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.3125rem;
}

.ai-model-card__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.4375rem;
  border: 1px solid var(--color-border);
  padding: 0.3125rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
  min-width: 1.75rem;
}

.ai-model-card__btn:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.ai-model-card__btn--primary {
  border-color: color-mix(in srgb, var(--color-link) 35%, var(--color-border));
  color: var(--color-link);
}

.ai-model-card__btn--danger:hover {
  border-color: color-mix(in srgb, var(--color-danger, #ef4444) 40%, var(--color-border));
  color: var(--color-danger, #ef4444);
}
</style>
