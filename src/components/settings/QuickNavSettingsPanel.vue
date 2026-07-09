<script setup lang="ts">
import { LayoutList } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import { QUICK_NAV_ITEMS, DEFAULT_QUICK_NAV_VISIBILITY, type QuickNavId } from "../../constants/quickNav";
import { useChatStore } from "../../stores/chat";
import { useUiStore } from "../../stores/ui";

const ui = useUiStore();
const chat = useChatStore();

function onToggle(id: QuickNavId, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  ui.setQuickNavVisible(id, checked);
}

function resetDefaults() {
  ui.setQuickNavVisibility({ ...DEFAULT_QUICK_NAV_VISIBILITY });
}
</script>

<template>
  <section id="settings-quick-nav" class="settings-section mb-8 max-w-lg scroll-mt-6" data-testid="quick-nav-settings">
    <div class="mb-3 flex items-center gap-2">
      <LayoutList class="h-4 w-4 text-link" aria-hidden="true" />
      <h2 class="text-sm font-medium uppercase tracking-wide text-text-secondary">快速导航</h2>
    </div>

    <p class="mb-3 text-sm text-muted">
      选择在左侧主导航中显示的入口。「设置」始终可见。
    </p>

    <div class="space-y-0 rounded-lg border border-border bg-surface-0">
      <label
        v-for="item in QUICK_NAV_ITEMS"
        :key="item.id"
        class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between border-b border-divider px-4 py-3 text-sm last:border-b-0"
        :data-testid="`quick-nav-toggle-${item.id}`"
      >
        <span>
          {{ item.label }}
          <span class="mt-0.5 block text-xs text-muted">{{ item.desc }}</span>
          <span
            v-if="item.id === 'ai' && !chat.aiEnabled"
            class="mt-0.5 block text-xs text-muted"
          >
            需先在「AI 助手」中启用
          </span>
        </span>
        <input
          type="checkbox"
          class="accent-link shrink-0"
          :checked="ui.quickNavVisibility[item.id]"
          :data-testid="`quick-nav-checkbox-${item.id}`"
          @change="onToggle(item.id, $event)"
        />
      </label>

      <div
        class="flex items-center justify-between px-4 py-3 text-sm text-muted"
        aria-hidden="true"
      >
        <span>
          设置
          <span class="mt-0.5 block text-xs">始终显示</span>
        </span>
        <input type="checkbox" class="accent-link shrink-0" checked disabled />
      </div>
    </div>

    <div class="mt-3">
      <Btn variant="ghost" size="sm" data-testid="quick-nav-reset" @click="resetDefaults">
        恢复默认
      </Btn>
    </div>
  </section>
</template>
