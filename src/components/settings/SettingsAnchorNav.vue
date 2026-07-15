<script setup lang="ts">
import { ListTree } from "@lucide/vue";
import type { SettingsSection } from "../../constants/settingsSections";

defineProps<{
  sections: SettingsSection[];
  activeId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();
</script>

<template>
  <aside
    class="settings-anchor-nav hidden w-44 shrink-0 self-stretch min-h-0 border-l border-border lg:block"
    style="background: color-mix(in srgb, var(--color-surface-1) 35%, transparent)"
    data-testid="settings-anchor-nav"
  >
    <nav class="sticky top-0 px-3 py-6" aria-label="设置目录">
      <div class="mb-3 flex items-center gap-1.5 px-2">
        <ListTree class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        <span class="text-[11px] font-semibold text-text-secondary">目录</span>
      </div>

      <ul class="space-y-0.5">
        <li v-for="section in sections" :key="section.id">
          <button
            type="button"
            class="settings-nav__item focus-ring"
            :class="{ 'settings-nav__item--active': activeId === section.id }"
            :aria-current="activeId === section.id ? 'location' : undefined"
            :data-testid="`settings-anchor-${section.id}`"
            @click="emit('select', section.id)"
          >
            {{ section.label }}
          </button>
        </li>
      </ul>
    </nav>
  </aside>
</template>
