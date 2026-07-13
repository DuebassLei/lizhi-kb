<script setup lang="ts">
import { Cpu, Search, Settings2 } from "@lucide/vue";
import type { AiSettingsTab } from "../../../composables/useAiSettings";

defineProps<{
  current: AiSettingsTab;
}>();

const emit = defineEmits<{
  change: [tab: AiSettingsTab];
}>();

const items: { key: AiSettingsTab; label: string; icon: typeof Settings2 }[] = [
  { key: "basic", label: "基础", icon: Settings2 },
  { key: "models", label: "模型", icon: Cpu },
  { key: "knowledge", label: "知识库", icon: Search },
];
</script>

<template>
  <nav class="ai-settings-sidebar" aria-label="AI 助手设置导航">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="ai-settings-sidebar__item"
      :class="{ 'ai-settings-sidebar__item--active': current === item.key }"
      :data-testid="`ai-settings-tab-${item.key}`"
      @click="emit('change', item.key)"
    >
      <component :is="item.icon" class="h-4 w-4 shrink-0" />
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.ai-settings-sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 7.5rem;
  shrink: 0;
  padding: 0.75rem 0.5rem;
  border-right: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 35%, transparent);
}

.ai-settings-sidebar__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.75rem;
  color: var(--color-muted);
  text-align: left;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.ai-settings-sidebar__item:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.ai-settings-sidebar__item--active {
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
  font-weight: 500;
}
</style>
