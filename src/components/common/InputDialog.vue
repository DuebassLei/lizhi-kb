<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import Btn from "../ui/Btn.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    label: string;
    placeholder?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    hint?: string;
    initialValue?: string;
    testId?: string;
  }>(),
  {
    confirmLabel: "确定",
    cancelLabel: "取消",
    placeholder: "",
    initialValue: "",
  },
);

const emit = defineEmits<{
  confirm: [value: string];
  cancel: [];
}>();

const value = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    value.value = props.initialValue;
    await nextTick();
    inputRef.value?.focus();
    inputRef.value?.select();
  },
);

function onConfirm() {
  const trimmed = value.value.trim();
  if (!trimmed) return;
  emit("confirm", trimmed);
}

function onCancel() {
  emit("cancel");
}

function onBackdropKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    onCancel();
  }
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    onConfirm();
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="input-dialog-backdrop fixed inset-0 z-[110] flex items-center justify-center bg-overlay px-4 backdrop-blur-sm"
      :data-testid="testId ?? 'input-dialog'"
      @click.self="onCancel"
      @keydown="onBackdropKeydown"
    >
      <div
        class="input-dialog-panel w-full max-w-md rounded-xl border border-border bg-surface-1 px-6 py-5 shadow-float"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${testId ?? 'input-dialog'}-title`"
      >
        <h3
          :id="`${testId ?? 'input-dialog'}-title`"
          class="text-base font-medium tracking-tight text-[var(--color-text)]"
        >
          {{ title }}
        </h3>

        <p v-if="hint" class="mt-1.5 text-xs leading-relaxed text-muted">
          {{ hint }}
        </p>

        <label class="mt-4 block">
          <span class="mb-1.5 block text-xs font-medium text-text-secondary">{{ label }}</span>
          <input
            ref="inputRef"
            v-model="value"
            type="text"
            class="input-field focus-ring w-full"
            :placeholder="placeholder"
            :aria-label="label"
            autocomplete="off"
            spellcheck="false"
            @keydown="onInputKeydown"
          />
        </label>

        <div class="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" size="md" @click="onCancel">
            {{ cancelLabel }}
          </Btn>
          <Btn
            variant="primary"
            size="md"
            :disabled="!value.trim()"
            data-testid="input-dialog-confirm"
            @click="onConfirm"
          >
            {{ confirmLabel }}
          </Btn>
        </div>
      </div>
    </div>
  </Teleport>
</template>
