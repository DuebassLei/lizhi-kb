<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Bot } from "@lucide/vue";

import type { CcCompletionItem, CcCompletionKind } from "../../../composables/cc/useCcInputCompletions";
const props = defineProps<{
  open: boolean;
  kind: CcCompletionKind | null;
  items: CcCompletionItem[];
  activeIndex: number;
  loading?: boolean;
  anchorEl?: HTMLElement | null;
}>();

const emit = defineEmits<{
  select: [item: CcCompletionItem];
}>();

const kindLabel: Record<CcCompletionKind, string> = {
  file: "引用文件",
  agent: "唤起智能体",
  prompt: "插入提示词",
  slash: "命令",
};

const dropdownStyle = ref<Record<string, string>>({});
const DROPDOWN_WIDTH = 320;
const DROPDOWN_MAX_HEIGHT = 300;
const EDGE_PADDING = 8;

function updatePosition() {
  const anchor = props.anchorEl;
  if (!anchor || !props.open) return;
  const rect = anchor.getBoundingClientRect();
  let left = rect.left;
  if (left + DROPDOWN_WIDTH + EDGE_PADDING > window.innerWidth) {
    left = window.innerWidth - DROPDOWN_WIDTH - EDGE_PADDING;
  }
  if (left < EDGE_PADDING) left = EDGE_PADDING;

  const bottom = window.innerHeight - rect.top + 6;
  dropdownStyle.value = {
    position: "fixed",
    left: `${left}px`,
    bottom: `${bottom}px`,
    width: `${DROPDOWN_WIDTH}px`,
    maxHeight: `${DROPDOWN_MAX_HEIGHT}px`,
    zIndex: "10050",
  };
}

watch(
  () => [props.open, props.anchorEl, props.items.length, props.loading] as const,
  () => {
    if (props.open) updatePosition();
  },
  { flush: "post" },
);

function onViewportChange() {
  if (props.open) updatePosition();
}

onMounted(() => {
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("scroll", onViewportChange, true);
});

onUnmounted(() => {
  window.removeEventListener("resize", onViewportChange);
  window.removeEventListener("scroll", onViewportChange, true);
});

const showPanel = computed(() => props.open && Boolean(props.anchorEl));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showPanel"
      class="cc-input-dropdown"
      data-testid="cc-input-dropdown"
      :style="dropdownStyle"
    >
      <p class="cc-input-dropdown__title">
        {{ kind ? kindLabel[kind] : "建议" }}
        <span v-if="loading" class="cc-input-dropdown__loading">加载中…</span>
      </p>
      <ul v-if="items.length" class="cc-input-dropdown__list">
        <li v-for="(item, index) in items" :key="item.id">
          <button
            type="button"
            class="cc-input-dropdown__item"
            :class="{ 'cc-input-dropdown__item--active': index === activeIndex }"
            @mousedown.prevent
            @click="emit('select', item)"
          >
            <span class="cc-input-dropdown__label">
              <Bot v-if="item.kind === 'agent'" class="cc-input-dropdown__kind-icon" />
              {{ item.label }}
            </span>
            <span v-if="item.description" class="cc-input-dropdown__desc">{{ item.description }}</span>
          </button>
        </li>
      </ul>
      <p v-else-if="loading" class="cc-input-dropdown__empty">正在加载命令…</p>
      <p v-else class="cc-input-dropdown__empty">无匹配项</p>
    </div>
  </Teleport>
</template>

<style scoped>
.cc-input-dropdown {
  overflow: auto;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 8px 24px color-mix(in srgb, black 18%, transparent);
}

.cc-input-dropdown__title {
  position: sticky;
  top: 0;
  z-index: 1;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: var(--color-surface-0);
  padding: 0.4375rem 0.625rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-input-dropdown__loading {
  margin-left: 0.375rem;
}

.cc-input-dropdown__list {
  list-style: none;
  margin: 0;
  padding: 0.25rem;
}

.cc-input-dropdown__item {
  display: flex;
  width: 100%;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  border-radius: 0.375rem;
  padding: 0.4375rem 0.5rem;
  text-align: left;
}

.cc-input-dropdown__item:hover,
.cc-input-dropdown__item--active {
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
}

.cc-input-dropdown__label {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--color-text);
  white-space: nowrap;
}

.cc-input-dropdown__kind-icon {
  height: 0.75rem;
  width: 0.75rem;
  color: #7c3aed;
}

.cc-input-dropdown__desc {
  min-width: 0;
  flex: 1;
  font-size: 0.625rem;
  color: var(--color-muted);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl;
}

.cc-input-dropdown__empty {
  padding: 0.625rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}
</style>
