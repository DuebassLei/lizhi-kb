<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { Download } from "@lucide/vue";
import { EXPORT_FORMATS, exportDocument, type ExportFormat } from "../../utils/exportFile";
import BtnIcon from "../ui/BtnIcon.vue";

const props = defineProps<{
  title: string;
  content: string;
  disabled?: boolean;
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function pick(format: ExportFormat) {
  void exportDocument(props.title, props.content, format);
  close();
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return;
  const root = rootRef.value;
  if (root && !root.contains(e.target as Node)) close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) close();
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div ref="rootRef" class="relative">
    <BtnIcon
      label="导出"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="menu"
      data-testid="export-menu-trigger"
      @click.stop="toggle"
    >
      <Download class="h-3.5 w-3.5" aria-hidden="true" />
    </BtnIcon>

    <div
      v-if="open"
      class="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-border bg-surface-1 py-1 shadow-2xl"
      role="menu"
      aria-label="导出格式"
      data-testid="export-menu"
      @click.stop
    >
      <button
        v-for="item in EXPORT_FORMATS"
        :key="item.id"
        type="button"
        role="menuitem"
        class="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-[var(--color-text)] hover:bg-surface-2"
        :data-testid="`export-format-${item.id}`"
        @click="pick(item.id)"
      >
        <span>{{ item.label }}</span>
        <span class="ml-3 text-[10px] text-muted">{{ item.hint }}</span>
      </button>
    </div>
  </div>
</template>
