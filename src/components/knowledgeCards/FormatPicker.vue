<script setup lang="ts">
import { computed } from "vue";
import type { CardFormatId } from "../../types/knowledgeCards";
import { CARD_FORMATS } from "../../utils/knowledgeCards/cardFormats";
import { useKnowledgeCardThemeStore } from "../../stores/knowledgeCardTheme";

const themeStore = useKnowledgeCardThemeStore();

const formats = Object.values(CARD_FORMATS);

const model = computed({
  get: () => themeStore.currentFormatId,
  set: (id: CardFormatId) => themeStore.setFormat(id),
});
</script>

<template>
  <div class="flex items-center gap-1" data-testid="kc-format-picker">
    <label class="sr-only" for="kc-format-select">卡片格式</label>
    <select
      id="kc-format-select"
      v-model="model"
      class="kc-select focus-ring"
      title="卡片格式"
    >
      <option v-for="f in formats" :key="f.id" :value="f.id">
        {{ f.name }} · {{ f.ratio }}
      </option>
    </select>
    <template v-if="model === 'custom'">
      <input
        type="number"
        class="kc-num focus-ring"
        :value="themeStore.customSize.width"
        min="200"
        max="4096"
        aria-label="自定义宽度"
        @change="
          themeStore.setCustomSize(
            Number(($event.target as HTMLInputElement).value),
            themeStore.customSize.height,
          )
        "
      />
      <span class="text-[10px] text-muted">×</span>
      <input
        type="number"
        class="kc-num focus-ring"
        :value="themeStore.customSize.height"
        min="200"
        max="4096"
        aria-label="自定义高度"
        @change="
          themeStore.setCustomSize(
            themeStore.customSize.width,
            Number(($event.target as HTMLInputElement).value),
          )
        "
      />
    </template>
  </div>
</template>
