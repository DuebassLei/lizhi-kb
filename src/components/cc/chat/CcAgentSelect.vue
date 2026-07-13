<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Bot, Check, ChevronDown, Globe, Folder, Loader2, Star } from "@lucide/vue";

import {
  listCcAgents,
  type CcAgentEntry,
} from "../../../services/ccWorkbenchService";
import {
  BUILTIN_DEFAULT_AGENT_ID,
  loadDefaultAgentId,
  getEffectiveDefaultAgentId,
  loadRecentAgentIds,
  saveDefaultAgentId,
  sortAgentsWithRecent,
} from "../../../utils/ccContextUtils";

const props = defineProps<{
  selectedAgent?: CcAgentEntry | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:selectedAgent": [agent: CcAgentEntry | null];
}>();

const open = ref(false);
const loading = ref(false);
const agents = ref<CcAgentEntry[]>([]);
const defaultAgentId = ref(getEffectiveDefaultAgentId());

const displayName = computed(() => props.selectedAgent?.name ?? "智能体");

const agentTitle = computed(() => {
  const agent = props.selectedAgent;
  if (!agent) return "选择智能体（#）";
  const scope = agent.scope === "global" ? "全局" : "项目";
  const parts = [agent.name, scope];
  if (agent.description.trim()) parts.push(agent.description.trim());
  return parts.join(" · ");
});

const sortedAgents = computed(() =>
  sortAgentsWithRecent(agents.value, loadRecentAgentIds()),
);

const recentIds = computed(() => new Set(loadRecentAgentIds()));

function agentKey(agent: CcAgentEntry): string {
  return `${agent.scope}:${agent.id}`;
}

function isDefault(agent: CcAgentEntry): boolean {
  return agent.id === getEffectiveDefaultAgentId();
}

async function loadAgents() {
  loading.value = true;
  try {
    agents.value = await listCcAgents();
  } catch {
    agents.value = [];
  } finally {
    loading.value = false;
  }
}

function onToggle(event: MouseEvent) {
  event.stopPropagation();
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value && !agents.value.length) {
    void loadAgents();
  }
}

function onSelect(agent: CcAgentEntry | null) {
  open.value = false;
  emit("update:selectedAgent", agent);
}

function onSetDefault(event: MouseEvent, agent: CcAgentEntry) {
  event.stopPropagation();
  if (isDefault(agent) && loadDefaultAgentId()) {
    defaultAgentId.value = BUILTIN_DEFAULT_AGENT_ID;
    saveDefaultAgentId(null);
    return;
  }
  if (isDefault(agent)) return;
  defaultAgentId.value = agent.id;
  saveDefaultAgentId(agent.id);
}

watch(
  () => props.selectedAgent?.id,
  () => {
    defaultAgentId.value = getEffectiveDefaultAgentId();
  },
);

onMounted(() => {
  void loadAgents();
});

defineExpose({
  close: () => {
    open.value = false;
  },
  refresh: loadAgents,
});
</script>

