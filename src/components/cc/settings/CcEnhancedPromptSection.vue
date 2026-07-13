<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Loader2, Save, Sparkles } from "@lucide/vue";

import { useUiStore } from "../../../stores/ui";
import {
  getCcWorkbenchConfig,
  setCcWorkbenchConfig,
  type CcPromptEnhancerConfig,
} from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";

const ui = useUiStore();
const loading = ref(true);
const saving = ref(false);
const config = ref<CcPromptEnhancerConfig>({ enabled: true, autoTrigger: false, systemPrompt: "" });

async function load() {
  loading.value = true;
  try {
    const full = await getCcWorkbenchConfig();
    config.value = {
      enabled: full.promptEnhancer?.enabled ?? true,
      autoTrigger: full.promptEnhancer?.autoTrigger ?? false,
      systemPrompt: full.promptEnhancer?.systemPrompt ?? "",
    };
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "加载配置失败");
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  try {
    const trimmedPrompt = config.value.systemPrompt?.trim() ?? "";
    await setCcWorkbenchConfig({
      promptEnhancer: {
        enabled: config.value.enabled,
        autoTrigger: config.value.autoTrigger,
        systemPrompt: trimmedPrompt || undefined,
      },
    });
    ui.showToast("success", "提示词增强配置已保存");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="cc-enhanced-prompt-section" data-testid="cc-enhanced-prompt-section">
    <header class="cc-enhanced-prompt-section__header">
      <div>
        <h3 class="cc-enhanced-prompt-section__title">
          <Sparkles class="mr-1 inline h-4 w-4 text-link" />
          提示词增强
        </h3>
        <p class="cc-enhanced-prompt-section__subtitle">
          通过 ai-bridge <code>prompt-enhancer.js</code> 优化输入提示词，配置保存在
          <code>cc-workbench.json</code>
        </p>
      </div>
      <Btn variant="secondary" size="sm" :disabled="saving || loading" @click="onSave">
        <Save class="mr-1 h-3.5 w-3.5" />
        保存
      </Btn>
    </header>

    <div v-if="loading" class="cc-enhanced-prompt-section__loading">
      <Loader2 class="h-4 w-4 animate-spin" />
      加载中…
    </div>

    <div v-else class="cc-enhanced-prompt-section__options">
      <label class="cc-enhanced-prompt-section__option">
        <input v-model="config.enabled" type="checkbox" />
        启用提示词增强（输入框 ✨ 按钮）
      </label>
      <label class="cc-enhanced-prompt-section__option">
        <input v-model="config.autoTrigger" type="checkbox" :disabled="!config.enabled" />
        发送前自动增强（实验性）
      </label>
      <label class="cc-enhanced-prompt-section__textarea-label">
        自定义系统提示词（留空使用默认）
        <textarea
          v-model="config.systemPrompt"
          class="cc-enhanced-prompt-section__textarea"
          rows="5"
          placeholder="你是提示词优化专家。用户会发送待优化的提示词…"
        />
      </label>
      <p class="text-xs text-muted">
        增强使用当前活跃供应商与模型，通过 SDK 单轮对话完成，不执行工具。
      </p>
    </div>
  </section>
</template>

<style scoped>
.cc-enhanced-prompt-section {
  padding: 0.75rem 1.125rem 1.25rem;
}

.cc-enhanced-prompt-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.cc-enhanced-prompt-section__title {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-enhanced-prompt-section__subtitle {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-enhanced-prompt-section__loading {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-enhanced-prompt-section__options {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 0.75rem;
}

.cc-enhanced-prompt-section__option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.cc-enhanced-prompt-section__textarea-label {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-size: 0.8125rem;
}

.cc-enhanced-prompt-section__textarea {
  width: 100%;
  resize: vertical;
  min-height: 5rem;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: var(--color-surface-1);
  font-size: 0.75rem;
  line-height: 1.5;
  font-family: inherit;
}
</style>
