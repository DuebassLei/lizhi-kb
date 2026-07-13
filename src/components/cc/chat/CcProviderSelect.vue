<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, ChevronDown, Loader2 } from "@lucide/vue";

import { providerModeLabel } from "../../../composables/cc/useCcProviderSwitch";
import type { CcProviderPublic } from "../../../services/ccWorkbenchService";

const props = defineProps<{
  providers: CcProviderPublic[];
  activeProviderId?: string | null;
  switching?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  switch: [id: string];
}>();

const open = ref(false);

const activeProvider = computed(
  () => props.providers.find((p) => p.id === props.activeProviderId) ?? props.providers.find((p) => p.isActive) ?? null,
);

const displayName = computed(() => activeProvider.value?.name ?? "未配置供应商");

const providerTitle = computed(() => {
  const p = activeProvider.value;
  if (!p) return "";
  const mode = providerModeLabel(p.providerMode, p.source);
  const parts = [p.name, mode];
  if (p.baseUrl?.trim()) parts.push(p.baseUrl.trim());
  return parts.join(" · ");
});

function onSelect(id: string) {
  open.value = false;
  if (id !== activeProvider.value?.id) {
    emit("switch", id);
  }
}

function onToggle(event: MouseEvent) {
  event.stopPropagation();
  if (props.disabled || props.switching) return;
  open.value = !open.value;
}

defineExpose({ close: () => { open.value = false; } });
</script>

<template>
  <div class="cc-chat-select cc-provider-select">
    <button
      type="button"
      class="cc-chat-select__trigger cc-chat-select__trigger--provider"
      :disabled="disabled || switching || !providers.length"
      :title="providerTitle"
      @click.stop="onToggle"
    >
      <Loader2 v-if="switching" class="h-3 w-3 shrink-0 animate-spin" />
      <span class="truncate">{{ displayName }}</span>
      <ChevronDown class="h-3 w-3 shrink-0" />
    </button>
    <div v-if="open" class="cc-chat-select__menu cc-chat-select__menu--provider">
      <button
        v-for="provider in providers"
        :key="provider.id"
        type="button"
        class="cc-chat-select__item cc-chat-select__item--provider"
        :class="{ 'cc-chat-select__item--active': provider.isActive }"
        :title="provider.baseUrl || provider.name"
        @click="onSelect(provider.id)"
      >
        <div class="cc-chat-select__item-main">
          <span class="font-medium">{{ provider.name }}</span>
          <span class="cc-chat-select__desc">
            {{ providerModeLabel(provider.providerMode, provider.source) }}
            <span v-if="provider.baseUrl"> · {{ provider.baseUrl }}</span>
          </span>
        </div>
        <Check v-if="provider.isActive" class="cc-chat-select__status cc-chat-select__status--ok" />
      </button>
      <p v-if="!providers.length" class="cc-chat-select__empty">请先在设置中添加供应商</p>
    </div>
  </div>
</template>

<style scoped>
.cc-chat-select {
  position: relative;
}

.cc-chat-select__trigger {
  display: inline-flex;
  max-width: 10rem;
  align-items: center;
  gap: 0.25rem;
  border-radius: 0.4375rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.3125rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-text);
}

.cc-chat-select__trigger--provider {
  max-width: 9rem;
}

.cc-chat-select__trigger:disabled {
  opacity: 0.5;
}

.cc-chat-select__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.25rem);
  z-index: 20;
  min-width: 12rem;
  max-width: min(18rem, 80vw);
  max-height: min(16rem, 50vh);
  overflow-y: auto;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 8px 24px color-mix(in srgb, black 14%, transparent);
  padding: 0.25rem;
}

.cc-chat-select__item--provider {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.cc-chat-select__item {
  display: flex;
  width: 100%;
  border-radius: 0.375rem;
  padding: 0.4375rem 0.5rem;
  text-align: left;
  font-size: 0.6875rem;
  color: var(--color-text);
}

.cc-chat-select__item:hover,
.cc-chat-select__item--active {
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
}

.cc-chat-select__item-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
}

.cc-chat-select__desc {
  margin-top: 0.125rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-chat-select__status {
  height: 0.875rem;
  width: 0.875rem;
  flex-shrink: 0;
}

.cc-chat-select__status--ok {
  color: #16a34a;
}

.cc-chat-select__empty {
  padding: 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}
</style>