<template>
  <div class="cc-chat-select cc-agent-select">
    <button
      type="button"
      class="cc-chat-select__trigger cc-chat-select__trigger--agent"
      :class="{ 'cc-chat-select__trigger--active': selectedAgent }"
      :disabled="disabled"
      :title="agentTitle"
      @click.stop="onToggle"
    >
      <Bot class="h-3 w-3 shrink-0" />
      <span class="truncate">{{ displayName }}</span>
      <ChevronDown class="h-3 w-3 shrink-0" />
    </button>
    <div v-if="open" class="cc-chat-select__menu cc-chat-select__menu--agent">
      <div class="cc-chat-select__menu-header">
        <span>智能体</span>
        <Loader2 v-if="loading" class="h-3 w-3 animate-spin" />
      </div>
      <button
        type="button"
        class="cc-chat-select__item cc-chat-select__item--agent"
        :class="{ 'cc-chat-select__item--active': !selectedAgent }"
        @click="onSelect(null)"
      >
        <span class="font-medium">无</span>
        <Check v-if="!selectedAgent" class="cc-chat-select__status cc-chat-select__status--ok" />
      </button>
      <template v-if="sortedAgents.length">
        <button
          v-for="agent in sortedAgents"
          :key="agentKey(agent)"
          type="button"
          class="cc-chat-select__item cc-chat-select__item--agent"
          :class="{ 'cc-chat-select__item--active': selectedAgent?.id === agent.id && selectedAgent?.scope === agent.scope }"
          @click="onSelect(agent)"
        >
          <div class="cc-chat-select__item-main">
            <span class="cc-chat-select__agent-name">
              <Bot class="h-3 w-3 shrink-0 text-muted" />
              <span class="font-medium">{{ agent.name }}</span>
              <span v-if="recentIds.has(agent.id)" class="cc-chat-select__recent">最近</span>
            </span>
            <span class="cc-chat-select__desc">
              <Globe v-if="agent.scope === 'global'" class="inline h-2.5 w-2.5" />
              <Folder v-else class="inline h-2.5 w-2.5" />
              {{ agent.scope === "global" ? "全局" : "项目" }}
              <span v-if="agent.description"> · {{ agent.description }}</span>
            </span>
          </div>
          <div class="cc-chat-select__agent-actions">
            <button
              type="button"
              class="cc-chat-select__default-btn"
              :class="{ 'cc-chat-select__default-btn--active': isDefault(agent) }"
              :title="isDefault(agent) ? '取消默认智能体' : '设为默认（新会话自动选中）'"
              @click="onSetDefault($event, agent)"
            >
              <Star class="h-3 w-3" />
            </button>
            <Check
              v-if="selectedAgent?.id === agent.id && selectedAgent?.scope === agent.scope"
              class="cc-chat-select__status cc-chat-select__status--ok"
            />
          </div>
        </button>
      </template>
      <p v-else-if="!loading" class="cc-chat-select__empty">暂无智能体，请在设置 → Agents 中创建</p>
    </div>
  </div>
</template>

<style scoped>
.cc-chat-select {
  position: relative;
}

.cc-chat-select__trigger {
  display: inline-flex;
  max-width: 9rem;
  align-items: center;
  gap: 0.25rem;
  border-radius: 0.4375rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.3125rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-text);
}

.cc-chat-select__trigger--agent.cc-chat-select__trigger--active {
  border-color: color-mix(in srgb, var(--color-link) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-link) 8%, var(--color-surface-0));
  color: var(--color-link);
}

.cc-chat-select__trigger:disabled {
  opacity: 0.5;
}

.cc-chat-select__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.25rem);
  z-index: 20;
  min-width: 14rem;
  max-width: min(20rem, 86vw);
  max-height: min(18rem, 52vh);
  overflow-y: auto;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 8px 24px color-mix(in srgb, black 14%, transparent);
  padding: 0.25rem;
}

.cc-chat-select__menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0.375rem 0.375rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-chat-select__item--agent {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
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

.cc-chat-select__agent-name {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
}

.cc-chat-select__recent {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  padding: 0 0.3125rem;
  font-size: 0.5625rem;
  color: var(--color-link);
}

.cc-chat-select__desc {
  margin-top: 0.125rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-chat-select__agent-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.cc-chat-select__default-btn {
  display: inline-flex;
  border-radius: 0.3125rem;
  padding: 0.1875rem;
  color: var(--color-muted);
  opacity: 0.65;
}

.cc-chat-select__default-btn:hover,
.cc-chat-select__default-btn--active {
  opacity: 1;
  color: #d97706;
  background: color-mix(in srgb, #f59e0b 12%, transparent);
}

.cc-chat-select__status {
  height: 0.875rem;
  width: 0.875rem;
  flex-shrink: 0;
}

.cc-chat-select__status--ok {
  color: #16a34a;
}

.cc-chat-select__empty {
  padding: 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}
</style>
