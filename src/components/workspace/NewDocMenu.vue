<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { ChevronDown, Plus } from "@lucide/vue";
import { storeToRefs } from "pinia";
import { useDocumentTemplatesStore } from "../../stores/documentTemplates";

const emit = defineEmits<{
  create: [templateId: string];
}>();

defineProps<{
  disabled?: boolean;
  busy?: boolean;
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

function close() {
  open.value = false;
}

const tplStore = useDocumentTemplatesStore();
const { templates } = storeToRefs(tplStore);

function pick(templateId: string) {
  emit("create", templateId);
  close();
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value) return;
  const root = rootRef.value;
  if (root && !root.contains(event.target as Node)) close();
}

onMounted(() => document.addEventListener("click", onDocumentClick));
onUnmounted(() => document.removeEventListener("click", onDocumentClick));
</script>

<template>
  <div ref="rootRef" class="relative flex gap-1">
    <button
      type="button"
      data-testid="new-doc-btn"
      class="focus-ring flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-paw/15 px-2 py-1.5 text-left text-xs text-paw transition-colors hover:bg-paw/25 disabled:opacity-50"
      :disabled="disabled"
      :aria-busy="busy"
      aria-label="新建文档"
      @click="pick(tplStore.primaryTemplateId())"
    >
      <Plus :size="12" aria-hidden="true" />
      <span>{{ busy ? "创建中…" : "新建文档" }}</span>
    </button>

    <button
      type="button"
      class="focus-ring shrink-0 rounded-md border border-border bg-surface-1 px-1.5 py-1.5 text-paw hover:bg-surface-2 disabled:opacity-50"
      :disabled="disabled"
      aria-label="选择文档模板"
      aria-haspopup="menu"
      :aria-expanded="open"
      data-testid="new-doc-template-trigger"
      @click.stop="open = !open"
    >
      <ChevronDown class="h-3.5 w-3.5" aria-hidden="true" />
    </button>

    <div
      v-if="open"
      class="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-surface-1 py-1 shadow-2xl"
      role="menu"
      aria-label="文档模板"
      data-testid="new-doc-template-menu"
      @click.stop
    >
      <button
        v-for="template in templates"
        :key="template.id"
        type="button"
        role="menuitem"
        class="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-surface-2"
        :data-testid="`new-doc-template-${template.id}`"
        @click="pick(template.id)"
      >
        <span class="text-xs font-medium text-[var(--color-text)]">{{ template.label }}</span>
        <span class="text-[10px] text-muted">{{ template.description }}</span>
      </button>
    </div>
  </div>
</template>
