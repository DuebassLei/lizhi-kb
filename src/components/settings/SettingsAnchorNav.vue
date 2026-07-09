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
    class="settings-anchor-nav hidden w-44 shrink-0 border-l border-border bg-surface-0 lg:block"
    data-testid="settings-anchor-nav"
  >
    <nav class="sticky top-0 max-h-full overflow-y-auto px-3 py-6" aria-label="设置目录">
      <div class="mb-3 flex items-center gap-1.5 px-2">
        <ListTree class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        <span class="text-[11px] font-semibold tracking-wide text-text-secondary">目录</span>
      </div>

      <ul class="space-y-0.5">
        <li v-for="section in sections" :key="section.id">
          <button
            type="button"
            class="settings-anchor-nav__item focus-ring w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150"
            :class="
              activeId === section.id
                ? 'bg-surface-2 font-medium text-[var(--color-text)]'
                : 'text-muted hover:bg-surface-1 hover:text-[var(--color-text)]'
            "
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
