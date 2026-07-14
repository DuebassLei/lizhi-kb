<script setup lang="ts">
import { ref } from "vue";
import { Copy, Loader2 } from "@lucide/vue";
import { useDocumentsStore } from "../../stores/documents";
import { useEditorStore } from "../../stores/editor";
import { useUiStore } from "../../stores/ui";
import {
  buildWechatArticleHtml,
  copyRichText,
  type WechatThemeId,
} from "../../services/wechatExport";

const props = defineProps<{
  content: string;
  themeId: WechatThemeId;
  testId?: string;
  compact?: boolean;
  /** 仅图标（需配合 compact；文案走 title/aria-label） */
  iconOnly?: boolean;
}>();

const documents = useDocumentsStore();
const editor = useEditorStore();
const ui = useUiStore();
const copying = ref(false);

async function copyToWechat() {
  if (!props.content.trim() || copying.value) return;
  copying.value = true;
  try {
    if (editor.isDirty && documents.activeId) {
      await editor.saveNow();
    }
    const html = await buildWechatArticleHtml(props.content, props.themeId);
    const ok = await copyRichText(html);
    ui.showToast(
      ok ? "success" : "error",
      ok ? "已复制到剪贴板，可粘贴到微信公众平台" : "复制失败，请重试",
    );
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "复制失败");
  } finally {
    copying.value = false;
  }
}
</script>

<template>
  <button
    type="button"
    class="focus-ring flex items-center justify-center gap-1 whitespace-nowrap"
    :class="
      compact
        ? iconOnly
          ? 'toolbar-chip h-7 w-7 text-[var(--color-text)] disabled:opacity-40'
          : 'toolbar-chip h-7 px-2 text-[11px] text-[var(--color-text)] disabled:opacity-40'
        : 'btn-primary w-full min-w-0 px-3 py-1.5 text-xs'
    "
    :data-testid="testId ?? 'wechat-copy-btn'"
    title="复制到微信"
    aria-label="复制到微信"
    :disabled="!content.trim() || copying"
    @click="copyToWechat()"
  >
    <Loader2
      v-if="copying"
      :class="compact && iconOnly ? 'h-3.5 w-3.5' : 'h-3 w-3'"
      class="animate-spin"
      aria-hidden="true"
    />
    <Copy
      v-else
      :class="compact && iconOnly ? 'h-3.5 w-3.5' : 'h-3 w-3'"
      aria-hidden="true"
    />
    <span v-if="!(compact && iconOnly)">复制到微信</span>
  </button>
</template>
