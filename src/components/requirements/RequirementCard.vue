<script setup lang="ts">

import { computed } from "vue";

import { CalendarClock } from "@lucide/vue";

import type { Requirement } from "../../types/requirement";

import {

  formatDueHint,

  getRequirementDisplayTitle,

  isRequirementOverdue,

  PRIORITY_LABELS,

  PRIORITY_THEME,

} from "../../types/requirement";



const props = defineProps<{

  requirement: Requirement;

  selected?: boolean;

}>();



defineEmits<{

  click: [];

  dragstart: [event: DragEvent];

  dragend: [];

}>();



const title = computed(() => getRequirementDisplayTitle(props.requirement));



const isDone = computed(() => props.requirement.status === "done");



const isOverdue = computed(() => isRequirementOverdue(props.requirement));



const dueHint = computed(() => formatDueHint(props.requirement.dueAt));



const priorityBorder = computed(() =>

  props.requirement.priority

    ? PRIORITY_THEME[props.requirement.priority].border

    : "border-l-transparent",

);



const priorityPill = computed(() =>

  props.requirement.priority

    ? PRIORITY_THEME[props.requirement.priority].pill

    : "",

);



function formatTime(ts: number): string {

  return new Date(ts).toLocaleDateString("zh-CN", {

    month: "short",

    day: "numeric",

    hour: "2-digit",

    minute: "2-digit",

  });

}

</script>



<template>

  <article

    draggable="true"

    data-testid="requirement-card"

    class="focus-ring group cursor-grab rounded-lg border border-border bg-surface-1 p-3 text-left transition-[box-shadow,opacity,transform] duration-200 active:cursor-grabbing active:scale-[0.98]"

    :class="[

      priorityBorder,

      'border-l-[3px]',

      isDone ? 'opacity-70 saturate-[0.85]' : '',

      selected

        ? 'ring-2 ring-paw/50 shadow-md'

        : 'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',

    ]"

    tabindex="0"

    role="button"

    :aria-label="`${requirement.number} ${title}`"

    @click="$emit('click')"

    @keydown.enter="$emit('click')"

    @dragstart="$emit('dragstart', $event)"

    @dragend="$emit('dragend')"

  >

    <div class="mb-1.5 flex items-start justify-between gap-2">

      <span class="font-mono text-[10px] text-muted">{{ requirement.number }}</span>

      <span

        v-if="requirement.priority"

        class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"

        :class="priorityPill"

      >

        {{ PRIORITY_LABELS[requirement.priority] }}

      </span>

    </div>



    <p

      class="line-clamp-2 text-sm leading-snug"

      :class="isDone ? 'text-muted line-through decoration-muted/50' : 'text-[var(--color-text)]'"

    >

      {{ title }}

    </p>



    <div class="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">

      <p v-if="requirement.owner" class="text-[10px] text-muted">负责人 {{ requirement.owner }}</p>

      <p class="text-[10px] text-muted">更新 {{ formatTime(requirement.updatedAt) }}</p>

      <span

        v-if="dueHint && !isDone"

        class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"

        :class="

          isOverdue

            ? 'bg-danger/12 text-danger border border-danger/25'

            : 'bg-surface-2 text-muted border border-border/60'

        "

      >

        <CalendarClock class="h-2.5 w-2.5 shrink-0" aria-hidden="true" />

        {{ dueHint }}

      </span>

    </div>

  </article>

</template>

