<script setup lang="ts">
import { computed } from "vue";
import { FileDown } from "@lucide/vue";
import type { WechatThemeId } from "../../services/wechatExport";
import WechatThemeSelect from "./WechatThemeSelect.vue";
import WechatCopyButton from "./WechatCopyButton.vue";
import WechatModuleSelect from "./WechatModuleSelect.vue";
import { buildWechatArticleHtml } from "../../services/wechatExport";
import { isTauriRuntime } from "../../services/vaultService";
import { tauriInvoke } from "../../composables/useTauriCommand";
import { useUiStore } from "../../stores/ui";

const ui = useUiStore();

const props = withDefaults(
  defineProps<{
    content: string;
    themeId: WechatThemeId;
    visible?: boolean;
    /** toolbar=顶栏紧凑（遗留）；preview=预览区顶栏 */
    variant?: "toolbar" | "preview";
  }>(),
  { visible: true, variant: "preview" },
);

const emit = defineEmits<{
  "update:themeId": [value: WechatThemeId];
  insert: [snippet: string];
}>();

const themeModel = computed({
  get: () => props.themeId,
  set: (value: WechatThemeId) => emit("update:themeId", value),
});

const isPreview = computed(() => props.variant === "preview");

async function exportHtmlToFolder() {
  if (!props.content.trim()) return;
  if (!isTauriRuntime()) {
    ui.showToast("error", "导出 HTML 需在桌面端使用");
    return;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const dest = await open({ directory: true, multiple: false, title: "导出公众号 HTML" });
  if (!dest || Array.isArray(dest)) return;
  const html = await buildWechatArticleHtml(props.content, props.themeId);
  const path = `${dest}/wechat-article.html`.replace(/\\/g, "/");
  await tauriInvoke("write_export_file", { path, content: html });
  ui.showToast("success", "已导出 HTML 到文件夹");
}
</script>

<template>
  <div
    v-if="visible"
    class="wechat-studio__rail"
    :class="{ 'wechat-studio__rail--compact': !isPreview }"
    role="group"
    aria-label="公众号排版工具"
    data-testid="wechat-toolbar-menu"
  >
    <div v-if="isPreview" class="wechat-studio__title">
      <span class="wechat-studio__title-dot" aria-hidden="true" />
      公众号
    </div>

    <div class="wechat-studio__rail-group">
      <WechatThemeSelect
        v-model="themeModel"
        class="w-[5.5rem] shrink-0"
        :menu-align="isPreview ? 'left' : 'right'"
        test-id="workspace-wechat-theme-select"
      />
      <WechatModuleSelect
        class="w-[6rem] shrink-0"
        :menu-align="isPreview ? 'left' : 'right'"
        test-id="workspace-wechat-module-select"
        @insert="emit('insert', $event)"
      />
    </div>

    <span v-if="isPreview" class="wechat-studio__rail-sep" aria-hidden="true" />

    <div class="wechat-studio__rail-group">
      <WechatCopyButton
        :content="content"
        :theme-id="themeId"
        compact
        :icon-only="!isPreview"
        class="shrink-0"
        test-id="workspace-wechat-copy"
      />
      <button
        type="button"
        class="toolbar-chip focus-ring flex h-7 shrink-0 items-center justify-center gap-1 text-[11px] text-[var(--color-text)] disabled:opacity-40"
        :class="isPreview ? 'px-2' : 'w-7 px-0'"
        data-testid="wechat-export-html-folder"
        title="导出 HTML 到文件夹"
        aria-label="导出 HTML 到文件夹"
        :disabled="!content.trim()"
        @click="exportHtmlToFolder"
      >
        <FileDown class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span v-if="isPreview">导出</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.wechat-studio__rail {
  position: relative;
  z-index: 30;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  /* 下拉菜单 absolute 定位，不能 overflow 裁切 */
  overflow: visible;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-surface-1) 92%, transparent) 0%,
    color-mix(in srgb, var(--color-surface-0) 88%, transparent) 100%
  );
}

.wechat-studio__rail--compact {
  min-height: auto;
  padding: 0;
  border-bottom: none;
  background: transparent;
  overflow: visible;
}

.wechat-studio__rail-group {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.wechat-studio__rail-sep {
  width: 1px;
  height: 1.25rem;
  margin: 0 0.125rem;
  flex-shrink: 0;
  background: var(--color-border-strong);
}

.wechat-studio__title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-right: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.wechat-studio__title-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 999px;
  background: var(--color-paw);
  box-shadow: 0 0 0 3px var(--color-paw-muted);
}
</style>
