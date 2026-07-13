<script setup lang="ts">
import { ref } from "vue";
import { Search, X } from "@lucide/vue";

const model = defineModel<string>({ default: "" });

defineProps<{
  placeholder?: string;
  testId?: string;
  ariaLabel?: string;
}>();

const focused = ref(false);
</script>

<template>
  <div class="module-search" :class="{ 'module-search--focused': focused }">
    <label class="module-search__inner" :aria-label="ariaLabel ?? '搜索'">
      <Search class="module-search__icon" aria-hidden="true" />
      <input
        v-model="model"
        type="search"
        inputmode="search"
        enterkeyhint="search"
        autocomplete="off"
        :placeholder="placeholder ?? '搜索…'"
        class="module-search__input focus-ring"
        :data-testid="testId"
        @focus="focused = true"
        @blur="focused = false"
      />
      <button
        v-if="model"
        type="button"
        class="module-search__clear focus-ring"
        aria-label="清除搜索"
        @click="model = ''"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </label>
  </div>
</template>
