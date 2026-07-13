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
  agentToolIsActive,
  countEditDiff,
  extractAgentDescription,
  extractAgentLabel,
  extractToolCommand,
  extractToolFilePath,
  extractToolPattern,
  extractToolResultSummary,
  fileBaseName,
  formatCcToolDisplayName,
  groupCcToolCalls,
  isLizhiVaultTool,
  isMcpToolName,
  toolHasNoResult,
  toolIsComplete,
  toolIsError,
  toolStatusHint,
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

const showVaultLegend = computed(() => props.tools.some((t) => isLizhiVaultTool(t.name)));

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

function toSubagentItem(
  agent: CcToolCallItem,
  nestedItems: CcToolCallItem[],
  groupIndex: number,
): CcSubagentItem {
  const active = agentToolIsActive(agent, { nestedItems, streaming: props.streaming });
  const status = active
    ? "running"
    : toolIsError(agent.output)
      ? "error"
      : "completed";
  const startedAt = agent.startedAt;
  const completedAt = agent.completedAt;
  const completed = status === "completed";
  const durationMs =
    completed && startedAt != null && completedAt != null
      ? completedAt - startedAt
      : undefined;
  return {
    id: `tool-block:${groupIndex}:${agent.id ?? agent.name}`,
    name: extractAgentLabel(agent.input),
    status,
    description: extractAgentDescription(agent.input),
    output: agent.output,
    updatedAt: completedAt ?? startedAt ?? Date.now(),
    startedAt,
    durationMs,
    parentId: `group-${groupIndex}`,
  };
}

function agentGroupIsActive(
  group: Extract<ReturnType<typeof groupCcToolCalls>[number], { type: "agent_group" }>,
): boolean {
  return agentToolIsActive(group.agent, {
    nestedItems: group.items,
    streaming: props.streaming,
  });
}

function openAgentDetail(agent: CcToolCallItem, groupIndex: number, event: Event) {
  event.stopPropagation();
  const group = groups.value[groupIndex];
  const nestedItems = group?.type === "agent_group" ? group.items : [];
  emit("selectSubagent", toSubagentItem(agent, nestedItems, groupIndex));
}

function isAgentExpanded(key: string): boolean {
  return expandedGroups.value[key] ?? true;
}

function resultSourceLabel(name: string): string | null {
  if (isLizhiVaultTool(name)) return "知识库";
  if (isMcpToolName(name)) return "MCP";
  return null;
}

function searchGroupTitle(items: CcToolCallItem[]): string {
  return items.every((item) => isLizhiVaultTool(item.name)) ? "知识库查询" : "Search";
}

function rowStatusClass(item: CcToolCallItem): string {
  if (!toolIsComplete(item)) return "cc-tool-block__row-wrap--running";
  if (toolIsError(item.output)) return "cc-tool-block__row-wrap--error";
  if (toolHasNoResult(item.output)) return "cc-tool-block__row-wrap--empty";
  return "cc-tool-block__row-wrap--ok";
}
</script>

