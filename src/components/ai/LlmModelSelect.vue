<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Check, ChevronDown, Cloud, Cpu, Search } from "@lucide/vue";
import type { LlmOption, LlmTarget } from "../../services/aiService";
import { LLM_RETRIEVAL_TARGET } from "../../services/aiService";

const props = defineProps<{
  options: LlmOption[];
  disabled?: boolean;
  testId?: string;
}>();

const model = defineModel<LlmTarget>({ required: true });

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const current = computed(
  () => props.options.find((o) => o.id === model.value) ?? props.options[0],
);

const canSwitch = computed(() => props.options.length > 1 && !props.disabled);

function parseLabel(label: string): { title: string; subtitle: string } {
  const sep = label.indexOf(" · ");
  if (sep === -1) return { title: label, subtitle: "" };
  return { title: label.slice(0, sep), subtitle: label.slice(sep + 3) };
}

const isLocal = computed(() => model.value === "local");
const isRetrieval = computed(() => model.value === LLM_RETRIEVAL_TARGET);

function optionIconClass(id: LlmTarget): string {
  if (id === LLM_RETRIEVAL_TARGET) return "bg-emerald-500/15 text-emerald-400";
  if (id === "local") return "bg-link/15 text-link";
  return "bg-amber-500/15 text-amber-400";
}

function toggle() {
  if (!canSwitch.value) return;
  open.value = !open.value;
}

function close() {
  if (!open.value) return;
  open.value = false;
}

function selectOption(id: LlmTarget) {
  model.value = id;
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
  <div
    ref="rootRef"
    class="flex items-center gap-2"
    :data-testid="testId ?? 'chat-llm-select'"
  >
    <span class="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted">
      模型
    </span>

    <div class="relative min-w-0 flex-1">
      <button
        type="button"
        class="focus-ring flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-1 px-2.5 text-left transition-colors"
        :class="
          canSwitch
            ? 'cursor-pointer hover:border-link/30 hover:bg-surface-2'
            : 'cursor-default'
        "
        :aria-expanded="open"
        :aria-haspopup="canSwitch ? 'listbox' : undefined"
        :disabled="disabled && !canSwitch"
        :title="current?.description"
        @click.stop="toggle"
      >
        <span
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
          :class="optionIconClass(model)"
          aria-hidden="true"
        >
          <Search v-if="isRetrieval" class="h-3 w-3" />
          <Cpu v-else-if="isLocal" class="h-3 w-3" />
          <Cloud v-else class="h-3 w-3" />
        </span>

        <span class="min-w-0 flex-1 truncate text-xs font-medium text-[var(--color-text)]">
          {{ current?.label ?? "本地模型" }}
        </span>

        <ChevronDown
          v-if="canSwitch"
          class="h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-150"
          :class="open ? 'rotate-180' : ''"
          aria-hidden="true"
        />
      </button>

      <div
        v-if="open && canSwitch"
        class="scrollbar-thin absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface-1 p-1"
        :style="{ boxShadow: 'var(--shadow-float)' }"
        role="listbox"
        aria-label="选择模型"
        data-testid="chat-llm-select-panel"
        @click.stop
      >
        <button
          v-for="opt in options"
          :key="opt.id"
          type="button"
          role="option"
          class="focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
          :class="opt.id === model ? 'bg-link/10' : ''"
          :aria-selected="opt.id === model"
          :title="opt.description"
          :data-testid="`chat-llm-option-${opt.id}`"
          @click="selectOption(opt.id)"
        >
          <span
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
            :class="optionIconClass(opt.id)"
            aria-hidden="true"
          >
            <Search v-if="opt.id === LLM_RETRIEVAL_TARGET" class="h-3 w-3" />
            <Cpu v-else-if="opt.id === 'local'" class="h-3 w-3" />
            <Cloud v-else class="h-3 w-3" />
          </span>

          <span class="min-w-0 flex-1 leading-tight">
            <span
              class="block truncate text-xs"
              :class="opt.id === model ? 'font-medium text-[var(--color-text)]' : 'text-muted'"
            >
              {{ parseLabel(opt.label).title }}
            </span>
            <span
              v-if="parseLabel(opt.label).subtitle"
              class="block truncate text-[10px] text-muted"
            >
              {{ parseLabel(opt.label).subtitle }}
            </span>
          </span>

          <Check
            v-if="opt.id === model"
            class="h-3.5 w-3.5 shrink-0 text-link"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  </div>
</template>
