<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import {
  Check,
  ChevronDown,
  Cloud,
  Cpu,
  Plus,
  Search,
  Sparkles,
  Zap,
} from "@lucide/vue";
import type { LlmOption, LlmOptionGroup, LlmTarget } from "../../services/aiService";
import {
  LLM_AUTO_TARGET,
  LLM_RETRIEVAL_TARGET,
  llmOptionGroupLabel,
  llmTriggerParts,
  llmTriggerTitle,
} from "../../services/aiService";
import type { AiConfigPublic } from "../../services/aiService";

const PANEL_WIDTH = 288;
const PANEL_GAP = 8;

const props = withDefaults(
  defineProps<{
    options: LlmOption[];
    config?: AiConfigPublic | null;
    disabled?: boolean;
    testId?: string;
    placement?: "top" | "bottom";
  }>(),
  {
    placement: "top",
  },
);

const model = defineModel<LlmTarget>({ required: true });

const emit = defineEmits<{
  configure: [];
}>();
const open = ref(false);
const query = ref("");
const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const searchRef = ref<HTMLInputElement | null>(null);
const panelStyle = ref<Record<string, string>>({});

const canSwitch = computed(() => props.options.length > 1 && !props.disabled);

const triggerParts = computed(() =>
  llmTriggerParts(model.value, props.options, props.config ?? null),
);

const triggerTooltip = computed(() =>
  llmTriggerTitle(model.value, props.options, props.config ?? null),
);

const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter((opt) => {
    const haystack = [
      opt.label,
      opt.shortLabel,
      opt.description,
      opt.badge ?? "",
      opt.keywords,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
});

const groupedOptions = computed(() => {
  const groups: LlmOptionGroup[] = ["smart", "local", "cloud"];
  return groups
    .map((group) => ({
      group,
      label: llmOptionGroupLabel(group),
      items: filteredOptions.value.filter((o) => o.group === group),
    }))
    .filter((section) => section.items.length > 0);
});

function optionIconClass(id: LlmTarget): string {
  if (id === LLM_RETRIEVAL_TARGET) return "llm-option-icon llm-option-icon--retrieval";
  if (id === LLM_AUTO_TARGET) return "llm-option-icon llm-option-icon--auto";
  if (id === "local") return "llm-option-icon llm-option-icon--local";
  return "llm-option-icon llm-option-icon--cloud";
}

function updatePanelPosition() {
  const trigger = triggerRef.value;
  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  const maxLeft = window.innerWidth - PANEL_WIDTH - PANEL_GAP;
  const left = Math.max(PANEL_GAP, Math.min(rect.left, maxLeft));

  if (props.placement === "top") {
    panelStyle.value = {
      left: `${left}px`,
      bottom: `${window.innerHeight - rect.top + PANEL_GAP}px`,
      width: `${PANEL_WIDTH}px`,
    };
    return;
  }

  panelStyle.value = {
    left: `${left}px`,
    top: `${rect.bottom + PANEL_GAP}px`,
    width: `${PANEL_WIDTH}px`,
  };
}

function toggle() {
  if (!canSwitch.value) return;
  open.value = !open.value;
}

function close() {
  if (!open.value) return;
  open.value = false;
  query.value = "";
}

function selectOption(id: LlmTarget) {
  model.value = id;
  close();
}

function openConfigure() {
  close();
  emit("configure");
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

function bindRepositionListeners() {
  window.addEventListener("resize", updatePanelPosition);
  window.addEventListener("scroll", updatePanelPosition, true);
}

function unbindRepositionListeners() {
  window.removeEventListener("resize", updatePanelPosition);
  window.removeEventListener("scroll", updatePanelPosition, true);
}

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    updatePanelPosition();
    bindRepositionListeners();
    requestAnimationFrame(() => searchRef.value?.focus());
    return;
  }
  unbindRepositionListeners();
});

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
  unbindRepositionListeners();
});
</script>