<template>
  <div class="cc-tool-blocks">
    <p v-if="showVaultLegend" class="cc-tool-blocks__legend">
      下方工具块为知识库检索/读取的真实返回；正文摘要由模型整理，请以工具块为准。
    </p>
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
          <li
            v-for="(item, i) in group.items"
            :key="i"
            class="cc-tool-block__row-wrap"
            :class="rowStatusClass(item)"
          >
            <div class="cc-tool-block__row">
              <component
                :is="statusIcon(item)"
                class="cc-tool-block__status"
                :class="statusClass(item)"
                :title="toolStatusHint(item)"
              />
              <span class="cc-tool-block__file">{{ fileBaseName(extractToolFilePath(item.input) ?? item.name) }}</span>
              <span v-if="resultSourceLabel(item.name)" class="cc-tool-block__source">{{ resultSourceLabel(item.name) }}</span>
            </div>
            <p v-if="extractToolResultSummary(item.output, item.name)" class="cc-tool-block__result">
              {{ extractToolResultSummary(item.output, item.name) }}
            </p>
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
            :class="[
              { 'cc-tool-block__edit-item--open': isEditDiffExpanded(index, i) },
              rowStatusClass(item),
            ]"
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
                :title="toolStatusHint(item)"
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
            <p v-if="extractToolResultSummary(item.output, item.name)" class="cc-tool-block__result cc-tool-block__result--nested">
              {{ extractToolResultSummary(item.output, item.name) }}
            </p>
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
          <li
            v-for="(item, i) in group.items"
            :key="i"
            class="cc-tool-block__row-wrap"
            :class="rowStatusClass(item)"
          >
            <div class="cc-tool-block__row cc-tool-block__row--mono">
              <component
                :is="statusIcon(item)"
                class="cc-tool-block__status"
                :class="statusClass(item)"
                :title="toolStatusHint(item)"
              />
              <span class="cc-tool-block__cmd">{{ extractToolCommand(item.input) ?? item.name }}</span>
            </div>
            <p v-if="extractToolResultSummary(item.output, item.name)" class="cc-tool-block__result">
              {{ extractToolResultSummary(item.output, item.name) }}
            </p>
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
          <span class="cc-tool-block__title">{{ searchGroupTitle(group.items) }}</span>
          <span class="cc-tool-block__summary">{{ group.items.length }} 次</span>
          <ChevronDown
            class="cc-tool-block__chevron"
            :class="{ 'cc-tool-block__chevron--open': isExpanded(groupKey(group, index), true) }"
          />
        </button>
        <ul v-show="isExpanded(groupKey(group, index), true)" class="cc-tool-block__list">
          <li
            v-for="(item, i) in group.items"
            :key="i"
            class="cc-tool-block__row-wrap"
            :class="rowStatusClass(item)"
          >
            <div class="cc-tool-block__row cc-tool-block__row--mono">
              <component
                :is="statusIcon(item)"
                class="cc-tool-block__status"
                :class="statusClass(item)"
                :title="toolStatusHint(item)"
              />
              <span class="cc-tool-block__cmd">{{ extractToolPattern(item.input) ?? item.name }}</span>
              <span v-if="resultSourceLabel(item.name)" class="cc-tool-block__source">{{ resultSourceLabel(item.name) }}</span>
            </div>
            <p v-if="extractToolResultSummary(item.output, item.name)" class="cc-tool-block__result">
              {{ extractToolResultSummary(item.output, item.name) }}
            </p>
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
            <span class="cc-tool-block__agent-status">{{
              agentStatusLabel(group.agent, { nestedItems: group.items, streaming })
            }}</span>
            <span v-if="!agentGroupIsActive(group)" class="cc-tool-block__agent-progress">完成</span>
            <LoaderCircle v-else class="cc-tool-block__agent-progress cc-tool-block__agent-progress--spin h-3 w-3" />
            <component
              :is="statusIcon(group.agent)"
              class="cc-tool-block__status"
              :class="agentGroupIsActive(group) ? 'cc-tool-block__status--running' : statusClass(group.agent)"
              :title="agentGroupIsActive(group) ? '运行中' : toolStatusHint(group.agent)"
            />
            <button
              v-if="!agentGroupIsActive(group)"
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
                  :title="toolStatusHint(item)"
                />
                <span class="cc-tool-block__file">{{ formatCcToolDisplayName(item.name) }}</span>
                <span v-if="extractToolFilePath(item.input)" class="cc-tool-block__cmd">
                  {{ fileBaseName(extractToolFilePath(item.input)!) }}
                </span>
              </li>
            </ul>

            <div v-if="group.agent.output" class="cc-tool-block__agent-output">
              <CcSubagentOutputView :output="group.agent.output" />
            </div>
            <p v-else-if="agentGroupIsActive(group)" class="cc-tool-block__agent-hint">
              子代理正在运行…
            </p>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="cc-tool-block" :class="rowStatusClass(group.item)">
          <button
            type="button"
            class="cc-tool-block__header"
            @click="toggleGroup(groupKey(group, index))"
          >
            <Terminal class="cc-tool-block__icon" />
            <span class="cc-tool-block__title">{{ formatCcToolDisplayName(group.item.name) }}</span>
            <span v-if="resultSourceLabel(group.item.name)" class="cc-tool-block__source">{{ resultSourceLabel(group.item.name) }}</span>
            <component
              :is="statusIcon(group.item)"
              class="cc-tool-block__status"
              :class="statusClass(group.item)"
              :title="toolStatusHint(group.item)"
            />
            <ChevronDown
              v-if="group.item.output"
              class="cc-tool-block__chevron"
              :class="{ 'cc-tool-block__chevron--open': isExpanded(groupKey(group, index)) }"
            />
          </button>
          <p
            v-if="extractToolResultSummary(group.item.output, group.item.name) && !isExpanded(groupKey(group, index))"
            class="cc-tool-block__result cc-tool-block__result--header"
          >
            {{ extractToolResultSummary(group.item.output, group.item.name) }}
          </p>
          <pre
            v-if="group.item.output && isExpanded(groupKey(group, index))"
            class="cc-tool-block__output"
          >{{ group.item.output }}</pre>
          <p v-else-if="toolIsComplete(group.item) && toolHasNoResult(group.item.output)" class="cc-tool-block__empty-result">
            工具已执行但未返回有效内容
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cc-tool-blocks {
  margin-top: 0.75rem;
  margin-bottom: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;
}

