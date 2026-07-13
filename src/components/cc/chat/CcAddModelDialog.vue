<script setup lang="ts">
import { ref, watch } from "vue";

import Input from "../../ui/Input.vue";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  add: [payload: { id: string; label?: string }];
}>();

const modelId = ref("");
const modelLabel = ref("");
const error = ref("");

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    modelId.value = "";
    modelLabel.value = "";
    error.value = "";
  },
);

function onSubmit() {
  const id = modelId.value.trim();
  if (!id) {
    error.value = "请输入模型 ID";
    return;
  }
  emit("add", { id, label: modelLabel.value.trim() || undefined });
  emit("close");
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    onSubmit();
  }
}
</script>

<template>
  <div v-if="open" class="cc-add-model-backdrop" @click.self="emit('close')">
    <div class="cc-add-model-dialog" data-testid="cc-add-model-dialog">
      <header class="cc-add-model-dialog__header">
        <h3>添加自定义模型</h3>
        <button type="button" class="text-muted" @click="emit('close')">关闭</button>
      </header>

      <div class="cc-add-model-dialog__body">
        <label class="cc-add-model-dialog__field">
          <span>模型 ID</span>
          <Input
            v-model="modelId"
            placeholder="例如 claude-sonnet-4-6"
            @keydown="onKeydown"
          />
        </label>
        <label class="cc-add-model-dialog__field">
          <span>显示名称（可选）</span>
          <Input
            v-model="modelLabel"
            placeholder="便于识别的别名"
            @keydown="onKeydown"
          />
        </label>
        <p v-if="error" class="cc-add-model-dialog__error">{{ error }}</p>
      </div>

      <footer class="cc-add-model-dialog__footer">
        <button type="button" class="cc-add-model-dialog__btn" @click="emit('close')">
          取消
        </button>
        <button
          type="button"
          class="cc-add-model-dialog__btn cc-add-model-dialog__btn--primary"
          @click="onSubmit"
        >
          添加
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.cc-add-model-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, black 35%, transparent);
  padding: 1rem;
}

.cc-add-model-dialog {
  display: flex;
  width: min(24rem, 100%);
  flex-direction: column;
  border-radius: 0.875rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
}

.cc-add-model-dialog__header,
.cc-add-model-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
}

.cc-add-model-dialog__header {
  border-bottom: 1px solid var(--color-border);
}

.cc-add-model-dialog__header h3 {
  font-size: 0.9375rem;
  font-weight: 600;
}

.cc-add-model-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.cc-add-model-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-size: 0.8125rem;
}

.cc-add-model-dialog__error {
  font-size: 0.75rem;
  color: var(--color-danger, #dc2626);
}

.cc-add-model-dialog__footer {
  border-top: 1px solid var(--color-border);
  justify-content: flex-end;
}

.cc-add-model-dialog__btn {
  border-radius: 0.5rem;
  padding: 0.4375rem 0.875rem;
  font-size: 0.8125rem;
  color: var(--color-text);
}

.cc-add-model-dialog__btn--primary {
  background: var(--color-link);
  color: white;
}
</style>
