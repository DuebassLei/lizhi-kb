<script setup lang="ts">
import {
  BookOpen,
  Bot,
  Cpu,
  FileText,
  FolderTree,
  MessageSquareText,
  Plug,
  Server,
  Settings2,
  Zap,
} from "@lucide/vue";

export type CcSettingsTab = "basic" | "providers" | "runtime" | "cwd" | "agents" | "skills" | "prompts" | "mcp" | "hooks" | "claude-md";

const props = defineProps<{
  current: CcSettingsTab;
}>();

const emit = defineEmits<{
  change: [tab: CcSettingsTab];
}>();

const items: { key: CcSettingsTab; label: string; icon: typeof Settings2 }[] = [
  { key: "basic", label: "基础", icon: Settings2 },
  { key: "providers", label: "供应商", icon: Plug },
  { key: "runtime", label: "SDK 依赖", icon: Cpu },
  { key: "cwd", label: "工作目录", icon: FolderTree },
  { key: "agents", label: "Agents", icon: Bot },
  { key: "skills", label: "Skills", icon: BookOpen },
  { key: "prompts", label: "提示词库", icon: MessageSquareText },
  { key: "mcp", label: "MCP 服务器", icon: Server },
  { key: "hooks", label: "Hooks", icon: Zap },
  { key: "claude-md", label: "CLAUDE.md", icon: FileText },
];
</script>

<template>
  <nav class="cc-settings-sidebar" aria-label="工作台设置导航">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="cc-settings-sidebar__item"
      :class="{ 'cc-settings-sidebar__item--active': props.current === item.key }"
      @click="emit('change', item.key)"
    >
      <component :is="item.icon" class="h-4 w-4 shrink-0" />
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.cc-settings-sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 7.5rem;
  shrink: 0;
  padding: 0.75rem 0.5rem;
  border-right: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 35%, transparent);
}

.cc-settings-sidebar__item {
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

.cc-settings-sidebar__item:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.cc-settings-sidebar__item--active {
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
  font-weight: 500;
}
</style>
