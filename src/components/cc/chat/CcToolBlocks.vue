<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Bot,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  LoaderCircle,
  Pencil,
  Search,
  Terminal,
  X,
} from "@lucide/vue";

import type { CcFileChangeItem, CcSubagentItem } from "../../../composables/cc/useCcStatusPanel";
import { fileChangeFromToolInput, hasDiffContent, parseEditToolInput } from "../../../utils/ccEditDiff";
import {
  agentStatusLabel,
  countEditDiff,
  extractAgentDescription,
  extractAgentLabel,
  extractToolCommand,
  extractToolFilePath,
  extractToolPattern,
  fileBaseName,
  groupCcToolCalls,
  toolIsComplete,
  toolIsError,
  type CcToolCallItem,
} from "../../../utils/ccToolGrouping";
import CcEditDiffView from "./CcEditDiffView.vue";
import CcSubagentOutputView from "./CcSubagentOutputView.vue";

const props = defineProps<{
  tools: CcToolCallItem[];
  streaming?: boolean;
}>();

const emit = defineEmits<{
  selectFileChange: [item: CcFileChangeItem];
  selectSubagent: [item: CcSubagentItem];
}>();

const expandedGroups = ref<Record<string, boolean>>({});
const expandedEditDiffs = ref<Record<string, boolean>>({});

const groups = computed(() => groupCcToolCalls(props.tools));

function groupKey(group: ReturnType<typeof groupCcToolCalls>[number], index: number): string {
  return `${group.type}-${index}`;
}

function isExpanded(key: string, defaultOpen = false): boolean {
  return expandedGroups.value[key] ?? defaultOpen;
}

function toggleGroup(key: string) {
  expandedGroups.value = {
    ...expandedGroups.value,
    [key]: !isExpanded(key),
  };
}

function statusIcon(item: CcToolCallItem) {
  if (!toolIsComplete(item)) return LoaderCircle;
  if (toolIsError(item.output)) return X;
  return Check;
}

function statusClass(item: CcToolCallItem): string {
  if (!toolIsComplete(item)) return "cc-tool-block__status--running";
  if (toolIsError(item.output)) return "cc-tool-block__status--error";
  return "cc-tool-block__status--ok";
}

function editGroupStats(items: CcToolCallItem[]) {
  return items.reduce(
    (acc, item) => {
      const diff = countEditDiff(item.input);
      return {
        additions: acc.additions + diff.additions,
        deletions: acc.deletions + diff.deletions,
      };
    },
    { additions: 0, deletions: 0 },
  );
}

function editItemKey(groupIndex: number, itemIndex: number): string {
  return `edit-${groupIndex}-${itemIndex}`;
}

function isEditDiffExpanded(groupIndex: number, itemIndex: number): boolean {
  return expandedEditDiffs.value[editItemKey(groupIndex, itemIndex)] ?? false;
}

function toggleEditDiff(groupIndex: number, itemIndex: number) {
  const key = editItemKey(groupIndex, itemIndex);
  expandedEditDiffs.value = {
    ...expandedEditDiffs.value,
    [key]: !isEditDiffExpanded(groupIndex, itemIndex),
  };
}

function canShowEditDiff(item: CcToolCallItem): boolean {
  return hasDiffContent(parseEditToolInput(item.input));
}

function openEditInPanel(item: CcToolCallItem, event: Event) {
  event.stopPropagation();
  const change = fileChangeFromToolInput(item.name, item.input, item.output);
  if (change) emit("selectFileChange", change);
}

function toSubagentItem(agent: CcToolCallItem, groupIndex: number): CcSubagentItem {
  const status = !toolIsComplete(agent)
    ? "running"
    : toolIsError(agent.output)
      ? "error"
      : "completed";
  return {
    id: `tool-block:${groupIndex}:${agent.id ?? agent.name}`,
    name: extractAgentLabel(agent.input),
    status,
    description: extractAgentDescription(agent.input),
    output: agent.output,
    updatedAt: Date.now(),
  };
}

function openAgentDetail(agent: CcToolCallItem, groupIndex: number, event: Event) {
  event.stopPropagation();
  emit("selectSubagent", toSubagentItem(agent, groupIndex));
}

function isAgentExpanded(key: string): boolean {
  return expandedGroups.value[key] ?? true;
}
</script>

