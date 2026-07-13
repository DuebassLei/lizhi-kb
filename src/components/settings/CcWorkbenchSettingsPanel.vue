<script setup lang="ts">
import { Sparkles } from "@lucide/vue";

import CcWorkbenchSettingsShell from "../cc/CcWorkbenchSettingsShell.vue";
</script>

<template>
  <section id="settings-cc-workbench" class="settings-section" data-testid="cc-workbench-settings">
    <div class="settings-section-header">
      <Sparkles class="h-5 w-5 text-link" />
      <div>
        <h2 class="settings-section-title">Claude Agent 工作台</h2>
        <p class="settings-section-desc">
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
