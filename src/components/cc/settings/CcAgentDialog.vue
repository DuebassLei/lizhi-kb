<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { CcAgentEntry, CcAgentInput } from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";

const props = defineProps<{
  open: boolean;
  agent: CcAgentEntry | null;
  saving?: boolean;
  defaultScope?: "global" | "project";
}>();

const emit = defineEmits<{
  close: [];
  save: [input: CcAgentInput];
}>();

const name = ref("");
const description = ref("");
const prompt = ref("");
const scope = ref<"global" | "project">("global");

const isEdit = computed(() => Boolean(props.agent));

watch(
  () => [props.open, props.agent] as const,
  ([open, agent]) => {
    if (!open) return;
    name.value = agent?.name ?? "";
    description.value = agent?.description ?? "";
    prompt.value = agent?.prompt ?? "";
    scope.value =
      agent?.scope === "project" || agent?.scope === "global"
        ? agent.scope
        : props.defaultScope ?? "global";
  },
  { immediate: true },
);

function onSave() {
  emit("save", {
    id: props.agent?.id ?? null,
    name: name.value.trim(),
    description: description.value.trim(),
    prompt: prompt.value.trim(),
    scope: scope.value,
  });
}
</script>

<template>
  <div v-if="open" class="cc-agent-dialog-backdrop" @click.self="emit('close')">
    <div class="cc-agent-dialog" role="dialog" aria-label="Agent 编辑">
      <header class="cc-agent-dialog__header">
        <h3 class="text-sm font-semibold">{{ isEdit ? "编辑 Agent" : "新建 Agent" }}</h3>
        <p class="text-xs text-muted">保存到 ~/.claude/agents/ 或项目 .claude/agents/</p>
      </header>

      <div class="cc-agent-dialog__body">
        <label class="cc-agent-dialog__field">
          <span>名称</span>
          <input v-model="name" type="text" class="cc-agent-dialog__input" placeholder="代码审查" />
        </label>

        <label class="cc-agent-dialog__field">
          <span>描述</span>
          <input
            v-model="description"
            type="text"
            class="cc-agent-dialog__input"
            placeholder="可选，简短说明用途"
          />
        </label>

        <div class="cc-agent-dialog__field">
          <span>作用域</span>
          <div class="flex gap-2">
            <button
              type="button"
              class="cc-agent-dialog__scope"
              :class="{ 'cc-agent-dialog__scope--active': scope === 'global' }"
              @click="scope = 'global'"
            >
              全局
            </button>
            <button
              type="button"
              class="cc-agent-dialog__scope"
              :class="{ 'cc-agent-dialog__scope--active': scope === 'project' }"
              @click="scope = 'project'"
            >
              项目
            </button>
          </div>
        </div>

        <label class="cc-agent-dialog__field">
          <span>系统指令</span>
          <textarea
            v-model="prompt"
            class="cc-agent-dialog__textarea"
            rows="8"
            placeholder="Agent 被 # 选择后将注入到对话上下文中…"
          />
        </label>
      </div>

      <footer class="cc-agent-dialog__footer">
        <Btn variant="ghost" size="sm" :disabled="saving" @click="emit('close')">取消</Btn>
        <Btn variant="primary" size="sm" :disabled="saving || !name.trim() || !prompt.trim()" @click="onSave">
          保存
        </Btn>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.cc-agent-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-overlay, #000) 45%, transparent);
  padding: 1rem;
}

.cc-agent-dialog {
  width: min(100%, 32rem);
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 16px 48px color-mix(in srgb, #000 20%, transparent);
}

.cc-agent-dialog__header {
  border-bottom: 1px solid var(--color-border);
  padding: 0.875rem 1rem;
}

.cc-agent-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.cc-agent-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-agent-dialog__input,
.cc-agent-dialog__textarea {
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  color: var(--color-text);
  outline: none;
}

.cc-agent-dialog__textarea {
  resize: vertical;
  min-height: 8rem;
  font-family: ui-monospace, monospace;
  line-height: 1.45;
}

.cc-agent-dialog__scope {
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-agent-dialog__scope--active {
  border-color: var(--color-link);
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  color: var(--color-link);
}

.cc-agent-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  border-top: 1px solid var(--color-border);
  padding: 0.75rem 1rem;
}
</style>
