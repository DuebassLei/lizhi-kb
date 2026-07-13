<script setup lang="ts">
import { Sparkles } from "@lucide/vue";
import AiSettingsShell from "../ai/settings/AiSettingsShell.vue";
</script>

<template>
  <section id="settings-ai" class="settings-section mb-8 scroll-mt-6" data-testid="ai-settings-panel">
    <div class="settings-section-header">
      <Sparkles class="h-5 w-5 text-link" />
      <div>
        <h2 class="settings-section-title">AI 助手</h2>
        <p class="settings-section-desc">
          应用内 AI 对话：闲聊、知识库检索问答、笔记助手。可配置本地 Ollama 与多个云端 API，在对话时动态切换模型。
        </p>
      </div>
    </div>

    <div class="mt-4 overflow-hidden rounded-xl border border-border">
      <AiSettingsShell reveal-key-on-mount class="min-h-[28rem]" />
    </div>
  </section>
</template>

<style scoped>
.settings-section-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.settings-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.settings-section-desc {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-muted);
}
</style>
