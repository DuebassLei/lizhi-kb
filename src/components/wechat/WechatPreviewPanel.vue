<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  buildWechatPreviewHtml,
  getThemeCss,
  type WechatThemeId,
} from "../../services/wechatExport";
import { WECHAT_CODE_HLJS_CSS } from "../../services/wechatExport/highlightCodeForWechat";
import { WECHAT_BASE_CSS } from "../../services/wechatExport/wechatBaseCss";

const props = defineProps<{
  content: string;
  themeId: WechatThemeId;
  /** 嵌入工作区分栏时去掉重复左边框 */
  embedded?: boolean;
}>();

const previewHtml = ref("");
const loading = ref(false);

const themeStyle = computed(() => {
  const themeCss = getThemeCss(props.themeId, "#wechat-preview #nice");
  const hljsCss = WECHAT_CODE_HLJS_CSS.replace(/#nice/g, "#wechat-preview #nice");
  return `${WECHAT_BASE_CSS.replace(/#nice/g, "#wechat-preview #nice")}\n${hljsCss}\n${themeCss}`;
});

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function renderPreview() {
  loading.value = true;
  try {
    previewHtml.value = await buildWechatPreviewHtml(props.content, props.themeId);
  } finally {
    loading.value = false;
  }
}

function scheduleRender() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void renderPreview();
  }, 280);
}

watch(
  () => [props.content, props.themeId] as const,
  () => scheduleRender(),
  { immediate: true },
);
</script>

<template>
  <div
    id="wechat-preview"
    class="wechat-preview-panel flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white"
    :class="embedded ? '' : 'border-l border-border'"
    data-testid="wechat-preview-panel"
  >
    <component :is="'style'">{{ themeStyle }}</component>

    <div
      v-if="loading && !previewHtml"
      class="flex flex-1 items-center justify-center text-sm text-muted"
      role="status"
    >
      渲染预览…
    </div>
    <div
      v-else
      class="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white px-4 py-6 pb-12"
      data-testid="wechat-preview-content"
    >
      <div
        v-if="previewHtml"
        class="wechat-preview-body mx-auto max-w-[680px]"
        v-html="previewHtml"
      />
      <p v-else class="text-center text-sm text-muted">输入 Markdown 以预览公众号排版</p>
    </div>
  </div>
</template>

<style scoped>
.wechat-preview-panel :deep(#nice) {
  color: #3f3f3f;
}

.wechat-preview-body {
  font-family: Optima-Regular, Optima, PingFangSC-light, "PingFang SC", Cambria, Georgia, serif;
}
</style>
