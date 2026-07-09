<script setup lang="ts">
import { ref } from "vue";
import Btn from "../ui/Btn.vue";

withDefaults(
  defineProps<{
    prominent?: boolean;
  }>(),
  { prominent: false },
);

const emit = defineEmits<{
  submit: [content: string];
}>();

const draft = ref("");
const submitting = ref(false);
const focused = ref(false);

async function handleSubmit() {
  const text = draft.value.trim();
  if (!text || submitting.value) return;
  submitting.value = true;
  try {
    emit("submit", text);
    draft.value = "";
  } finally {
    submitting.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    void handleSubmit();
  }
}
</script>

<template>
  <div
    class="journal-capture"
    :class="{
      'journal-capture--focused': focused,
      'journal-capture--prominent': prominent,
    }"
    data-testid="journal-quick-capture"
  >
    <textarea
      v-model="draft"
      rows="3"
      class="journal-capture__input focus-ring"
      placeholder="写点什么… 支持 **Markdown**"
      @focus="focused = true"
      @blur="focused = false"
      @keydown="onKeydown"
    />
    <div class="journal-capture__footer">
      <kbd class="journal-capture__kbd" aria-hidden="true">Ctrl+Enter</kbd>
      <span class="sr-only">快捷键保存</span>
      <Btn
        variant="primary"
        size="sm"
        :disabled="!draft.trim() || submitting"
        data-testid="journal-quick-submit"
        @click="handleSubmit"
      >
        保存
      </Btn>
    </div>
  </div>
</template>

<style scoped>
.journal-capture {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--color-border) 90%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-surface-1) 96%, var(--color-canvas)),
    color-mix(in srgb, var(--color-surface-0) 88%, var(--color-canvas))
  );
  padding: 0.875rem 1rem;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}

.journal-capture::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.625rem;
  bottom: 0.625rem;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: color-mix(in srgb, var(--color-paw) 50%, var(--color-border));
  transition: background 0.15s ease;
}

.journal-capture--prominent {
  border-color: color-mix(in srgb, var(--color-paw) 24%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-paw) 10%, var(--color-surface-1)),
    color-mix(in srgb, var(--color-surface-1) 94%, var(--color-canvas))
  );
}

.journal-capture--prominent::before {
  background: var(--color-paw);
}

.journal-capture--focused {
  border-color: color-mix(in srgb, var(--color-paw) 40%, transparent);
  box-shadow:
    0 1px 0 color-mix(in srgb, var(--color-text) 4%, transparent),
    0 4px 16px color-mix(in srgb, var(--color-base) 30%, transparent);
}

.journal-capture--focused::before {
  background: var(--color-paw);
}

.journal-capture__input {
  width: 100%;
  resize: none;
  border: none;
  background: transparent;
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--color-text);
}

.journal-capture__input::placeholder {
  color: var(--color-muted);
}

.journal-capture__footer {
  margin-top: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.journal-capture__kbd {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.125rem 0.375rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--color-muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
