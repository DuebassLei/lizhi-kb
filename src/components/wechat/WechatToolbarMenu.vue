<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ChevronDown } from "@lucide/vue";
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
}>();

const emit = defineEmits<{
  "update:themeId": [value: WechatThemeId];
  insert: [snippet: string];
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const themeModel = computed({
  get: () => props.themeId,
  set: (value: WechatThemeId) => emit("update:themeId", value),
});

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value) return;
  const root = rootRef.value;
  if (root && !root.contains(event.target as Node)) close();
}

onMounted(() => document.addEventListener("click", onDocumentClick));
onUnmounted(() => document.removeEventListener("click", onDocumentClick));

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
  close();
}
</script>

<template>
  <div
    v-if="visible !== false"
    ref="rootRef"
    class="relative min-w-0"
    data-testid="wechat-toolbar-menu"
  >
    <button
      type="button"
      class="focus-ring flex w-full items-center justify-between gap-1 rounded-md border border-border bg-surface-1 px-2 py-1 text-[11px] text-[var(--color-text)] hover:bg-surface-2"
      :aria-expanded="open"
      aria-haspopup="menu"
      data-testid="wechat-toolbar-menu-trigger"
      @click.stop="toggle"
    >
      <span>公众号工具</span>
      <ChevronDown class="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full z-50 mt-1 w-[16rem] space-y-2 rounded-lg border border-border bg-surface-1 p-2 shadow-2xl"
      role="menu"
      @click.stop
    >
      <WechatThemeSelect
        v-model="themeModel"
        class="min-w-0"
        test-id="workspace-wechat-theme-select"
      />
      <WechatModuleSelect
        class="min-w-0"
        test-id="workspace-wechat-module-select"
        @insert="emit('insert', $event)"
      />
      <WechatCopyButton
        :content="content"
        :theme-id="themeId"
        class="w-full"
        test-id="workspace-wechat-copy"
      />
      <button
        type="button"
        class="focus-ring w-full rounded-md border border-border px-2 py-1.5 text-[11px] text-link hover:bg-surface-2"
        data-testid="wechat-export-html-folder"
        @click="exportHtmlToFolder"
      >
        导出 HTML 到文件夹
      </button>
    </div>
  </div>
</template>