<template>
  <div
    ref="rootRef"
    class="llm-model-select"
    :data-testid="testId ?? 'chat-llm-select'"
  >
    <button
      ref="triggerRef"
      type="button"
      class="llm-model-select__trigger focus-ring"
      :class="{
        'llm-model-select__trigger--open': open,
        'llm-model-select__trigger--disabled': disabled && !canSwitch,
      }"
      :aria-expanded="open"
      :aria-haspopup="canSwitch ? 'listbox' : undefined"
      :disabled="disabled && !canSwitch"
      :title="triggerTooltip"
      data-testid="chat-llm-select-trigger"
      @click.stop="toggle"
    >
      <span class="llm-model-select__trigger-icon" aria-hidden="true">
        <Sparkles v-if="model === LLM_AUTO_TARGET" class="h-3.5 w-3.5 text-violet-400" />
        <Search v-else-if="model === LLM_RETRIEVAL_TARGET" class="h-3.5 w-3.5 text-emerald-400" />
        <Cpu v-else-if="model === 'local'" class="h-3.5 w-3.5 text-link" />
        <Cloud v-else class="h-3.5 w-3.5 text-amber-400" />
      </span>

      <span class="llm-model-select__trigger-text">
        {{ triggerParts.primary }}
      </span>

      <ChevronDown
        v-if="canSwitch"
        class="llm-model-select__chevron"
        :class="{ 'llm-model-select__chevron--open': open }"
        aria-hidden="true"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="open && canSwitch"
        class="llm-model-select__panel"
        :style="panelStyle"
        role="listbox"
        aria-label="选择模型"
        data-testid="chat-llm-select-panel"
        @click.stop
      >
        <div class="llm-model-select__search-wrap">
          <Search class="llm-model-select__search-icon" aria-hidden="true" />
          <input
            ref="searchRef"
            v-model="query"
            type="search"
            placeholder="搜索模型…"
            class="llm-model-select__search focus-ring"
            data-testid="chat-llm-select-search"
          />
        </div>

        <div class="llm-model-select__list scrollbar-thin">
          <template v-if="groupedOptions.length">
            <section
              v-for="section in groupedOptions"
              :key="section.group"
              class="llm-model-select__section"
            >
              <p class="llm-model-select__section-label">
                {{ section.label }}
              </p>

              <button
                v-for="opt in section.items"
                :key="opt.id"
                type="button"
                role="option"
                class="llm-model-select__option focus-ring"
                :class="{ 'llm-model-select__option--active': opt.id === model }"
                :aria-selected="opt.id === model"
                :title="opt.description"
                :data-testid="`chat-llm-option-${opt.id}`"
                @click="selectOption(opt.id)"
              >
                <span :class="optionIconClass(opt.id)" aria-hidden="true">
                  <Zap v-if="opt.id === LLM_AUTO_TARGET" class="h-3.5 w-3.5" />
                  <Search v-else-if="opt.id === LLM_RETRIEVAL_TARGET" class="h-3.5 w-3.5" />
                  <Cpu v-else-if="opt.id === 'local'" class="h-3.5 w-3.5" />
                  <Cloud v-else class="h-3.5 w-3.5" />
                </span>

                <span class="llm-model-select__option-body">
                  <span class="llm-model-select__option-row">
                    <span class="llm-model-select__option-title">
                      {{ opt.group === "cloud" ? opt.shortLabel : opt.label }}
                    </span>
                    <span
                      v-if="opt.badge"
                      class="llm-model-select__badge"
                      :class="`llm-model-select__badge--${opt.group === 'smart' ? (opt.id === LLM_RETRIEVAL_TARGET ? 'retrieval' : 'auto') : opt.group}`"
                    >
                      {{ opt.badge }}
                    </span>
                  </span>
                  <span
                    v-if="opt.group === 'cloud' || opt.description"
                    class="llm-model-select__option-sub"
                  >
                    {{ opt.group === "cloud" ? opt.label : opt.description }}
                  </span>
                </span>

                <Check
                  v-if="opt.id === model"
                  class="llm-model-select__check"
                  aria-hidden="true"
                />
              </button>
            </section>
          </template>

          <p
            v-else
            class="llm-model-select__empty"
            data-testid="chat-llm-select-empty"
          >
            没有匹配的模型
          </p>
        </div>

        <div class="llm-model-select__footer">
          <button
            type="button"
            class="llm-model-select__add focus-ring"
            data-testid="chat-llm-add-models"
            @click="openConfigure"
          >
            <Plus class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            添加模型
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.llm-model-select {
  position: relative;
  display: inline-flex;
  min-width: 0;
  max-width: min(100%, 14rem);
}

