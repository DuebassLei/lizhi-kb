<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { X } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import AiSettingsShell from "./settings/AiSettingsShell.vue";
import type { AiSettingsTabInput } from "../../composables/useAiSettings";

const props = defineProps<{
  open: boolean;
  initialTab?: AiSettingsTabInput;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const shellRef = ref<InstanceType<typeof AiSettingsShell> | null>(null);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    await nextTick();
    await shellRef.value?.loadConfig(true, false);
    if (props.initialTab) {
      shellRef.value?.selectTab(props.initialTab);
    }
  },
  { immediate: true },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex justify-end"
        data-testid="ai-settings-drawer"
      >
        <button
          type="button"
          class="absolute inset-0 bg-overlay backdrop-blur-[2px]"
          aria-label="关闭设置"
          @click="emit('close')"
        />

        <aside
          class="ai-settings-drawer relative flex h-full w-full max-w-3xl flex-col border-l border-border bg-surface-0 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-settings-drawer-title"
        >
          <header class="shrink-0 border-b border-border px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 id="ai-settings-drawer-title" class="text-sm font-semibold">AI 助手设置</h2>
                <p class="mt-0.5 text-xs text-muted">本地 Ollama · 云端 API · 知识库权限</p>
              </div>
              <Btn variant="ghost" size="sm" aria-label="关闭" data-testid="ai-config-panel-close" @click="emit('close')">
                <X class="h-4 w-4" />
              </Btn>
            </div>
          </header>

          <AiSettingsShell
            ref="shellRef"
            class="min-h-0 flex-1"
            reveal-key-on-mount
            @saved="emit('saved')"
          />
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ai-settings-drawer {
  animation: ai-drawer-slide 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes ai-drawer-slide {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-active .ai-settings-drawer,
.drawer-leave-active .ai-settings-drawer {
  transition: transform 0.2s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .ai-settings-drawer,
.drawer-leave-to .ai-settings-drawer {
  transform: translateX(100%);
}
</style>
