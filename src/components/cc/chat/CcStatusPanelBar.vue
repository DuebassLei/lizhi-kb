<script setup lang="ts">
import { computed, ref } from "vue";
import { ListTodo, Pencil, Bot, Check, Circle, LoaderCircle, X } from "@lucide/vue";

import type {
  CcFileChangeItem,
  CcStatusTab,
  CcSubagentItem,
  CcTodoItem,
} from "../../../composables/cc/useCcStatusPanel";

const props = defineProps<{
  expanded?: boolean;
  activeTab?: CcStatusTab | null;
  todoCount?: number;
  subagentCount?: number;
  subagentRunningCount?: number;
  fileChangeCount?: number;
  todos?: CcTodoItem[];
  subagents?: CcSubagentItem[];
  fileChanges?: CcFileChangeItem[];
  streaming?: boolean;
  projectPath?: string | null;
  cwdMode?: "vault" | "project";
}>();

const emit = defineEmits<{
  toggleTab: [tab: CcStatusTab];
  selectFile: [item: CcFileChangeItem];
  selectSubagent: [item: CcSubagentItem];
  discardAllEdits: [];
  keepAllEdits: [];
  undoEdits: [];
}>();

const panelRef = ref<HTMLElement | null>(null);

const hasTodos = computed(() => (props.todos?.length ?? 0) > 0);
const hasSubagents = computed(() => (props.subagents?.length ?? 0) > 0);
const hasFileChanges = computed(() => (props.fileChanges?.length ?? 0) > 0);

const todoCompleted = computed(
  () => props.todos?.filter((t) => t.status === "completed").length ?? 0,
);
const subagentCompleted = computed(
  () => props.subagents?.filter((s) => s.status === "completed").length ?? 0,
);
const hasInProgressTodo = computed(
  () => props.todos?.some((t) => t.status === "in_progress") ?? false,
);
const hasRunningSubagent = computed(
  () => props.subagents?.some((s) => s.status === "running") ?? false,
);
const runningSubagentCount = computed(
  () => props.subagentRunningCount ?? props.subagents?.filter((s) => s.status === "running").length ?? 0,
);
const runningSubagentNames = computed(() =>
  (props.subagents ?? [])
    .filter((s) => s.status === "running")
    .map((s) => s.name)
    .slice(0, 2),
);
const runningSubagentHint = computed(() => {
  if (!runningSubagentNames.value.length) return "";
  const names = runningSubagentNames.value.join("、");
  const extra = runningSubagentCount.value - runningSubagentNames.value.length;
  return extra > 0 ? `${names} 等 ${runningSubagentCount.value} 个运行中` : `${names} 运行中`;
});

function statusIcon(status: CcTodoItem["status"]) {
  if (status === "completed") return Check;
  if (status === "in_progress") return LoaderCircle;
  return Circle;
}

function subagentStatusLabel(status: CcSubagentItem["status"]) {
  if (status === "running") return "运行中";
  if (status === "error") return "失败";
  return "已完成";
}

function subagentStatusIcon(status: CcSubagentItem["status"]) {
  if (status === "running") return LoaderCircle;
  if (status === "error") return X;
  return Check;
}

function subagentStatusClass(status: CcSubagentItem["status"]): string {
  if (status === "running") return "cc-status-panel__status--running";
  if (status === "error") return "cc-status-panel__status--error";
  return "cc-status-panel__status--ok";
}

