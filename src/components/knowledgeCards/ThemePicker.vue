<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown, LayoutTemplate } from "@lucide/vue";
import { useKnowledgeCardThemeStore } from "../../stores/knowledgeCardTheme";
import ThemeStoreDialog from "./ThemeStoreDialog.vue";

const emit = defineEmits<{
  customize: [];
}>();

const themeStore = useKnowledgeCardThemeStore();
const storeOpen = ref(false);

const currentName = computed(() => themeStore.currentTheme.name);
const currentDesc = computed(() => themeStore.currentTheme.description ?? "");

function openStore() {
  storeOpen.value = true;
}

function onCustomize() {
  storeOpen.value = false;
  emit("customize");
}
</script>

<template>
  <div class="kc-theme-trigger" data-testid="kc-theme-picker">
    <button
      type="button"
      class="kc-select kc-theme-trigger__btn focus-ring"
      :title="currentDesc || '打开主题商店'"
      aria-haspopup="dialog"
      :aria-expanded="storeOpen"
      data-testid="kc-open-theme-store"
      @click="openStore"
    >
      <LayoutTemplate class="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
      <span class="kc-theme-trigger__name">{{ currentName }}</span>
      <ChevronDown class="h-3 w-3 shrink-0 opacity-55" aria-hidden="true" />
    </button>

    <ThemeStoreDialog v-model:open="storeOpen" @customize="onCustomize" />
  </div>
</template>