.llm-model-select__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  max-width: 100%;
  height: 1.75rem;
  padding: 0 0.625rem;
  border: 0;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--color-surface-2) 72%, transparent);
  color: var(--color-text);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    box-shadow 150ms ease,
    color 150ms ease;
}

.llm-model-select__trigger:hover:not(:disabled) {
  background: var(--color-surface-2);
}

.llm-model-select__trigger--open {
  background: color-mix(in srgb, var(--color-link) 12%, var(--color-surface-2));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 28%, transparent);
}

.llm-model-select__trigger--disabled {
  cursor: default;
  opacity: 0.55;
}

.llm-model-select__trigger-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.llm-model-select__trigger-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
}

.llm-model-select__chevron {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  color: var(--color-muted);
  transition: transform 150ms ease;
}

.llm-model-select__chevron--open {
  transform: rotate(180deg);
}

.llm-model-select__panel {
  position: fixed;
  z-index: 400;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-border) 88%, white 4%);
  border-radius: 0.875rem;
  background: color-mix(in srgb, var(--color-surface-1) 96%, var(--color-surface-0));
  box-shadow:
    var(--shadow-float),
    0 0 0 1px color-mix(in srgb, var(--color-link) 6%, transparent);
  backdrop-filter: blur(12px);
}

.llm-model-select__search-wrap {
  position: relative;
  border-bottom: 1px solid var(--color-divider);
  padding: 0.625rem;
}

.llm-model-select__search-icon {
  pointer-events: none;
  position: absolute;
  left: 1.125rem;
  top: 50%;
  width: 0.875rem;
  height: 0.875rem;
  transform: translateY(-50%);
  color: var(--color-muted);
}

.llm-model-select__search {
  width: 100%;
  height: 2rem;
  padding: 0 0.75rem 0 2rem;
  border: 1px solid var(--color-border);
  border-radius: 0.625rem;
  background: var(--color-surface-0);
  font-size: 0.75rem;
  color: var(--color-text);
}

.llm-model-select__search::placeholder {
  color: var(--color-muted);
}

.llm-model-select__list {
  max-height: 18rem;
  overflow-y: auto;
  padding: 0.375rem;
}

.llm-model-select__section + .llm-model-select__section {
  margin-top: 0.25rem;
}

.llm-model-select__section-label {
  padding: 0.375rem 0.5rem 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.llm-model-select__option {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem;
  border: 0;
  border-radius: 0.625rem;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.llm-model-select__option:hover {
  background: var(--color-surface-2);
}

.llm-model-select__option--active {
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
}

.llm-option-icon {
  display: inline-flex;
  width: 1.625rem;
  height: 1.625rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
}

.llm-option-icon--auto {
  background: rgb(139 92 246 / 0.14);
  color: rgb(167 139 250);
}

.llm-option-icon--retrieval {
  background: rgb(16 185 129 / 0.14);
  color: rgb(52 211 153);
}

.llm-option-icon--local {
  background: color-mix(in srgb, var(--color-link) 14%, transparent);
  color: var(--color-link);
}

.llm-option-icon--cloud {
  background: rgb(245 158 11 / 0.14);
  color: rgb(251 191 36);
}

.llm-model-select__option-body {
  min-width: 0;
  flex: 1;
}

.llm-model-select__option-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.llm-model-select__option-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text);
}

.llm-model-select__option-sub {
  display: block;
  margin-top: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.llm-model-select__badge {
  flex-shrink: 0;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  font-size: 0.625rem;
  line-height: 1.2;
}

.llm-model-select__badge--auto {
  background: rgb(139 92 246 / 0.12);
  color: rgb(196 181 253);
}

.llm-model-select__badge--retrieval {
  background: rgb(16 185 129 / 0.12);
  color: rgb(110 231 183);
}

.llm-model-select__badge--local {
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
}

.llm-model-select__badge--cloud {
  background: rgb(245 158 11 / 0.12);
  color: rgb(252 211 77);
}

.llm-model-select__check {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  color: var(--color-link);
}

.llm-model-select__empty {
  padding: 1.5rem 0.75rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.llm-model-select__footer {
  border-top: 1px solid var(--color-divider);
  padding: 0.375rem;
}

.llm-model-select__add {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border: 0;
  border-radius: 0.625rem;
  background: transparent;
  font-size: 0.75rem;
  color: var(--color-muted);
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.llm-model-select__add:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}
</style>