function formatDuration(ms?: number) {
  if (!ms || !Number.isFinite(ms)) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const canBatchEdit = computed(
  () => props.cwdMode === "project" && Boolean(props.projectPath) && (props.fileChanges?.length ?? 0) > 0,
);
</script>

<template>
  <div ref="panelRef" class="cc-status-panel" data-testid="cc-status-bar">
    <div v-if="expanded && activeTab" class="cc-status-panel__popover">
      <template v-if="activeTab === 'todo'">
        <ul v-if="hasTodos" class="cc-status-panel__list">
          <li v-for="(todo, index) in todos" :key="todo.id ?? index" class="cc-status-panel__row">
            <component :is="statusIcon(todo.status)" class="h-3.5 w-3.5 shrink-0" />
            <span>{{ todo.content }}</span>
          </li>
        </ul>
        <p v-else class="cc-status-panel__empty">暂无任务，多步任务执行时进度会显示在这里</p>
      </template>

      <template v-else-if="activeTab === 'subagent'">
        <ul v-if="hasSubagents" class="cc-status-panel__list">
          <li v-for="item in subagents" :key="item.id">
            <button
              type="button"
              class="cc-status-panel__row cc-status-panel__row--clickable"
              :class="`cc-status-panel__row--${item.status}`"
              @click="emit('selectSubagent', item)"
            >
              <component
                :is="subagentStatusIcon(item.status)"
                class="cc-status-panel__status"
                :class="subagentStatusClass(item.status)"
              />
              <div class="min-w-0">
                <p class="truncate">{{ item.name }}</p>
                <p class="cc-status-panel__meta">
                  {{ subagentStatusLabel(item.status) }}
                  <span v-if="item.durationMs"> · {{ formatDuration(item.durationMs) }}</span>
                </p>
              </div>
            </button>
          </li>
        </ul>
        <p v-else class="cc-status-panel__empty">暂无子代理活动</p>
      </template>

      <template v-else>
        <ul v-if="hasFileChanges" class="cc-status-panel__list">
          <li v-for="item in fileChanges" :key="item.path">
            <button
              type="button"
              class="cc-status-panel__row cc-status-panel__row--clickable"
              @click="emit('selectFile', item)"
            >
              <Pencil class="h-3.5 w-3.5 shrink-0" />
              <div class="min-w-0">
                <p class="truncate">{{ item.path }}</p>
                <p class="cc-status-panel__meta">{{ item.tool }} · {{ item.summary }}</p>
              </div>
            </button>
          </li>
        </ul>
        <p v-else class="cc-status-panel__empty">暂无文件编辑记录</p>
        <div v-if="canBatchEdit && activeTab === 'files'" class="cc-status-panel__batch">
          <button type="button" class="cc-status-panel__batch-btn" @click="emit('keepAllEdits')">
            全部保留
          </button>
          <button type="button" class="cc-status-panel__batch-btn" @click="emit('discardAllEdits')">
            全部丢弃
          </button>
          <button type="button" class="cc-status-panel__batch-btn cc-status-panel__batch-btn--primary" @click="emit('undoEdits')">
            撤销编辑
          </button>
        </div>
      </template>

      <p v-if="streaming" class="cc-status-panel__streaming">
        <template v-if="hasRunningSubagent">
          <LoaderCircle class="cc-status-panel__inline-spin h-3 w-3" />
          {{ runningSubagentHint }}
        </template>
        <template v-else>会话进行中…</template>
      </p>
    </div>

    <div class="cc-status-panel__tabs">
      <button
        type="button"
        class="cc-status-panel__tab"
        :class="{ 'cc-status-panel__tab--active': activeTab === 'todo' }"
        @click="emit('toggleTab', 'todo')"
      >
        <ListTodo class="h-3.5 w-3.5" />
        <span>任务</span>
        <span v-if="hasTodos" class="cc-status-panel__progress">
          {{ todoCompleted }}/{{ todoCount }}
        </span>
        <LoaderCircle
          v-if="streaming && hasInProgressTodo"
          class="h-3 w-3 animate-spin text-link"
        />
      </button>
      <button
        type="button"
        class="cc-status-panel__tab"
        :class="{ 'cc-status-panel__tab--active': activeTab === 'subagent' }"
        @click="emit('toggleTab', 'subagent')"
      >
        <Bot class="h-3.5 w-3.5" />
        <span>子代理</span>
        <span v-if="hasRunningSubagent" class="cc-status-panel__progress cc-status-panel__progress--running">
          {{ runningSubagentCount }} 运行中
        </span>
        <span v-else-if="hasSubagents" class="cc-status-panel__progress">
          {{ subagentCompleted }}/{{ subagentCount }}
        </span>
        <LoaderCircle
          v-if="hasRunningSubagent"
          class="h-3 w-3 animate-spin text-link"
        />
      </button>
      <button
        type="button"
        class="cc-status-panel__tab"
        :class="{ 'cc-status-panel__tab--active': activeTab === 'files' }"
        @click="emit('toggleTab', 'files')"
      >
        <Pencil class="h-3.5 w-3.5" />
        <span>编辑</span>
        <span v-if="hasFileChanges" class="cc-status-panel__progress">{{ fileChangeCount }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cc-status-panel {
  position: relative;
  margin-bottom: 0.5rem;
}

.cc-status-panel__tabs {
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: color-mix(in srgb, var(--color-surface-1) 55%, var(--color-surface-0));
  padding: 0.3125rem 0.5rem;
  font-size: 0.6875rem;
}

.cc-status-panel__tab {
  display: flex;
  flex: 1 0 auto;
  align-items: center;
  justify-content: center;
  gap: 0.3125rem;
  border: none;
  border-right: 1px solid var(--color-border);
  background: transparent;
  padding: 0.25rem 0.5rem;
  font-weight: 500;
  color: var(--color-muted);
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.cc-status-panel__tab:last-child {
  border-right: none;
}

.cc-status-panel__tab:hover,
.cc-status-panel__tab--active {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface-1) 85%, transparent);
}

.cc-status-panel__progress {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-status-panel__tab--active .cc-status-panel__progress {
  color: var(--color-text);
}

.cc-status-panel__tab--active .cc-status-panel__progress--running {
  color: var(--color-link);
}

.cc-status-panel__popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.25rem);
  left: 0;
  z-index: 20;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface-0);
  box-shadow: 0 -4px 16px color-mix(in srgb, black 12%, transparent);
  padding: 0.625rem 0.75rem;
}

.cc-status-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.4375rem;
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 12.5rem;
  overflow-y: auto;
}

.cc-status-panel__row {
  display: flex;
  align-items: flex-start;
  gap: 0.4375rem;
  font-size: 0.75rem;
  color: var(--color-text);
}

.cc-status-panel__row--clickable {
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 0.375rem;
  padding: 0.25rem 0.125rem;
  text-align: left;
  cursor: pointer;
}

.cc-status-panel__row--clickable:hover {
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
}

.cc-status-panel__meta {
  margin-top: 0.125rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-status-panel__empty,
.cc-status-panel__streaming {
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-status-panel__streaming {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.cc-status-panel__inline-spin {
  flex-shrink: 0;
  animation: cc-status-spin 1s linear infinite;
  color: var(--color-link);
}

.cc-status-panel__progress--running {
  color: var(--color-link);
}

.cc-status-panel__batch {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.625rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.cc-status-panel__batch-btn {
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.5rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-status-panel__batch-btn--primary {
  border-color: var(--color-link);
  color: var(--color-link);
}

.cc-status-panel__status {
  height: 0.875rem;
  width: 0.875rem;
  flex-shrink: 0;
}

.cc-status-panel__status--running {
  animation: cc-status-spin 1s linear infinite;
  color: var(--color-link);
}

.cc-status-panel__status--ok {
  color: #16a34a;
}

.cc-status-panel__status--error {
  color: #dc2626;
}

.cc-status-panel__row--error .truncate {
  color: #dc2626;
}

@keyframes cc-status-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
