<script setup lang="ts">
import { AlertTriangle, X } from "@lucide/vue";

import Btn from "../../ui/Btn.vue";

defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cc-skill-dialog__overlay" @click.self="emit('cancel')">
      <div class="cc-skill-dialog cc-skill-dialog--confirm" role="dialog" aria-modal="true">
        <header class="cc-skill-dialog__header">
          <h3>{{ title }}</h3>
          <button type="button" class="cc-skill-dialog__close" title="关闭" @click="emit('cancel')">
            <X class="h-4 w-4" />
          </button>
        </header>
        <div class="cc-skill-dialog__body cc-skill-dialog__body--center">
          <AlertTriangle class="cc-skill-dialog__warning-icon" />
          <p class="cc-skill-dialog__message">{{ message }}</p>
        </div>
        <footer class="cc-skill-dialog__footer">
          <Btn variant="secondary" size="sm" @click="emit('cancel')">
            {{ cancelText ?? "取消" }}
          </Btn>
          <button type="button" class="cc-skill-dialog__danger-btn" @click="emit('confirm')">
            {{ confirmText ?? "删除" }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cc-skill-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, black 45%, transparent);
  padding: 1rem;
}

.cc-skill-dialog {
  width: min(100%, 24rem);
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 12px 40px color-mix(in srgb, black 18%, transparent);
}

.cc-skill-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.cc-skill-dialog__header h3 {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-skill-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  padding: 0.25rem;
  color: var(--color-muted);
}

.cc-skill-dialog__close:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.cc-skill-dialog__body {
  padding: 1rem;
}

.cc-skill-dialog__body--center {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.25rem 1rem 0.5rem;
}

.cc-skill-dialog__warning-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: #f59e0b;
  margin-bottom: 0.75rem;
}

.cc-skill-dialog__message {
  font-size: 0.8125rem;
  line-height: 1.5;
  white-space: pre-line;
}

.cc-skill-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-top: 1px solid var(--color-border);
}

.cc-skill-dialog__danger-btn {
  height: 1.75rem;
  padding: 0 0.5rem;
  border-radius: 0.375rem;
  border: none;
  background: #dc2626;
  font-size: 0.75rem;
  color: white;
  cursor: pointer;
}

.cc-skill-dialog__danger-btn:hover {
  background: #b91c1c;
}
</style>
