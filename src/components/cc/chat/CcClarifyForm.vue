<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { Send, SquarePen } from "@lucide/vue";

import Btn from "../../ui/Btn.vue";
import type { LizhiClarifyForm } from "../../../utils/ccClarifyForm";
import {
  formatClarifyReply,
  initialClarifyValues,
  validateClarifyForm,
} from "../../../utils/ccClarifyForm";

const props = defineProps<{
  form: LizhiClarifyForm;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  fill: [text: string];
  submit: [text: string];
}>();

const values = reactive<Record<string, string>>({});
const error = reactive({ message: "" as string | null });

watch(
  () => props.form,
  (form) => {
    Object.assign(values, initialClarifyValues(form));
    error.message = null;
  },
  { immediate: true, deep: true },
);

const preview = computed(() => formatClarifyReply(props.form, values));

const useBlockOptions = computed(() =>
  props.form.fields.some(
    (field) =>
      field.type === "select" &&
      ((field.options?.length ?? 0) >= 4 ||
        (field.options?.some((opt) => opt.label.length > 36) ?? false)),
  ),
);

function onSelect(fieldId: string, value: string) {
  values[fieldId] = value;
  error.message = null;
}

function onFill() {
  const validation = validateClarifyForm(props.form, values);
  if (validation) {
    error.message = validation;
    return;
  }
  const text = preview.value.trim();
  if (!text) {
    error.message = "请至少选择或填写一项";
    return;
  }
  emit("fill", text);
}

function onSubmit() {
  const validation = validateClarifyForm(props.form, values);
  if (validation) {
    error.message = validation;
    return;
  }
  const text = preview.value.trim();
  if (!text) {
    error.message = "请至少选择或填写一项";
    return;
  }
  emit("submit", text);
}
</script>

<template>
  <div class="cc-clarify" data-testid="cc-clarify-form">
    <p v-if="form.title" class="cc-clarify__title">{{ form.title }}</p>

    <div v-for="field in form.fields" :key="field.id" class="cc-clarify__field">
      <label class="cc-clarify__label">
        {{ field.label }}
        <span v-if="field.required" class="cc-clarify__req">*</span>
      </label>

      <div
        v-if="field.type === 'select'"
        class="cc-clarify__chips"
        :class="{ 'cc-clarify__chips--block': useBlockOptions }"
      >
        <button
          v-for="opt in field.options ?? []"
          :key="opt.value"
          type="button"
          class="cc-clarify__chip"
          :class="{ 'cc-clarify__chip--active': values[field.id] === opt.value }"
          :disabled="disabled"
          @click="onSelect(field.id, opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <input
        v-else-if="field.type === 'text'"
        v-model="values[field.id]"
        type="text"
        class="cc-clarify__input focus-ring"
        :placeholder="field.placeholder"
        :disabled="disabled"
      />

      <textarea
        v-else
        v-model="values[field.id]"
        class="cc-clarify__textarea focus-ring scrollbar-thin"
        rows="3"
        :placeholder="field.placeholder"
        :disabled="disabled"
      />
    </div>

    <p v-if="preview" class="cc-clarify__preview">{{ preview }}</p>
    <p v-if="error.message" class="cc-clarify__error" role="alert">{{ error.message }}</p>

    <div class="cc-clarify__actions">
      <Btn variant="ghost" size="sm" :disabled="disabled" @click="emit('submit', '随便你定，按你的专业判断来')">
        随便你定
      </Btn>
      <Btn variant="secondary" size="sm" :disabled="disabled" @click="onFill">
        <SquarePen class="h-3.5 w-3.5" />
        填入输入框
      </Btn>
      <Btn variant="primary" size="sm" :disabled="disabled" @click="onSubmit">
        <Send class="h-3.5 w-3.5" />
        确认并发送
      </Btn>
    </div>
  </div>
</template>

<style scoped>
.cc-clarify {
  margin-top: 0.75rem;
  border-radius: 0.625rem;
  border: 1px solid color-mix(in srgb, var(--color-link) 25%, var(--color-border));
  background: color-mix(in srgb, var(--color-link) 4%, var(--color-surface-0));
  padding: 0.75rem;
}

.cc-clarify__title {
  margin-bottom: 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text);
}

.cc-clarify__field + .cc-clarify__field {
  margin-top: 0.625rem;
}

.cc-clarify__label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-clarify__req {
  color: #dc2626;
}

.cc-clarify__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.cc-clarify__chips--block {
  flex-direction: column;
}

.cc-clarify__chips--block .cc-clarify__chip {
  width: 100%;
  border-radius: 0.5rem;
  text-align: left;
  line-height: 1.45;
  padding: 0.4375rem 0.625rem;
}

.cc-clarify__chip {
  border-radius: 9999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.25rem 0.625rem;
  font-size: 0.6875rem;
  color: var(--color-text);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.cc-clarify__chip:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-link) 40%, var(--color-border));
}

.cc-clarify__chip--active {
  border-color: var(--color-link);
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
}

.cc-clarify__chip:disabled {
  opacity: 0.5;
}

.cc-clarify__input,
.cc-clarify__textarea {
  width: 100%;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.4375rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-text);
}

.cc-clarify__textarea {
  resize: vertical;
  min-height: 4rem;
}

.cc-clarify__preview {
  margin-top: 0.625rem;
  white-space: pre-wrap;
  border-radius: 0.375rem;
  background: color-mix(in srgb, var(--color-surface-1) 60%, transparent);
  padding: 0.5rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-clarify__error {
  margin-top: 0.375rem;
  font-size: 0.6875rem;
  color: #dc2626;
}

.cc-clarify__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
</style>
