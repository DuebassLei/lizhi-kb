<script setup lang="ts">
import { computed, ref } from "vue";
import { Circle, CheckCircle2, PauseCircle, PlayCircle } from "@lucide/vue";
import type { Requirement, RequirementStatus } from "../../types/requirement";
import { STATUS_LABELS, STATUS_THEME } from "../../types/requirement";
import RequirementCard from "./RequirementCard.vue";

const STATUS_ICONS = {
  todo: Circle,
  in_progress: PlayCircle,
  suspended: PauseCircle,
  done: CheckCircle2,
} as const;

const props = defineProps<{
  status: RequirementStatus;
  items: Requirement[];
  selectedId: string | null;
  draggingId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
  drop: [status: RequirementStatus];
  dragstart: [id: string];
  dragend: [];
}>();

const dragOver = ref(false);
const theme = computed(() => STATUS_THEME[props.status]);

function onDragOver(e: DragEvent) {
  e.preventDefault();
  dragOver.value = true;
}

function onDragLeave() {
  dragOver.value = false;
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  dragOver.value = false;
  emit("drop", props.status);
}
</script>

<template>
  <section
    class="flex min-h-[min(420px,50vh)] min-w-[240px] max-w-[320px] flex-1 flex-col rounded-xl border shadow-sm transition-[colors,box-shadow,transform] duration-200"
    :class="[
      theme.bg,
      theme.accent,
      dragOver ? `${theme.dragOver} scale-[1.01]` : 'border-border/70',
    ]"
    :aria-label="`${STATUS_LABELS[status]}列`"
    data-testid="kanban-column"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <header
      class="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 px-3 py-2.5 backdrop-blur-sm"
      :class="theme.headerBg"
    >
      <h2
        class="flex items-center gap-1.5 text-xs font-semibold tracking-wide"
        :class="theme.header"
      >
        <component
          :is="STATUS_ICONS[status]"
          class="h-3.5 w-3.5 shrink-0 opacity-90"
          aria-hidden="true"
        />
        {{ STATUS_LABELS[status] }}
      </h2>
      <span
        class="rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
        :class="theme.countBadge"
      >
        {{ items.length }}
      </span>
    </header>

    <div class="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
      <RequirementCard
        v-for="item in items"
        :key="item.id"
        :requirement="item"
        :selected="selectedId === item.id"
        :class="draggingId === item.id ? 'opacity-60' : ''"
        @click="emit('select', item.id)"
        @dragstart="emit('dragstart', item.id)"
        @dragend="emit('dragend')"
      />

      <div
        v-if="items.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-10 text-center text-xs"
        :class="[theme.header, 'border-current/20 bg-surface-0/25']"
      >
        <component :is="STATUS_ICONS[status]" class="h-5 w-5 opacity-40" aria-hidden="true" />
        <span>拖入卡片至此列</span>
      </div>
    </div>
  </section>
</template>
