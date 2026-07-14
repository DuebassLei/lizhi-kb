<script setup lang="ts">
import { computed } from "vue";
import { AlertCircle, Download, Loader2, RefreshCw } from "@lucide/vue";

import type { CcWorkbenchStatus } from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";

const props = defineProps<{
  status: CcWorkbenchStatus | null;
  installing: boolean;
}>();

const emit = defineEmits<{
  install: [];
}>();

const needsUpgrade = computed(() => {
  const s = props.status;
  if (!s?.sdkInstalled || !s.sdkVersion) return false;
  const installed = s.installedSdkVersion?.trim();
  if (!installed) return true;
  return installed !== s.sdkVersion;
});

const installLabel = computed(() => {
  if (props.installing) {
    return needsUpgrade.value ? "升级中…" : "安装中…";
  }
  if (needsUpgrade.value) {
    return `升级到 ${props.status?.sdkVersion ?? ""}`;
  }
  if (props.status?.sdkInstalled) return "SDK 已是最新";
  return "安装 Claude Agent SDK";
});

const canInstall = computed(() => {
  if (props.installing || !props.status?.nodeAvailable) return false;
  if (!props.status.sdkInstalled) return true;
  return needsUpgrade.value;
});
</script>

<template>
  <div class="cc-sdk-section" data-testid="cc-sdk-section">
    <div class="cc-sdk-section__header">
      <h3 class="cc-sdk-section__title">SDK 依赖</h3>
      <p class="cc-sdk-section__desc">
        需要 Node.js 18+。Agent SDK 约 230 MB，按需安装到用户目录。升级后支持同消息叠多个 Skills（CLI ≥ 2.1.199）。
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
        <span class="cc-sdk-section__label">目标版本</span>
        <span class="cc-sdk-section__value">{{ status.sdkVersion }}</span>
      </div>

      <div v-if="status?.sdkInstalled" class="cc-sdk-section__row">
        <span class="cc-sdk-section__label">已安装</span>
        <span
          class="cc-sdk-section__value"
          :class="needsUpgrade ? 'cc-sdk-section__value--warn' : 'cc-sdk-section__value--ok'"
        >
          {{ status.installedSdkVersion || "未知（建议重新安装）" }}
        </span>
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
          :disabled="!canInstall"
          :class="{ 'cc-sdk-section__btn--installed': status?.sdkInstalled && !needsUpgrade }"
          data-testid="cc-sdk-install-btn"
          @click="canInstall && emit('install')"
        >
          <Loader2 v-if="installing" class="mr-1.5 h-3.5 w-3.5 animate-spin" />
          <RefreshCw v-else-if="needsUpgrade" class="mr-1.5 h-3.5 w-3.5" />
          <Download v-else class="mr-1.5 h-3.5 w-3.5" />
          {{ installLabel }}
        </Btn>
        <p v-if="!status?.nodeAvailable" class="cc-sdk-section__hint">
          请先安装 Node.js 18 或更高版本后再安装 SDK。
        </p>
        <p v-else-if="needsUpgrade" class="cc-sdk-section__hint">
          检测到本地 SDK 版本落后，点击升级以获得多技能叠用等新能力。旧版企业 vLLM 网关若报 system 角色 400，需升级网关至 0.23.0+。
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
  color: var(--color-muted);
}

.cc-sdk-section__value {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-family: var(--font-mono);
  color: var(--color-text);
}

.cc-sdk-section__value--ok {
  color: var(--color-secure, #16a34a);
}

.cc-sdk-section__value--warn {
  color: var(--color-warning, #d97706);
}

.cc-sdk-section__path {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.cc-sdk-section__path-value {
  word-break: break-all;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-sdk-section__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.cc-sdk-section__btn--installed {
  opacity: 0.85;
}

.cc-sdk-section__hint {
  margin: 0;
  font-size: 0.6875rem;
  line-height: 1.45;
  color: var(--color-muted);
}
</style>
