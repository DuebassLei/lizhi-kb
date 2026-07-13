<script setup lang="ts">
import { computed } from "vue";
import { Check, Circle, ShieldCheck } from "@lucide/vue";

import type { CwdMode } from "../../../services/ccWorkbenchService";
import { cwdModeLabel } from "../../../services/ccWorkbenchService";
import { listCcSettingSourceRows } from "../../../utils/ccSettingSources";

const props = defineProps<{
  cwdMode?: CwdMode;
  projectPath?: string | null;
}>();

const mode = computed(() => props.cwdMode ?? "vault");

const rows = computed(() => listCcSettingSourceRows(mode.value, props.projectPath));

const activeCount = computed(() => rows.value.filter((r) => r.active).length);
</script>

<template>
  <div class="cc-setting-sources" data-testid="cc-setting-sources-section">
    <div class="cc-setting-sources__header">
      <h3 class="cc-setting-sources__title">Claude Code 设置加载</h3>
      <p class="cc-setting-sources__desc">
        Agent 对话时通过 SDK <code>settingSources</code> 加载 filesystem 配置；启动前会自动清理
        <code>~/.claude.json</code> 中的无效 Windows 项目键，避免 EISDIR。
      </p>
    </div>

    <div class="cc-setting-sources__card">
      <div class="cc-setting-sources__mode">
        <span class="cc-setting-sources__mode-label">当前工作目录模式</span>
        <span class="cc-setting-sources__mode-value">{{ cwdModeLabel(mode) }}</span>
        <span class="cc-setting-sources__mode-badge">
          已启用 {{ activeCount }} 项
        </span>
      </div>

      <ul class="cc-setting-sources__list">
        <li
          v-for="row in rows"
          :key="row.id"
          class="cc-setting-sources__item"
          :class="{ 'cc-setting-sources__item--active': row.active }"
        >
          <component
            :is="row.active ? Check : Circle"
            class="h-3.5 w-3.5 shrink-0"
            :class="row.active ? 'text-link' : 'text-muted'"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-sm font-medium">{{ row.label }}</span>
              <span
                class="cc-setting-sources__status"
                :class="row.active ? 'cc-setting-sources__status--on' : 'cc-setting-sources__status--off'"
              >
                {{ row.active ? "已加载" : "未加载" }}
              </span>
            </div>
            <p class="mt-0.5 text-xs text-muted">{{ row.description }}</p>
            <code class="cc-setting-sources__path">{{ row.path }}</code>
          </div>
        </li>
      </ul>

      <p class="cc-setting-sources__footnote">
        <ShieldCheck class="mr-1 inline h-3.5 w-3.5 align-text-bottom text-muted" />
        vault 模式仅加载全局 user 设置；project 模式额外加载项目 project / local 设置。Hooks 与
        CLAUDE.md 可在对应设置标签中编辑。
      </p>
    </div>
  </div>
</template>

<style scoped>
.cc-setting-sources {
  padding: 0 1.125rem 1.25rem;
}

.cc-setting-sources__header {
  margin-bottom: 0.875rem;
}

.cc-setting-sources__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-setting-sources__desc {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  line-height: 1.55;
  color: var(--color-muted);
}

.cc-setting-sources__desc code {
  border-radius: 0.25rem;
  background: var(--color-surface-1);
  padding: 0 0.25rem;
  font-size: 0.6875rem;
}

.cc-setting-sources__card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);
  padding: 0.875rem 1rem;
}

.cc-setting-sources__mode {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.cc-setting-sources__mode-label {
  color: var(--color-muted);
}

.cc-setting-sources__mode-value {
  font-weight: 500;
  color: var(--color-text);
}

.cc-setting-sources__mode-badge {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
  color: var(--color-link);
}

.cc-setting-sources__list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.cc-setting-sources__item {
  display: flex;
  gap: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  padding: 0.5rem 0.375rem;
  opacity: 0.72;
}

.cc-setting-sources__item--active {
  border-color: color-mix(in srgb, var(--color-link) 20%, var(--color-border));
  background: color-mix(in srgb, var(--color-link) 6%, transparent);
  opacity: 1;
}

.cc-setting-sources__status {
  border-radius: 999px;
  padding: 0 0.375rem;
  font-size: 0.625rem;
}

.cc-setting-sources__status--on {
  background: color-mix(in srgb, var(--color-link) 15%, transparent);
  color: var(--color-link);
}

.cc-setting-sources__status--off {
  background: var(--color-surface-1);
  color: var(--color-muted);
}

.cc-setting-sources__path {
  display: block;
  margin-top: 0.375rem;
  border-radius: 0.375rem;
  background: var(--color-surface-0);
  padding: 0.3125rem 0.5rem;
  font-size: 0.625rem;
  line-height: 1.45;
  color: var(--color-muted);
  word-break: break-all;
}

.cc-setting-sources__footnote {
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--color-muted);
}
</style>
