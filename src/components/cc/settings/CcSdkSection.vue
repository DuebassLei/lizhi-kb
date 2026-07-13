<script setup lang="ts">
import { computed } from "vue";
import { AlertCircle, Download, Loader2 } from "@lucide/vue";

import type { CcWorkbenchStatus } from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";

const props = defineProps<{
  status: CcWorkbenchStatus | null;
  installing: boolean;
}>();

const emit = defineEmits<{
  install: [];
}>();

const installLabel = computed(() => {
  if (props.installing) return "安装中…";
  if (props.status?.sdkInstalled) return "SDK 已安装";
  return "安装 Claude Agent SDK";
});

const canInstall = computed(
  () => !props.installing && !props.status?.sdkInstalled && props.status?.nodeAvailable,
);
</script>

<template>
  <div class="cc-sdk-section" data-testid="cc-sdk-section">
    <div class="cc-sdk-section__header">
      <h3 class="cc-sdk-section__title">SDK 依赖</h3>
      <p class="cc-sdk-section__desc">
        需要 Node.js 18+。Agent SDK 约 230 MB，按需安装到用户目录。
      </p>
    </div>

    <div class="cc-sdk-section__card">
      <div class="cc-sdk-section__row">
        <span class="cc-sdk-section__label">Node.js</span>
        <span
          v-if="status?.nodeAvailable"
          class="cc-sdk-section__value cc-sdk-section__value--ok"
        >
          {{ status.nodeVersion }}
        </span>
        <span v-else class="cc-sdk-section__value cc-sdk-section__value--warn">
          <AlertCircle class="h-3.5 w-3.5 shrink-0" />
          未检测到（需要 18+）
        </span>
      </div>

      <div v-if="status?.sdkVersion" class="cc-sdk-section__row">
        <span class="cc-sdk-section__label">锁定版本</span>
        <span class="cc-sdk-section__value">{{ status.sdkVersion }}</span>
      </div>

      <div class="cc-sdk-section__path">
        <span class="cc-sdk-section__label">安装路径</span>
        <output class="cc-sdk-section__path-value" data-testid="cc-sdk-path">
          {{ status?.sdkPath || "…" }}
        </output>
      </div>

      <div class="cc-sdk-section__actions">
        <Btn
          variant="secondary"
          size="sm"
          :disabled="!canInstall && !status?.sdkInstalled"
          :class="{ 'cc-sdk-section__btn--installed': status?.sdkInstalled }"
          data-testid="cc-sdk-install-btn"
          @click="canInstall && emit('install')"
        >
          <Loader2 v-if="installing" class="mr-1.5 h-3.5 w-3.5 animate-spin" />
          <Download v-else class="mr-1.5 h-3.5 w-3.5" />
          {{ installLabel }}
        </Btn>
        <p v-if="!status?.nodeAvailable" class="cc-sdk-section__hint">
          请先安装 Node.js 18 或更高版本后再安装 SDK。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cc-sdk-section {
  padding: 1rem 1.125rem 1.25rem;
}

.cc-sdk-section__header {
  margin-bottom: 1rem;
}

.cc-sdk-section__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-sdk-section__desc {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-muted);
}

.cc-sdk-section__card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);
  padding: 0.875rem 1rem;
}

.cc-sdk-section__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.75rem;
}

.cc-sdk-section__label {
  flex-shrink: 0;
  color: var(--color-muted);
}

.cc-sdk-section__value {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.6875rem;
  color: var(--color-text);
}

.cc-sdk-section__value--ok {
  color: var(--color-success, #22c55e);
}

.cc-sdk-section__value--warn {
  color: var(--color-warning, #f59e0b);
}

.cc-sdk-section__path {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.cc-sdk-section__path-value {
  display: block;
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.5rem 0.625rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.6875rem;
  line-height: 1.45;
  color: var(--color-muted);
  word-break: break-all;
  user-select: all;
}

.cc-sdk-section__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.125rem;
}

.cc-sdk-section__btn--installed {
  border-color: color-mix(in srgb, var(--color-success, #22c55e) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-success, #22c55e) 8%, transparent);
  color: var(--color-success, #22c55e);
  cursor: default;
}

.cc-sdk-section__hint {
  font-size: 0.6875rem;
  color: var(--color-muted);
}
</style>
