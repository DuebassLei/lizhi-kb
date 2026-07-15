<script setup lang="ts">
import { Sparkles } from "@lucide/vue";

import CcWorkbenchSettingsShell from "../cc/CcWorkbenchSettingsShell.vue";
</script>

<template>
  <section id="settings-cc-workbench" class="settings-section" data-testid="cc-workbench-settings">
    <div class="mb-3 flex items-start gap-3">
      <Sparkles class="mt-0.5 h-5 w-5 shrink-0 text-link" />
      <div>
        <h2 class="settings-panel__title">Claude Agent 工作台</h2>
        <p class="settings-panel__desc">
          内嵌完整 Claude Agent（Skills、MCP、多步工具）。SDK 按需安装到
          <code>~/.lizhi-kb/dependencies/</code>。
        </p>
      </div>
    </div>

    <div class="mt-4 overflow-hidden rounded-xl border border-border">
      <CcWorkbenchSettingsShell reveal-key-on-mount class="min-h-[28rem]" />
    </div>
  </section>
</template>
