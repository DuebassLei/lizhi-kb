<script setup lang="ts">
import { Sparkles } from "@lucide/vue";
import AiSettingsShell from "../ai/settings/AiSettingsShell.vue";
</script>

<template>
  <section id="settings-ai" class="settings-section mb-8 scroll-mt-6" data-testid="ai-settings-panel">
    <div class="mb-3 flex items-start gap-3">
      <Sparkles class="mt-0.5 h-5 w-5 shrink-0 text-link" />
      <div>
        <h2 class="settings-panel__title">AI 助手</h2>
        <p class="settings-panel__desc">
          应用内 AI 对话：闲聊、知识库检索问答、笔记助手。可配置本地 Ollama 与多个云端 API，在对话时动态切换模型。
        </p>
      </div>
    </div>

    <div class="mt-4 overflow-hidden rounded-xl border border-border">
      <AiSettingsShell reveal-key-on-mount class="min-h-[28rem]" />
    </div>
  </section>
</template>
