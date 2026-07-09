<script setup lang="ts">
import { RouterView } from "vue-router";
import CommandPalette from "./components/common/CommandPalette.vue";
import ContextMenu from "./components/common/ContextMenu.vue";
import LockOverlay from "./components/vault/LockOverlay.vue";
import WatermarkOverlay from "./components/common/WatermarkOverlay.vue";
import { useCommandPalette } from "./composables/useCommandPalette";

import { useWorkspaceShortcuts } from "./composables/useWorkspaceShortcuts";
import { useAutoLock } from "./composables/useAutoLock";

useCommandPalette();
useWorkspaceShortcuts();
useAutoLock();
</script>

<template>
  <div class="h-full">
    <RouterView />
    <CommandPalette />
    <ContextMenu />
    <WatermarkOverlay />
    <LockOverlay />
  </div>
</template>
