<script setup lang="ts">
import { ShieldAlert } from "@lucide/vue";

defineProps<{
  hitCount: number;
}>();

const emit = defineEmits<{
  wrap: [];
  exclude: [];
  ignore: [];
}>();
</script>

<template>
  <div
    class="ai-privacy-scan-banner mx-6 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/35 bg-warning/8 px-3 py-2 text-xs text-[var(--color-text)] sm:mx-10 lg:mx-16"
    role="status"
    data-testid="ai-privacy-scan-banner"
  >
    <p class="m-0 flex min-w-0 items-center gap-2">
      <ShieldAlert class="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
      <span>
        发现疑似敏感内容（{{ hitCount }} 处）。扫描仅为提示，未标记仍可能进入 AI。
      </span>
    </p>
    <div class="flex shrink-0 flex-wrap items-center gap-1.5">
      <button
        type="button"
        class="focus-ring rounded-md border border-border bg-surface-0 px-2 py-1 text-[11px] font-medium hover:bg-surface-2"
        data-testid="ai-privacy-scan-wrap"
        @click="emit('wrap')"
      >
        包进隐藏信息
      </button>
      <button
        type="button"
        class="focus-ring rounded-md border border-border bg-surface-0 px-2 py-1 text-[11px] font-medium hover:bg-surface-2"
        data-testid="ai-privacy-scan-exclude"
        @click="emit('exclude')"
      >
        整篇禁止喂 AI
      </button>
      <button
        type="button"
        class="focus-ring rounded-md px-2 py-1 text-[11px] text-muted hover:text-[var(--color-text)]"
        data-testid="ai-privacy-scan-ignore"
        @click="emit('ignore')"
      >
        忽略
      </button>
    </div>
  </div>
</template>
