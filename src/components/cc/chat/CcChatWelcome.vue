<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Bot, Sparkles } from "@lucide/vue";

import { listCcAgents, type CcAgentEntry } from "../../../services/ccWorkbenchService";
import { loadDefaultAgentId, sortAgentsWithRecent, loadRecentAgentIds } from "../../../utils/ccContextUtils";

defineProps<{
  providerName?: string | null;
  selectedAgent?: CcAgentEntry | null;
}>();

const emit = defineEmits<{
  "select-agent": [agent: CcAgentEntry | null];
}>();

const agents = ref<CcAgentEntry[]>([]);

const quickAgents = computed(() => {
  const sorted = sortAgentsWithRecent(agents.value, loadRecentAgentIds());
  const defaultId = loadDefaultAgentId();
  const picks: CcAgentEntry[] = [];
  if (defaultId) {
    const def = sorted.find((a) => a.id === defaultId);
    if (def) picks.push(def);
  }
  for (const agent of sorted) {
    if (picks.length >= 4) break;
    if (picks.some((a) => a.id === agent.id && a.scope === agent.scope)) continue;
    picks.push(agent);
  }
  return picks;
});

onMounted(async () => {
  try {
    agents.value = await listCcAgents();
  } catch {
    agents.value = [];
  }
});
</script>

<template>
  <div class="cc-chat-welcome" data-testid="cc-chat-welcome">
    <div class="cc-chat-welcome__logo-wrap">
      <div class="cc-chat-welcome__logo" aria-hidden="true">
        <Sparkles class="h-10 w-10" />
      </div>
      <span class="cc-chat-welcome__version">Agent</span>
    </div>
    <p class="cc-chat-welcome__hint">
      给 Claude Code 发送消息
      <span v-if="providerName" class="text-muted"> · {{ providerName }}</span>
    </p>
    <p v-if="quickAgents.length" class="cc-chat-welcome__subhint">
      选择智能体开始，或在输入框输入 <code>#</code> 引用
    </p>
    <div v-if="quickAgents.length" class="cc-chat-welcome__agents">
      <button
        v-for="agent in quickAgents"
        :key="`${agent.scope}:${agent.id}`"
        type="button"
        class="cc-chat-welcome__agent"
        :class="{ 'cc-chat-welcome__agent--active': selectedAgent?.id === agent.id && selectedAgent?.scope === agent.scope }"
        @click="emit('select-agent', agent)"
      >
        <Bot class="h-3.5 w-3.5 shrink-0" />
        <span>{{ agent.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cc-chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: min(50vh, 20rem);
  gap: 0.75rem;
  color: var(--color-muted);
}

.cc-chat-welcome__logo-wrap {
  position: relative;
  display: inline-flex;
}

.cc-chat-welcome__logo {
  display: flex;
  height: 4.5rem;
  width: 4.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 1.25rem;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, #f97316 22%, transparent),
    color-mix(in srgb, var(--color-link) 18%, transparent)
  );
  color: #f97316;
  box-shadow: 0 12px 32px color-mix(in srgb, #f97316 18%, transparent);
}

.cc-chat-welcome__version {
  position: absolute;
  right: -0.25rem;
  top: -0.25rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-chat-welcome__hint {
  font-size: 0.875rem;
}

.cc-chat-welcome__subhint {
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-chat-welcome__subhint code {
  border-radius: 0.25rem;
  background: var(--color-surface-1);
  padding: 0 0.25rem;
  font-size: 0.6875rem;
}

.cc-chat-welcome__agents {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  max-width: min(32rem, 92vw);
  margin-top: 0.25rem;
}

.cc-chat-welcome__agent {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-text);
}

.cc-chat-welcome__agent:hover {
  border-color: color-mix(in srgb, #8b5cf6 45%, var(--color-border));
  background: color-mix(in srgb, #8b5cf6 8%, var(--color-surface-0));
}

.cc-chat-welcome__agent--active {
  border-color: color-mix(in srgb, #8b5cf6 55%, var(--color-border));
  background: color-mix(in srgb, #8b5cf6 12%, var(--color-surface-0));
  color: #7c3aed;
}
</style>
