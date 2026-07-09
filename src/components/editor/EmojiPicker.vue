<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { Smile } from "@lucide/vue";
import { EMOJI_GROUPS } from "../../constants/commonEmojis";
import BtnIcon from "../ui/BtnIcon.vue";

const emit = defineEmits<{
  select: [emoji: string];
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function close() {
  if (!open.value) return;
  open.value = false;
}

function insert(emoji: string) {
  emit("select", emoji);
  close();
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return;
  const root = rootRef.value;
  if (root && !root.contains(e.target as Node)) close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) {
    e.preventDefault();
    close();
  }
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
      label="插入表情"
      :pressed="open"
      :aria-expanded="open"
      aria-haspopup="dialog"
      data-testid="toolbar-insert-emoji"
      @click.stop="toggle"
    >
      <Smile class="h-3.5 w-3.5" aria-hidden="true" />
    </BtnIcon>

    <div
      v-if="open"
      class="scrollbar-thin absolute left-0 top-full z-50 mt-1 w-[212px] max-h-[280px] overflow-y-auto rounded-lg border border-border bg-surface-1 p-1.5"
      :style="{ boxShadow: 'var(--shadow-float)' }"
      role="dialog"
      aria-label="选择表情"
      data-testid="emoji-picker"
      @click.stop
    >
      <div class="grid grid-cols-8 gap-0.5">
        <template v-for="group in EMOJI_GROUPS" :key="group.label">
          <div
            class="col-span-8 px-0.5 pt-1.5 pb-0.5 text-[10px] font-medium text-text-muted first:pt-0"
          >
            {{ group.label }}
          </div>
          <button
            v-for="emoji in group.emojis"
            :key="`${group.label}-${emoji}`"
            type="button"
            class="focus-ring flex h-7 w-7 items-center justify-center rounded-md text-base transition-colors hover:bg-surface-2"
            :aria-label="`插入 ${emoji}`"
            :data-testid="`emoji-${emoji}`"
            @click="insert(emoji)"
          >
            {{ emoji }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
