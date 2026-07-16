<script setup lang="ts">
import { PanelLeftClose, PanelLeftOpen } from "@lucide/vue";
import { computed, onMounted } from "vue";
import { RouterLink, useRoute } from "vue-router";

import LogoNest from "../common/LogoNest.vue";
import { useSidebarResize } from "../../composables/useSidebarResize";
import { QUICK_NAV_ITEMS } from "../../constants/quickNav";
import { NAV_GROUPS, QUICK_NAV_ICONS, SETTINGS_NAV_ICON } from "../../constants/navIcons";
import { useChatStore } from "../../stores/chat";
import { useUiStore } from "../../stores/ui";

/** tree：工作区目录树占满剩余高度；compact：少量 slot 内容；none：无 slot */
export type SidebarMode = "tree" | "compact" | "none";

/** 折叠后左侧图标轨宽度，避免主区标题被悬浮按钮遮挡 */
const SIDEBAR_RAIL_WIDTH = 48;

const { sidebarMode = "none" } = defineProps<{
  sidebarMode?: SidebarMode;
}>();

const route = useRoute();
const ui = useUiStore();
const chat = useChatStore();
const { widthPx, dragging, onResizeStart } = useSidebarResize();

onMounted(() => {
  void chat.loadAiEnabled();
});

const navGroups = computed(() =>
  NAV_GROUPS.map((group) => ({
    label: group.label,
    items: QUICK_NAV_ITEMS.filter((item) => {
      if (!group.ids.includes(item.id)) return false;
      if (item.id === "ai" && !chat.aiEnabled) return false;
      return ui.quickNavVisibility[item.id];
    }),
  })).filter((group) => group.items.length > 0),
);

const sidebarStyle = computed(() => {
  if (ui.sidebarCollapsed) {
    return {
      width: `${SIDEBAR_RAIL_WIDTH}px`,
      "--sidebar-width": `${SIDEBAR_RAIL_WIDTH}px`,
    };
  }
  return { width: `${widthPx.value}px`, "--sidebar-width": `${widthPx.value}px` };
});

function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`);
}

const navClass = computed(() =>
  sidebarMode === "tree" ? "app-shell-nav--tree" : "app-shell-nav--fill",
);

const showSidebarSlot = computed(() => sidebarMode !== "none");

const slotClass = computed(() =>
  sidebarMode === "tree" ? "app-shell-slot--tree" : "app-shell-slot--compact",
);
</script>

<template>
  <div class="flex h-full bg-base">
    <aside
      class="app-shell-sidebar relative flex min-h-0 shrink-0 flex-col border-r border-border bg-surface-0"
      :class="{ 'app-shell-sidebar--rail': ui.sidebarCollapsed }"
      :style="sidebarStyle"
      data-testid="app-shell-sidebar"
      :aria-expanded="!ui.sidebarCollapsed"
    >
      <!-- 折叠：窄轨，不遮挡主区标题 -->
      <div
        v-if="ui.sidebarCollapsed"
        class="app-shell-rail"
        data-testid="app-shell-sidebar-rail"
      >
        <LogoNest :size="22" class="app-shell-rail__logo" />
        <button
          type="button"
          class="sidebar-toggle-btn focus-ring"
          title="展开侧栏"
          aria-label="展开侧栏"
          data-testid="sidebar-expand-btn"
          @click="ui.toggleSidebarCollapsed()"
        >
          <PanelLeftOpen :size="15" aria-hidden="true" />
        </button>
      </div>

      <!-- 展开：完整侧栏 -->
      <template v-else>
        <div class="shrink-0 border-b border-border px-4 py-3">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex items-center gap-2 leading-tight">
              <LogoNest :size="22" />
              <div class="min-w-0 flex flex-col">
                <span class="app-shell-brand text-sm font-semibold tracking-tight">
                  狸<span class="app-shell-brand__dot" aria-hidden="true">·</span>知
                </span>
                <span class="text-[10px] text-muted">本地加密 · 知识成网</span>
              </div>
            </div>
            <button
              type="button"
              class="sidebar-toggle-btn focus-ring shrink-0"
              title="收起侧栏"
              aria-label="收起侧栏"
              data-testid="sidebar-collapse-btn"
              @click="ui.toggleSidebarCollapsed()"
            >
              <PanelLeftClose :size="15" aria-hidden="true" />
            </button>
          </div>
        </div>

        <nav
          class="app-shell-nav px-2 py-2"
          :class="navClass"
          aria-label="主导航"
          data-testid="app-shell-nav"
        >
          <div v-for="group in navGroups" :key="group.label" class="mb-2">
            <p class="app-nav-group-label">{{ group.label }}</p>
            <div class="space-y-0.5">
              <RouterLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                class="app-nav-item"
                :class="{ 'app-nav-item--active': isActive(item.to) }"
                :aria-current="isActive(item.to) ? 'page' : undefined"
                :aria-label="item.label"
                :title="item.desc"
              >
                <span class="app-nav-item__icon" aria-hidden="true">
                  <component :is="QUICK_NAV_ICONS[item.id]" :size="14" />
                </span>
                <span class="app-nav-item__text">
                  <span class="app-nav-item__label">{{ item.label }}</span>
                  <span v-if="isActive(item.to)" class="app-nav-item__desc">{{ item.desc }}</span>
                </span>
              </RouterLink>
            </div>
          </div>

          <div class="mt-2 border-t border-divider pt-2">
            <RouterLink
              to="/settings"
              class="app-nav-item"
              :class="{ 'app-nav-item--active': isActive('/settings') }"
              :aria-current="isActive('/settings') ? 'page' : undefined"
              aria-label="设置"
              title="外观、安全、备份与集成"
            >
              <span class="app-nav-item__icon" aria-hidden="true">
                <component :is="SETTINGS_NAV_ICON" :size="14" />
              </span>
              <span class="app-nav-item__text">
                <span class="app-nav-item__label">设置</span>
                <span v-if="isActive('/settings')" class="app-nav-item__desc">外观、安全、备份与集成</span>
              </span>
            </RouterLink>
          </div>
        </nav>

        <template v-if="showSidebarSlot">
          <div class="mx-2 shrink-0 border-t border-divider" />

          <div
            class="app-shell-slot flex min-h-0 flex-col overflow-hidden"
            :class="slotClass"
            data-testid="app-shell-sidebar-slot"
          >
            <slot name="sidebar" />
          </div>
        </template>

        <div
          class="sidebar-resize-handle"
          :class="{ 'sidebar-resize-handle--active': dragging }"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整侧栏宽度"
          data-testid="sidebar-resize-handle"
          @pointerdown="onResizeStart"
        />
      </template>
    </aside>

    <div class="relative flex min-w-0 flex-1 flex-col">
      <slot />
    </div>
  </div>
</template>
