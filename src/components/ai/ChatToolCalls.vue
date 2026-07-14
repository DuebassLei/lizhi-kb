<script setup lang="ts">
import { ref, watch } from "vue";
import { Check, ChevronRight, LoaderCircle, Wrench } from "@lucide/vue";
import {
  shouldAutoExpandTool,
  toolDisplayLabel,
  toolOutputSummary,
} from "../../utils/chatToolDisplay";

export type ChatToolCallItem = {
  name: string;
  input: string;
  output?: string;
};

const props = defineProps<{
  tools: ChatToolCallItem[];
}>();

const expanded = ref<Record<number, boolean>>({});

watch(
  () => props.tools,
  (tools) => {
    const next = { ...expanded.value };
    tools.forEach((tool, i) => {
      if (next[i] === undefined) {
        next[i] = shouldAutoExpandTool(tool.output);
      }
    });
    expanded.value = next;
  },
  { immediate: true, deep: true },
);

function toggle(i: number) {
  expanded.value = { ...expanded.value, [i]: !expanded.value[i] };
}

function isDone(tool: ChatToolCallItem): boolean {
  return tool.output != null;
}
</script>

<template>
  <div
    v-if="tools.length"
    class="chat-tools"
    role="group"
    aria-label="工具调用"
    data-testid="chat-tool-calls"
  >
    <div class="chat-tools__heading">
      <Wrench class="chat-tools__heading-icon" aria-hidden="true" />
      <span>工具调用</span>
      <span class="chat-tools__count">{{ tools.length }}</span>
    </div>

    <ul class="chat-tools__list">
      <li v-for="(tool, i) in tools" :key="`${tool.name}-${i}`" class="chat-tools__item">
        <button
          type="button"
          class="chat-tools__row focus-ring"
          :aria-expanded="Boolean(expanded[i])"
          :data-testid="`chat-tool-toggle-${i}`"
          @click="toggle(i)"
        >
          <ChevronRight
            class="chat-tools__chevron"
            :class="{ 'chat-tools__chevron--open': expanded[i] }"
            aria-hidden="true"
          />
          <span
            class="chat-tools__status"
            :class="isDone(tool) ? 'chat-tools__status--done' : 'chat-tools__status--pending'"
            aria-hidden="true"
          >
            <Check v-if="isDone(tool)" class="h-3 w-3" />
            <LoaderCircle v-else class="h-3 w-3 animate-spin" />
          </span>
          <span class="chat-tools__label">{{ toolDisplayLabel(tool.name) }}</span>
          <span class="chat-tools__name" :title="tool.name">{{ tool.name }}</span>
          <span class="chat-tools__summary">{{ toolOutputSummary(tool.output) }}</span>
        </button>

        <div v-show="expanded[i]" class="chat-tools__detail">
          <div v-if="tool.input?.trim()" class="chat-tools__block">
            <span class="chat-tools__block-label">参数</span>
            <pre class="chat-tools__pre">{{ tool.input }}</pre>
          </div>
          <div v-if="tool.output != null" class="chat-tools__block">
            <span class="chat-tools__block-label">结果</span>
            <pre class="chat-tools__pre">{{ tool.output }}</pre>
          </div>
          <p v-else class="chat-tools__pending-hint">正在等待工具返回…</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.chat-tools {
  margin-top: 0.75rem;
  border-top: 1px solid var(--color-divider);
  padding-top: 0.75rem;
}

.chat-tools__heading {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--color-muted);
}

.chat-tools__heading-icon {
  width: 0.75rem;
  height: 0.75rem;
  opacity: 0.85;
}

.chat-tools__count {
  display: inline-flex;
  min-width: 1.125rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--color-link) 16%, transparent);
  padding: 0 0.35rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--color-link);
}

.chat-tools__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.chat-tools__item {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-border) 90%, transparent);
  border-radius: 0.625rem;
  background: color-mix(in srgb, var(--color-surface-0) 72%, transparent);
}

.chat-tools__row {
  display: grid;
  grid-template-columns: auto auto minmax(0, auto) minmax(0, 1fr) minmax(0, 1.6fr);
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0.45rem 0.55rem;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
  transition: background-color 140ms ease;
}

.chat-tools__row:hover {
  background: color-mix(in srgb, var(--color-link) 6%, transparent);
}

.chat-tools__chevron {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  color: var(--color-muted);
  transition: transform 140ms ease;
}

.chat-tools__chevron--open {
  transform: rotate(90deg);
}

.chat-tools__status {
  display: inline-flex;
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
}

.chat-tools__status--done {
  background: color-mix(in srgb, var(--color-secure) 18%, transparent);
  color: var(--color-secure);
}

.chat-tools__status--pending {
  background: color-mix(in srgb, var(--color-link) 16%, transparent);
  color: var(--color-link);
}

.chat-tools__label {
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  color: var(--color-text);
}

.chat-tools__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: color-mix(in srgb, var(--color-link) 75%, var(--color-muted));
}

.chat-tools__summary {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  color: var(--color-muted);
  justify-self: end;
  text-align: right;
}

.chat-tools__detail {
  border-top: 1px solid var(--color-divider);
  padding: 0.5rem 0.6rem 0.6rem;
  background: color-mix(in srgb, var(--color-base) 35%, var(--color-surface-0));
}

.chat-tools__block + .chat-tools__block {
  margin-top: 0.45rem;
}

.chat-tools__block-label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.chat-tools__pre {
  margin: 0;
  max-height: 9rem;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface-0);
  padding: 0.5rem 0.6rem;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  line-height: 1.45;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-tools__pending-hint {
  margin: 0;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

@media (max-width: 420px) {
  .chat-tools__row {
    grid-template-columns: auto auto minmax(0, 1fr);
    grid-template-rows: auto auto;
  }

  .chat-tools__name {
    display: none;
  }

  .chat-tools__summary {
    grid-column: 3 / -1;
    justify-self: stretch;
    text-align: left;
  }
}
</style>
