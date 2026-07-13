<script setup lang="ts">
import { computed } from "vue";
import { Bot, FileText, X } from "@lucide/vue";

import type { CcFileChangeItem, CcSubagentItem } from "../../composables/cc/useCcStatusPanel";
import CcEditDiffView from "./chat/CcEditDiffView.vue";
import CcSubagentOutputView from "./chat/CcSubagentOutputView.vue";

const props = defineProps<{
  fileChange?: CcFileChangeItem | null;
  subagent?: CcSubagentItem | null;
  contextFiles?: string[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const diffMode = computed(() => {
  const f = props.fileChange;
  if (!f) return "empty";
  if (f.oldContent != null || f.newContent != null) return "edit";
  if (f.writeContent) return "write";
  return "meta";
});

const diffOldText = computed(() => props.fileChange?.oldContent ?? "");
const diffNewText = computed(
  () => props.fileChange?.newContent ?? props.fileChange?.writeContent ?? "",
);

function subagentStatusLabel(status: CcSubagentItem["status"]) {
  if (status === "running") return "运行中";
  if (status === "error") return "失败";
  return "已完成";
}
</script>
<template>
  <aside class="cc-split-panel" data-testid="cc-split-panel">
    <header class="cc-split-panel__header">
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium text-[var(--color-text)]">详情面板</p>
        <p v-if="fileChange" class="truncate text-[0.625rem] text-muted">{{ fileChange.path }}</p>
        <p v-else-if="subagent" class="truncate text-[0.625rem] text-muted">{{ subagent.name }}</p>
      </div>      <button type="button" class="cc-split-panel__close" title="关闭分屏" @click="emit('close')">
        <X class="h-4 w-4" />
      </button>
    </header>

    <div class="cc-split-panel__body scrollbar-thin">
      <template v-if="subagent">
        <div class="cc-split-panel__meta">
          <Bot class="h-3 w-3" />
          <span>{{ subagentStatusLabel(subagent.status) }}</span>
        </div>

        <div v-if="subagent.description" class="cc-split-panel__section">
          <p class="cc-split-panel__section-title">任务描述</p>
          <p class="cc-split-panel__text">{{ subagent.description }}</p>
        </div>

        <div class="cc-split-panel__section">
          <p class="cc-split-panel__section-title">输出</p>
          <CcSubagentOutputView v-if="subagent.output" :output="subagent.output" />
          <p v-else-if="subagent.status === 'running'" class="cc-split-panel__hint">子代理正在运行，输出将在完成后显示。</p>
          <p v-else class="cc-split-panel__hint">暂无输出内容。</p>
        </div>
      </template>

      <template v-else-if="fileChange">        <div class="cc-split-panel__meta">
          <span>{{ fileChange.tool }}</span>
          <span>·</span>
          <span>{{ fileChange.summary }}</span>
        </div>

        <div v-if="diffMode === 'edit' || diffMode === 'write'" class="cc-split-panel__diff-wrap">
          <CcEditDiffView
            :old-text="diffOldText"
            :new-text="diffNewText"
            :file-path="fileChange.path"
            mode="split"
          />
        </div>

        <p v-else class="cc-split-panel__hint">
          工具调用已记录，详细 diff 将在 Edit/Write 工具返回完整参数后显示。
        </p>
      </template>

      <template v-else-if="contextFiles?.length">
        <p class="cc-split-panel__section-title">当前上下文附件</p>
        <ul class="cc-split-panel__file-list">
          <li v-for="path in contextFiles" :key="path" class="cc-split-panel__file-item">
            <FileText class="h-3.5 w-3.5 shrink-0 text-muted" />
            <span class="truncate">{{ path }}</span>
          </li>
        </ul>
        <p class="cc-split-panel__hint">附件内容已注入到发送的 prompt 中。</p>
      </template>

      <p v-else class="cc-split-panel__empty">
        点击状态栏「子代理」或「编辑」中的条目，或在此查看上下文附件。
      </p>    </div>
  </aside>
</template>

<style scoped>
.cc-split-panel {
  display: flex;
  width: min(42vw, 28rem);
  min-width: 16rem;
  flex-direction: column;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface-0);
}

.cc-split-panel__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  padding: 0.625rem 0.75rem;
}

.cc-split-panel__close {
  border-radius: 0.375rem;
  padding: 0.25rem;
  color: var(--color-muted);
}

.cc-split-panel__close:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.cc-split-panel__body {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.cc-split-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-split-panel__section-title {
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.cc-split-panel__file-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.cc-split-panel__file-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.375rem;
  background: var(--color-surface-1);
  padding: 0.375rem 0.5rem;
  font-size: 0.6875rem;
}

.cc-split-panel__diff-wrap {
  margin-top: 0.625rem;
}

.cc-split-panel__section {
  margin-top: 0.75rem;
}

.cc-split-panel__text {
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.cc-split-panel__code {
  max-height: 24rem;
  overflow: auto;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 60%, transparent);
  padding: 0.5rem;
  font-size: 0.6875rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.cc-split-panel__hint,.cc-split-panel__empty {
  margin-top: 0.75rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}
</style>