.cc-tool-blocks__legend {
  margin: 0 0 0.25rem;
  font-size: 0.625rem;
  line-height: 1.45;
  color: var(--color-muted);
  opacity: 0.8;
}

.cc-tool-block__row-wrap {
  border-radius: 0.25rem;
  padding: 0.125rem 0.25rem;
}

.cc-tool-block__row-wrap--error {
  background: color-mix(in srgb, var(--color-danger) 6%, transparent);
}

.cc-tool-block__row-wrap--empty {
  background: color-mix(in srgb, var(--color-warning) 6%, transparent);
}

.cc-tool-block__source {
  flex-shrink: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-secure) 10%, transparent);
  padding: 0 0.3125rem;
  font-size: 0.5625rem;
  font-weight: 600;
  color: var(--color-secure);
  letter-spacing: 0.02em;
}

.cc-tool-block__result {
  margin: 0.125rem 0 0.25rem 1.5rem;
  font-size: 0.625rem;
  line-height: 1.45;
  color: var(--color-muted);
  word-break: break-word;
}

.cc-tool-block__result--nested {
  margin-left: 2rem;
}

.cc-tool-block__result--header {
  margin: 0;
  padding: 0 0.75rem 0.4375rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
}

.cc-tool-block__empty-result {
  margin: 0;
  padding: 0.375rem 0.75rem 0.5rem;
  font-size: 0.625rem;
  color: var(--color-warning);
  border-top: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
}

.cc-tool-block__summary--result {
  font-style: italic;
}

.cc-tool-block,
.cc-tool-blocks__group {
  border: 1px solid color-mix(in srgb, var(--color-border) 65%, transparent);
  border-radius: var(--radius-md);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-surface-1) 35%, var(--color-surface-0)),
      color-mix(in srgb, var(--color-surface-0) 90%, var(--color-surface-1))
    );
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.cc-tool-block:hover,
.cc-tool-blocks__group:hover {
  border-color: color-mix(in srgb, var(--color-border) 100%, transparent);
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
  transition: background-color 0.12s ease;
}

.cc-tool-block__header--static {
  cursor: default;
}

.cc-tool-block__header:hover:not(.cc-tool-block__header--static) {
  background: color-mix(in srgb, var(--color-surface-1) 55%, transparent);
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
  transition: transform 0.18s ease;
}

.cc-tool-block__chevron--open {
  transform: rotate(180deg);
}

.cc-tool-block__list {
  list-style: none;
  margin: 0;
  padding: 0.25rem 0.5rem 0.5rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
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
  color: var(--color-secure);
}

.cc-tool-block__status--error {
  color: var(--color-danger);
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
  color: var(--color-secure);
}

.cc-tool-block__diff-del {
  color: var(--color-danger);
}

.cc-tool-block__row--clickable {
  width: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: inherit;
  transition: background-color 0.12s ease;
}

.cc-tool-block__row--clickable:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-surface-1) 55%, transparent);
}

.cc-tool-block__row--clickable:disabled {
  cursor: default;
}

.cc-tool-block__edit-item--open .cc-tool-block__row--clickable {
  background: color-mix(in srgb, var(--color-surface-1) 45%, transparent);
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
  border-radius: 0.1875rem;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.cc-tool-block__panel-btn:hover {
  color: var(--color-link);
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
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
  border-top: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
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
  color: var(--color-link);
}

.cc-tool-block__agent-status {
  margin-left: auto;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-tool-block__agent-progress {
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-tool-block__agent-progress--spin {
  color: var(--color-link);
  animation: cc-status-spin 1s linear infinite;
}

.cc-tool-block__agent-body {
  border-top: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
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

@keyframes cc-status-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
