<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Check, Pencil, X } from "@lucide/vue";

const props = defineProps<{
  title: string;
  editable?: boolean;
}>();

const emit = defineEmits<{
  rename: [title: string];
}>();

const editing = ref(false);
const editValue = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

const displayTitle = computed(() => props.title.trim() || "新会话");

watch(
  () => props.title,
  () => {
    if (!editing.value) editValue.value = props.title;
  },
);

function startEdit() {
  if (!props.editable) return;
  editValue.value = displayTitle.value;
  editing.value = true;
  void nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
}

function commitEdit() {
  editing.value = false;
  const trimmed = editValue.value.trim().slice(0, 50);
  if (trimmed && trimmed !== displayTitle.value) {
    emit("rename", trimmed);
  }
}

function cancelEdit() {
  editing.value = false;
  editValue.value = displayTitle.value;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    commitEdit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    cancelEdit();
  }
}
</script>

<template>
  <div class="cc-session-title" data-testid="cc-session-title">
    <div v-if="editing" class="cc-session-title__edit" @click.stop>
      <input
        ref="inputRef"
        v-model="editValue"
        type="text"
        class="cc-session-title__input"
        maxlength="50"
        spellcheck="false"
        aria-label="会话标题"
        @keydown="onKeydown"
        @blur="commitEdit"
      />
      <button type="button" class="cc-session-title__action" aria-label="保存标题" @mousedown.prevent @click="commitEdit">
        <Check class="h-3.5 w-3.5" />
      </button>
      <button type="button" class="cc-session-title__action" aria-label="取消编辑" @mousedown.prevent @click="cancelEdit">
        <X class="h-3.5 w-3.5" />
      </button>
    </div>
    <div v-else class="cc-session-title__view">
      <h1 class="cc-session-title__text">{{ displayTitle }}</h1>
      <button
        v-if="editable"
        type="button"
        class="cc-session-title__edit-btn"
        aria-label="编辑会话标题"
        @click="startEdit"
      >
        <Pencil class="h-3 w-3" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.cc-session-title {
  min-width: 0;
  flex: 1;
}

.cc-session-title__view,
.cc-session-title__edit {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}

.cc-session-title__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.cc-session-title__edit-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  padding: 0.1875rem;
  color: var(--color-muted);
  opacity: 0;
  transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.cc-session-title:hover .cc-session-title__edit-btn,
.cc-session-title__edit-btn:focus-visible {
  opacity: 1;
}

.cc-session-title__edit-btn:hover {
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
  color: var(--color-text);
}

.cc-session-title__input {
  min-width: 0;
  flex: 1;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.25rem 0.5rem;
  font-size: 0.8125rem;
  outline: none;
}

.cc-session-title__input:focus {
  border-color: var(--color-link);
}

.cc-session-title__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  padding: 0.25rem;
  color: var(--color-muted);
}

.cc-session-title__action:hover {
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
  color: var(--color-text);
}
</style>
