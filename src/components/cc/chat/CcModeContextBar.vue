<script setup lang="ts">
import { computed } from "vue";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FolderCode,
  Plug,
  Settings,
} from "@lucide/vue";

import type { CwdMode } from "../../../services/ccWorkbenchService";

const props = defineProps<{
  cwdMode: CwdMode;
  mcpEnabled?: boolean;
  runtimeReady?: boolean;
  statusHint?: string | null;
  loadError?: string | null;
  workbenchEnabled?: boolean;
  sessionCwdMismatch?: boolean;
}>();

const emit = defineEmits<{
  openSettings: [];
}>();

const isVault = computed(() => props.cwdMode === "vault");

const modeLabel = computed(() => (isVault.value ? "知识库模式" : "本地项目模式"));

const modeIcon = computed(() => (isVault.value ? Database : FolderCode));

const capabilities = computed(() => {
  if (isVault.value) {
    return "仅经 lizhi-mcp 访问加密笔记，不可直接读写本地项目文件";
  }
  return "可读写项目文件、执行 Bash；知识库 MCP 仍可用";
});

const mcpOk = computed(() => Boolean(props.mcpEnabled));

const showMcpWarning = computed(() => isVault.value && !mcpOk.value);

const blockingHint = computed(() => {
  if (props.loadError) return props.loadError;
  if (!props.workbenchEnabled) return "工作台未启用";
  if (!props.runtimeReady && props.statusHint) return props.statusHint;
  if (showMcpWarning.value) return "vault 模式需开启 MCP 才能查询知识库";
  if (!isVault.value && props.statusHint?.includes("项目")) return props.statusHint;
  return null;
});

const isBlocking = computed(() => Boolean(blockingHint.value));

/** 常态下由输入区「知识库/本地项目」选择器表达模式，仅异常时展示横幅 */
const shouldShow = computed(
  () => props.sessionCwdMismatch || isBlocking.value,
);
</script>

<template>
  <div
    v-if="shouldShow"
    class="cc-mode-bar"
    :class="{
      'cc-mode-bar--vault': isVault,
      'cc-mode-bar--project': !isVault,
      'cc-mode-bar--blocking': isBlocking,
    }"
    data-testid="cc-mode-context-bar"
  >
    <div class="cc-mode-bar__main">
      <component :is="modeIcon" class="cc-mode-bar__mode-icon" aria-hidden="true" />
      <div class="cc-mode-bar__text">
        <p class="cc-mode-bar__title">
          <span class="cc-mode-bar__mode">{{ modeLabel }}</span>
          <span class="cc-mode-bar__cap">{{ capabilities }}</span>
        </p>
        <p v-if="sessionCwdMismatch" class="cc-mode-bar__session-warn">
          工作目录已切换，下一条消息将开启新会话上下文
        </p>
      </div>
    </div>

    <div class="cc-mode-bar__status">
      <span
        class="cc-mode-bar__mcp"
        :class="{
          'cc-mode-bar__mcp--ok': mcpOk,
          'cc-mode-bar__mcp--warn': !mcpOk,
        }"
        :title="mcpOk ? 'lizhi-mcp 已启用，Agent 可调用知识库工具' : 'MCP 未启用，vault 模式无法查询知识库'"
      >
        <Plug class="h-3 w-3 shrink-0" />
        {{ mcpOk ? "MCP 已连接" : "MCP 未启用" }}
      </span>

      <button
        v-if="isBlocking"
        type="button"
        class="cc-mode-bar__action"
        @click="emit('openSettings')"
      >
        <Settings class="h-3 w-3" />
        打开设置
      </button>
      <span v-else-if="runtimeReady" class="cc-mode-bar__ready">
        <CheckCircle2 class="h-3 w-3" />
        就绪
      </span>
    </div>

    <p v-if="blockingHint" class="cc-mode-bar__hint" role="alert">
      <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
      {{ blockingHint }}
    </p>
  </div>
</template>

<style scoped>
.cc-mode-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 35%, var(--color-surface-0));
  padding: 0.5rem 1rem;
  font-size: 0.6875rem;
}

.cc-mode-bar--vault {
  border-bottom-color: color-mix(in srgb, var(--color-link) 22%, var(--color-border));
}

.cc-mode-bar--project {
  border-bottom-color: color-mix(in srgb, var(--color-paw) 28%, var(--color-border));
}

.cc-mode-bar--blocking {
  background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface-0));
}

.cc-mode-bar__main {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  gap: 0.5rem;
}

.cc-mode-bar__mode-icon {
  height: 1rem;
  width: 1rem;
  flex-shrink: 0;
  margin-top: 0.0625rem;
  color: var(--color-link);
}

.cc-mode-bar--project .cc-mode-bar__mode-icon {
  color: var(--color-paw);
}

.cc-mode-bar__text {
  min-width: 0;
}

.cc-mode-bar__title {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.375rem;
  line-height: 1.4;
}

.cc-mode-bar__mode {
  font-weight: 600;
  color: var(--color-text);
}

.cc-mode-bar__cap {
  color: var(--color-muted);
}

.cc-mode-bar__session-warn {
  margin: 0.25rem 0 0;
  color: var(--color-warning);
}

.cc-mode-bar__status {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.5rem;
}

.cc-mode-bar__mcp {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  padding: 0.125rem 0.4375rem;
  font-weight: 500;
}

.cc-mode-bar__mcp--ok {
  background: color-mix(in srgb, var(--color-secure) 14%, transparent);
  color: var(--color-secure);
}

.cc-mode-bar__mcp--warn {
  background: color-mix(in srgb, var(--color-warning) 16%, transparent);
  color: var(--color-warning);
}

.cc-mode-bar__ready {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--color-muted);
}

.cc-mode-bar__action {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 0.375rem;
  border: 1px solid color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
  padding: 0.1875rem 0.4375rem;
  font-size: 0.625rem;
  color: var(--color-warning);
}

.cc-mode-bar__action:hover {
  background: color-mix(in srgb, var(--color-warning) 10%, transparent);
}

.cc-mode-bar__hint {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 0.375rem;
  margin: 0;
  padding-top: 0.25rem;
  border-top: 1px solid color-mix(in srgb, var(--color-warning) 25%, var(--color-border));
  color: var(--color-warning);
  line-height: 1.45;
}
</style>
