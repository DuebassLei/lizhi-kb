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

const props = defineProps<{
  content: string;
  themeId: WechatThemeId;
  visible?: boolean;
  /** toolbar=顶栏紧凑；preview=预览区顶栏 */
  variant?: "toolbar" | "preview";
}>();

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
    v-if="visible !== false"
    class="wechat-toolbar-actions flex shrink-0 items-center gap-1"
    :class="
      isPreview
        ? 'min-h-10 flex-wrap border-b border-border bg-surface-1 px-2 py-1.5'
        : ''
    "
    role="group"
    aria-label="公众号排版工具"
    data-testid="wechat-toolbar-menu"
  >
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
</template>
