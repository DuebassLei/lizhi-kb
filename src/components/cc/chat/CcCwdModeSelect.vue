<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, ChevronDown, FolderOpen } from "@lucide/vue";

import type { CwdMode } from "../../../services/ccWorkbenchService";
import { cwdModeLabel } from "../../../services/ccWorkbenchService";

const props = defineProps<{
  cwdMode: CwdMode;
  projectPath?: string | null;
  disabled?: boolean;
  mcpEnabled?: boolean;
}>();

const emit = defineEmits<{
  "set-mode": [mode: CwdMode];
  "pick-project": [];
}>();

const open = ref(false);

const projectPathFull = computed(() => props.projectPath?.trim() || null);

const badgeLabel = computed(() => {
  if (props.cwdMode === "vault") return "知识库";
  const path = projectPathFull.value;
  if (!path) return "本地项目 · 未选择";
  const normalized = path.replace(/\//g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  const tail = parts.length <= 1 ? parts[0] ?? normalized : parts[parts.length - 1]!;
  if (tail.length > 24) return `本地项目 · ${tail.slice(0, 21)}…`;
  return `本地项目 · ${tail}`;
});

const showMcpWarn = computed(() => props.cwdMode === "vault" && props.mcpEnabled === false);

const badgeTitle = computed(() => {
  if (props.cwdMode === "project" && projectPathFull.value) {
    return projectPathFull.value;
  }
  if (props.cwdMode === "vault") {
    if (showMcpWarn.value) {
      return "知识库模式：MCP 未启用，无法查询笔记";
    }
    return "知识库模式：Agent 通过 lizhi-mcp 查询加密笔记";
  }
  return "本地项目模式：可使用文件工具与 Bash";
});

function onToggle(event: MouseEvent) {
  event.stopPropagation();
  if (props.disabled) return;
  open.value = !open.value;
}

function onSelectMode(mode: CwdMode) {
  if (mode !== props.cwdMode) {
    emit("set-mode", mode);
  }
  if (mode === "vault") {
    open.value = false;
  }
}

function onPickProject() {
  emit("pick-project");
  open.value = false;
}

defineExpose({ close: () => { open.value = false; } });
</script>

<template>
  <div class="cc-cwd-select cc-chat-select">
    <button
      type="button"
      class="cc-cwd-select__trigger"
      :class="{ 'cc-cwd-select__trigger--warn': showMcpWarn }"
      data-testid="cc-cwd-mode-badge"
      :disabled="disabled"
      :title="badgeTitle"
      @click.stop="onToggle"
    >
      <span class="truncate">{{ badgeLabel }}</span>
      <ChevronDown class="cc-cwd-select__chevron h-3 w-3 shrink-0" />
    </button>
    <div v-if="open" class="cc-chat-select__menu cc-cwd-select__menu">
      <button
        type="button"
        class="cc-chat-select__item cc-cwd-select__item"
        :class="{ 'cc-chat-select__item--active': cwdMode === 'vault' }"
        @click="onSelectMode('vault')"
      >
        <div class="cc-chat-select__item-main">
          <span class="font-medium">{{ cwdModeLabel("vault") }}</span>
          <span class="cc-chat-select__desc">通过 lizhi-mcp 访问加密笔记</span>
        </div>
        <Check v-if="cwdMode === 'vault'" class="cc-chat-select__status cc-chat-select__status--ok" />
      </button>
      <button
        type="button"
        class="cc-chat-select__item cc-cwd-select__item"
        :class="{ 'cc-chat-select__item--active': cwdMode === 'project' }"
        @click="onSelectMode('project')"
      >
        <div class="cc-chat-select__item-main">
          <span class="font-medium">{{ cwdModeLabel("project") }}</span>
          <span class="cc-chat-select__desc">可使用文件工具与 Bash</span>
        </div>
        <Check v-if="cwdMode === 'project'" class="cc-chat-select__status cc-chat-select__status--ok" />
      </button>
      <div v-if="cwdMode === 'project'" class="cc-cwd-select__project">
        <p v-if="projectPathFull" class="cc-cwd-select__path" :title="projectPathFull">
          {{ projectPathFull }}
        </p>
        <p v-else class="cc-cwd-select__path cc-cwd-select__path--empty">尚未选择项目目录</p>
        <button
          type="button"
          class="cc-cwd-select__pick"
          @click="onPickProject"
        >
          <FolderOpen class="h-3.5 w-3.5" />
          选择文件夹…
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cc-cwd-select {
  position: relative;
}

.cc-cwd-select__trigger {
  display: inline-flex;
  max-width: min(16rem, 48vw);
  align-items: center;
  gap: 0.1875rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  padding: 0.125rem 0.375rem 0.125rem 0.5rem;
  font-size: 0.625rem;
  color: var(--color-link);
}

.cc-cwd-select__trigger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-link) 16%, transparent);
}

.cc-cwd-select__trigger--warn {
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
  color: var(--color-warning);
}

.cc-cwd-select__trigger--warn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-warning) 20%, transparent);
}

.cc-cwd-select__trigger:disabled {
  opacity: 0.45;
}

.cc-cwd-select__chevron {
  opacity: 0.7;
}

.cc-cwd-select__menu {
  right: 0;
  top: calc(100% + 0.25rem);
  bottom: auto;
  min-width: 14rem;
  max-width: min(20rem, 92vw);
}

.cc-cwd-select__item {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.cc-cwd-select__project {
  margin-top: 0.25rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  padding: 0.375rem 0.25rem 0.125rem;
}

.cc-cwd-select__path {
  margin: 0 0.25rem 0.375rem;
  font-size: 0.625rem;
  line-height: 1.4;
  word-break: break-all;
  color: var(--color-muted);
}

.cc-cwd-select__path--empty {
  font-style: italic;
}

.cc-cwd-select__pick {
  display: inline-flex;
  width: 100%;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.375rem;
  padding: 0.4375rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-link);
}

.cc-cwd-select__pick:hover {
  background: color-mix(in srgb, var(--color-link) 8%, transparent);
}

.cc-chat-select__menu {
  position: absolute;
  z-index: 20;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 8px 24px color-mix(in srgb, black 14%, transparent);
  padding: 0.25rem;
}

.cc-chat-select__item {
  display: flex;
  width: 100%;
  border-radius: 0.375rem;
  padding: 0.4375rem 0.5rem;
  text-align: left;
  font-size: 0.6875rem;
  color: var(--color-text);
}

.cc-chat-select__item:hover,
.cc-chat-select__item--active {
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
}

.cc-chat-select__item-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
}

.cc-chat-select__desc {
  margin-top: 0.125rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-chat-select__status {
  height: 0.875rem;
  width: 0.875rem;
  flex-shrink: 0;
}

.cc-chat-select__status--ok {
  color: #16a34a;
}
</style>
