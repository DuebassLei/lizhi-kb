<script setup lang="ts">
import { onMounted } from "vue";

import AppShell from "../components/layout/AppShell.vue";
import CcWorkbenchShell from "../components/cc/CcWorkbenchShell.vue";
import { useCcWorkbenchStore } from "../stores/ccWorkbench";

const cc = useCcWorkbenchStore();

onMounted(() => {
  void cc.refresh();
});
</script>

<template>
  <AppShell>
    <div class="flex h-full min-h-0 flex-col" data-testid="cc-workbench-view">
      <CcWorkbenchShell />
    </div>
  </AppShell>
</template>