<template>
  <div class="cc-tool-blocks">
    <div v-for="(group, index) in groups" :key="groupKey(group, index)" class="cc-tool-blocks__group">
      <template v-if="group.type === 'read_group'">
        <button
          type="button"
          class="cc-tool-block__header"
          @click="toggleGroup(groupKey(group, index))"
        >
          <Eye class="cc-tool-block__icon" />
          <span class="cc-tool-block__title">Read</span>
          <span class="cc-tool-block__summary">{{ group.items.length }} 个文件</span>
          <ChevronDown
            class="cc-tool-block__chevron"
            :class="{ 'cc-tool-block__chevron--open': isExpanded(groupKey(group, index), true) }"
          />
        </button>
        <ul v-show="isExpanded(groupKey(group, index), true)" class="cc-tool-block__list">
          <li v-for="(item, i) in group.items" :key="i" class="cc-tool-block__row">
            <component
              :is="statusIcon(item)"
              class="cc-tool-block__status"
              :class="statusClass(item)"
            />
            <span class="cc-tool-block__file">{{ fileBaseName(extractToolFilePath(item.input) ?? item.name) }}</span>
          </li>
        </ul>
      </template>

      <template v-else-if="group.type === 'edit_group'">
        <button
          type="button"
          class="cc-tool-block__header"
          @click="toggleGroup(groupKey(group, index))"
        >
          <Pencil class="cc-tool-block__icon" />
          <span class="cc-tool-block__title">Edit</span>
          <span class="cc-tool-block__summary">{{ group.items.length }} 个文件</span>
          <span v-if="editGroupStats(group.items).additions || editGroupStats(group.items).deletions" class="cc-tool-block__diff">
            <span class="cc-tool-block__diff-add">+{{ editGroupStats(group.items).additions }}</span>
            <span class="cc-tool-block__diff-del">-{{ editGroupStats(group.items).deletions }}</span>
          </span>
          <ChevronDown
            class="cc-tool-block__chevron"
            :class="{ 'cc-tool-block__chevron--open': isExpanded(groupKey(group, index), true) }"
          />
        </button>
        <ul v-show="isExpanded(groupKey(group, index), true)" class="cc-tool-block__list">
          <li
            v-for="(item, i) in group.items"
            :key="i"
            class="cc-tool-block__edit-item"
            :class="{ 'cc-tool-block__edit-item--open': isEditDiffExpanded(index, i) }"
          >
            <button
              type="button"
              class="cc-tool-block__row cc-tool-block__row--clickable"
              :disabled="!canShowEditDiff(item)"
              @click="toggleEditDiff(index, i)"
            >
              <component
                :is="statusIcon(item)"
                class="cc-tool-block__status"
                :class="statusClass(item)"
              />
              <span class="cc-tool-block__file">{{ fileBaseName(extractToolFilePath(item.input) ?? item.name) }}</span>
              <span class="cc-tool-block__diff cc-tool-block__diff--inline">
                <span class="cc-tool-block__diff-add">+{{ countEditDiff(item.input).additions }}</span>
                <span class="cc-tool-block__diff-del">-{{ countEditDiff(item.input).deletions }}</span>
              </span>
              <button
                v-if="canShowEditDiff(item)"
                type="button"
                class="cc-tool-block__panel-btn"
                title="在详情面板查看"
                @click="openEditInPanel(item, $event)"
              >
                <ExternalLink class="h-3 w-3" />
              </button>
              <ChevronDown
                v-if="canShowEditDiff(item)"
                class="cc-tool-block__chevron cc-tool-block__chevron--sm"
                :class="{ 'cc-tool-block__chevron--open': isEditDiffExpanded(index, i) }"
              />
            </button>
            <div v-if="isEditDiffExpanded(index, i) && canShowEditDiff(item)" class="cc-tool-block__inline-diff">
              <CcEditDiffView :input="item.input" compact />
            </div>
          </li>
        </ul>
      </template>

      <template v-else-if="group.type === 'bash_group'">
        <button
          type="button"
          class="cc-tool-block__header"
          @click="toggleGroup(groupKey(group, index))"
        >
          <Terminal class="cc-tool-block__icon" />
          <span class="cc-tool-block__title">Bash</span>
          <span class="cc-tool-block__summary">{{ group.items.length }} 条命令</span>
          <ChevronDown
            class="cc-tool-block__chevron"
            :class="{ 'cc-tool-block__chevron--open': isExpanded(groupKey(group, index), true) }"
          />
        </button>
        <ul v-show="isExpanded(groupKey(group, index), true)" class="cc-tool-block__list">
          <li v-for="(item, i) in group.items" :key="i" class="cc-tool-block__row cc-tool-block__row--mono">
            <component
              :is="statusIcon(item)"
              class="cc-tool-block__status"
              :class="statusClass(item)"
            />
            <span class="cc-tool-block__cmd">{{ extractToolCommand(item.input) ?? item.name }}</span>
          </li>
        </ul>
      </template>

      <template v-else-if="group.type === 'search_group'">
        <button
          type="button"
          class="cc-tool-block__header"
          @click="toggleGroup(groupKey(group, index))"
        >
          <Search class="cc-tool-block__icon" />
          <span class="cc-tool-block__title">Search</span>
          <span class="cc-tool-block__summary">{{ group.items.length }} 次</span>
          <ChevronDown
            class="cc-tool-block__chevron"
            :class="{ 'cc-tool-block__chevron--open': isExpanded(groupKey(group, index), true) }"
          />
        </button>
        <ul v-show="isExpanded(groupKey(group, index), true)" class="cc-tool-block__list">
          <li v-for="(item, i) in group.items" :key="i" class="cc-tool-block__row cc-tool-block__row--mono">
            <component
              :is="statusIcon(item)"
              class="cc-tool-block__status"
              :class="statusClass(item)"
            />
            <span class="cc-tool-block__cmd">{{ extractToolPattern(item.input) ?? item.name }}</span>
          </li>
        </ul>
      </template>

      <template v-else-if="group.type === 'agent_group'">
        <div class="cc-tool-block cc-tool-block--agent">
          <button
            type="button"
            class="cc-tool-block__header"
            @click="toggleGroup(groupKey(group, index))"
          >
            <Bot class="cc-tool-block__icon cc-tool-block__icon--agent" />
            <span class="cc-tool-block__title">{{ extractAgentLabel(group.agent.input) }}</span>
            <span class="cc-tool-block__agent-status">{{ agentStatusLabel(group.agent) }}</span>
            <component
              :is="statusIcon(group.agent)"
              class="cc-tool-block__status"
              :class="statusClass(group.agent)"
            />
            <button
              v-if="toolIsComplete(group.agent)"
              type="button"
              class="cc-tool-block__panel-btn"
              title="查看子代理详情"
              @click="openAgentDetail(group.agent, index, $event)"
            >
              <ExternalLink class="h-3 w-3" />
            </button>
            <ChevronDown
              class="cc-tool-block__chevron"
              :class="{ 'cc-tool-block__chevron--open': isAgentExpanded(groupKey(group, index)) }"
            />
          </button>

          <div v-show="isAgentExpanded(groupKey(group, index))" class="cc-tool-block__agent-body">
            <p v-if="extractAgentDescription(group.agent.input)" class="cc-tool-block__agent-desc">
              {{ extractAgentDescription(group.agent.input) }}
            </p>

            <ul v-if="group.items.length" class="cc-tool-block__list cc-tool-block__list--nested">
              <li v-for="(item, i) in group.items" :key="i" class="cc-tool-block__row">
                <component
                  :is="statusIcon(item)"
                  class="cc-tool-block__status"
                  :class="statusClass(item)"
                />
                <span class="cc-tool-block__file">{{ item.name }}</span>
                <span v-if="extractToolFilePath(item.input)" class="cc-tool-block__cmd">
                  {{ fileBaseName(extractToolFilePath(item.input)!) }}
                </span>
              </li>
            </ul>

            <div v-if="group.agent.output" class="cc-tool-block__agent-output">
              <CcSubagentOutputView :output="group.agent.output" />
            </div>
            <p v-else-if="!toolIsComplete(group.agent)" class="cc-tool-block__agent-hint">
              子代理正在运行…
            </p>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="cc-tool-block">
          <button
            type="button"
            class="cc-tool-block__header"
            @click="toggleGroup(groupKey(group, index))"
          >
            <Terminal class="cc-tool-block__icon" />
            <span class="cc-tool-block__title">{{ group.item.name }}</span>
            <component
              :is="statusIcon(group.item)"
              class="cc-tool-block__status"
              :class="statusClass(group.item)"
            />
            <ChevronDown
              v-if="group.item.output"
              class="cc-tool-block__chevron"
              :class="{ 'cc-tool-block__chevron--open': isExpanded(groupKey(group, index)) }"
            />
          </button>
          <pre
            v-if="group.item.output && isExpanded(groupKey(group, index))"
            class="cc-tool-block__output"
          >{{ group.item.output }}</pre>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cc-tool-blocks {
  margin-top: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.cc-tool-block,
.cc-tool-blocks__group {
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: color-mix(in srgb, var(--color-surface-1) 45%, var(--color-surface-0));
  overflow: hidden;
}

.cc-tool-block__header {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  border: none;
  background: transparent;
  padding: 0.4375rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.cc-tool-block__header--static {
  cursor: default;
}

.cc-tool-block__header:hover:not(.cc-tool-block__header--static) {
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
}

.cc-tool-block__icon {
  height: 0.875rem;
  width: 0.875rem;
  flex-shrink: 0;
  color: var(--color-muted);
}

.cc-tool-block__title {
  font-weight: 500;
  flex-shrink: 0;
}

.cc-tool-block__summary {
  color: var(--color-muted);
  font-size: 0.75rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-tool-block__chevron {
  height: 0.875rem;
  width: 0.875rem;
  flex-shrink: 0;
  color: var(--color-muted);
  transition: transform 0.15s ease;
}

.cc-tool-block__chevron--open {
  transform: rotate(180deg);
}

.cc-tool-block__list {
  list-style: none;
  margin: 0;
  padding: 0.25rem 0.5rem 0.5rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
}

.cc-tool-block__list--nested {
  border-top: none;
  padding-top: 0;
}

.cc-tool-block__row {
  display: flex;
  align-items: center;
  gap: 0.4375rem;
  border-radius: 0.25rem;
  padding: 0.25rem 0.375rem;
  font-size: 0.75rem;
}

.cc-tool-block__row--mono {
  font-family: var(--font-mono);
}

.cc-tool-block__status {
  height: 0.875rem;
  width: 0.875rem;
  flex-shrink: 0;
}

.cc-tool-block__status--running {
  animation: cc-tool-spin 1s linear infinite;
  color: var(--color-muted);
}

.cc-tool-block__status--ok {
  color: #16a34a;
}

.cc-tool-block__status--error {
  color: #dc2626;
}

.cc-tool-block__file,
.cc-tool-block__cmd {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-tool-block__diff {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
}

.cc-tool-block__diff--inline {
  margin-left: auto;
}

.cc-tool-block__diff-add {
  color: #16a34a;
}

.cc-tool-block__diff-del {
  color: #dc2626;
}

.cc-tool-block__row--clickable {
  width: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: inherit;
}

.cc-tool-block__row--clickable:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
}

.cc-tool-block__row--clickable:disabled {
  cursor: default;
}

.cc-tool-block__edit-item--open .cc-tool-block__row--clickable {
  background: color-mix(in srgb, var(--color-surface-1) 60%, transparent);
}

.cc-tool-block__edit-item + .cc-tool-block__edit-item {
  margin-top: 0.125rem;
}

.cc-tool-block__panel-btn {
  display: inline-flex;
  flex-shrink: 0;
  border: none;
  background: transparent;
  padding: 0.125rem;
  color: var(--color-muted);
  cursor: pointer;
}

.cc-tool-block__panel-btn:hover {
  color: var(--color-link);
}

.cc-tool-block__chevron--sm {
  height: 0.75rem;
  width: 0.75rem;
}

.cc-tool-block__inline-diff {
  margin: 0.25rem 0.375rem 0.375rem;
}

.cc-tool-block__output {
  margin: 0;
  max-height: 8rem;
  overflow: auto;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: var(--color-surface-0);
  padding: 0.5rem 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.cc-tool-block--agent {
  margin: 0;
}

.cc-tool-block__icon--agent {
  color: #8b5cf6;
}

.cc-tool-block__agent-status {
  margin-left: auto;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-tool-block__agent-body {
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  padding: 0.375rem 0.75rem 0.625rem;
}

.cc-tool-block__agent-desc {
  margin: 0 0 0.375rem;
  font-size: 0.6875rem;
  line-height: 1.45;
  color: var(--color-muted);
}

.cc-tool-block__agent-output {
  margin-top: 0.375rem;
}

.cc-tool-block__agent-hint {
  margin: 0.25rem 0 0;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

@keyframes cc-tool-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
