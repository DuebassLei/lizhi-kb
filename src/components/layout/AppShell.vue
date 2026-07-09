<script setup lang="ts">

import { PanelLeftClose, PanelLeftOpen } from "@lucide/vue";

import { computed, onMounted } from "vue";

import { RouterLink, useRoute } from "vue-router";

import { useSidebarResize } from "../../composables/useSidebarResize";
import { QUICK_NAV_ITEMS } from "../../constants/quickNav";
import { useChatStore } from "../../stores/chat";
import { useUiStore } from "../../stores/ui";



const route = useRoute();

const ui = useUiStore();
const chat = useChatStore();

const { widthPx, dragging, onResizeStart } = useSidebarResize();

onMounted(() => {
  void chat.loadAiEnabled();
});



const navItems = computed(() => {
  const items = QUICK_NAV_ITEMS.filter((item) => {
    if (item.id === "ai" && !chat.aiEnabled) return false;
    return ui.quickNavVisibility[item.id];
  }).map((item) => ({ to: item.to, label: item.label }));
  items.push({ to: "/settings", label: "设置" });
  return items;
});



const sidebarStyle = computed(() => {

  if (ui.sidebarCollapsed) {

    return { width: "0px", "--sidebar-width": "0px" };

  }

  return { width: `${widthPx.value}px`, "--sidebar-width": `${widthPx.value}px` };

});



function isActive(path: string) {

  return route.path === path || route.path.startsWith(`${path}/`);

}

</script>



<template>

  <div class="flex h-full bg-base">

    <aside

      class="app-shell-sidebar relative flex shrink-0 flex-col border-r border-border bg-surface-0"

      :class="{ 'app-shell-sidebar--collapsed': ui.sidebarCollapsed }"

      :style="sidebarStyle"

      data-testid="app-shell-sidebar"

      :aria-hidden="ui.sidebarCollapsed"

    >

      <!-- Logo -->

      <div class="shrink-0 border-b border-border px-4 py-3">

        <div class="flex items-center justify-between gap-2">

          <div class="min-w-0 flex flex-col leading-tight">

            <span class="text-sm font-semibold tracking-tight">

              狸知<span class="text-paw">知识库</span>

            </span>

          </div>

          <button

            type="button"

            class="sidebar-toggle-btn focus-ring shrink-0"

            title="隐藏侧栏"

            aria-label="隐藏侧栏"

            data-testid="sidebar-collapse-btn"

            @click="ui.toggleSidebarCollapsed()"

          >

            <PanelLeftClose :size="15" aria-hidden="true" />

          </button>

        </div>

      </div>



      <!-- Primary nav -->

      <nav class="shrink-0 space-y-0.5 px-2 py-2" aria-label="主导航">

        <RouterLink

          v-for="item in navItems"

          :key="item.to"

          :to="item.to"

          class="focus-ring block rounded-md px-3 py-2 text-sm transition-colors duration-150"

          :class="

            isActive(item.to)

              ? 'bg-surface-2 font-medium text-[var(--color-text)]'

              : 'text-muted hover:bg-surface-2 hover:text-[var(--color-text)]'

          "

          :aria-current="isActive(item.to) ? 'page' : undefined"

        >

          {{ item.label }}

        </RouterLink>

      </nav>



      <div class="mx-2 border-t border-divider" />



      <!-- Context sidebar slot (doc tree, shortcuts, etc.) -->

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">

        <slot name="sidebar" />

      </div>



      <div

        v-show="!ui.sidebarCollapsed"

        class="sidebar-resize-handle"

        :class="{ 'sidebar-resize-handle--active': dragging }"

        role="separator"

        aria-orientation="vertical"

        aria-label="调整侧栏宽度"

        data-testid="sidebar-resize-handle"

        @pointerdown="onResizeStart"

      />

    </aside>



    <!-- Main content -->

    <div class="relative flex min-w-0 flex-1 flex-col">

      <button

        v-if="ui.sidebarCollapsed"

        type="button"

        class="sidebar-expand-tab focus-ring"

        title="显示侧栏"

        aria-label="显示侧栏"

        data-testid="sidebar-expand-btn"

        @click="ui.toggleSidebarCollapsed()"

      >

        <PanelLeftOpen :size="15" aria-hidden="true" />

      </button>

      <slot />

    </div>

  </div>

</template>
