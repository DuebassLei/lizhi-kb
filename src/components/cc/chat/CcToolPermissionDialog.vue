<script setup lang="ts">
import { computed } from "vue";

import type { PendingToolPermission } from "../../../stores/ccWorkbench";

const props = defineProps<{
  pending: PendingToolPermission | null;
}>();

const emit = defineEmits<{
  allow: [];
  deny: [];
}>();

const formattedInput = computed(() => {
  const raw = props.pending?.input ?? "";
  if (!raw.trim()) return "{}";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
});
</script>

<template>
  <div v-if="pending" class="cc-perm-backdrop" data-testid="cc-tool-permission-dialog">
    <div class="cc-perm-dialog" role="dialog" aria-modal="true" aria-labelledby="cc-perm-title">
      <header class="cc-perm-dialog__header">
        <h3 id="cc-perm-title">工具权限请求</h3>
      </header>

      <div class="cc-perm-dialog__body">
        <p class="cc-perm-dialog__hint">Agent 请求使用以下工具，是否允许？</p>
        <p class="cc-perm-dialog__label">工具名称</p>
        <p class="cc-perm-dialog__tool-name">{{ pending.toolName }}</p>
        <p class="cc-perm-dialog__label">输入参数</p>
        <pre class="cc-perm-dialog__input">{{ formattedInput }}</pre>
      </div>

      <footer class="cc-perm-dialog__footer">
        <button type="button" class="cc-perm-dialog__btn" @click="emit('deny')">拒绝</button>
        <button
          type="button"
          class="cc-perm-dialog__btn cc-perm-dialog__btn--primary"
          @click="emit('allow')"
        >
          允许
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.cc-perm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, black 40%, transparent);
  padding: 1rem;
}

.cc-perm-dialog {
  display: flex;
  width: min(32rem, 100%);
  max-height: min(80vh, 28rem);
  flex-direction: column;
  border-radius: 0.875rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 12px 40px color-mix(in srgb, black 18%, transparent);
}

.cc-perm-dialog__header {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-perm-dialog__body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 0.875rem 1rem;
}

.cc-perm-dialog__hint {
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.cc-perm-dialog__label {
  margin-bottom: 0.25rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-perm-dialog__tool-name {
  margin-bottom: 0.75rem;
  font-family: ui-monospace, monospace;
  font-size: 0.8125rem;
  font-weight: 500;
}

.cc-perm-dialog__input {
  max-height: 12rem;
  overflow: auto;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 50%, transparent);
  padding: 0.625rem;
  white-space: pre-wrap;
  font-family: ui-monospace, monospace;
  font-size: 0.6875rem;
  line-height: 1.5;
}

.cc-perm-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--color-border);
}

.cc-perm-dialog__btn {
  border-radius: 0.4375rem;
  border: 1px solid var(--color-border);
  padding: 0.4375rem 0.875rem;
  font-size: 0.75rem;
}

.cc-perm-dialog__btn--primary {
  border-color: transparent;
  background: var(--color-link);
  color: white;
}
</style>
