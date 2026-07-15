<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import {
  buildWechatPreviewHtml,
  getThemeCss,
  type WechatThemeId,
} from "../../services/wechatExport";
import { WECHAT_CODE_HLJS_CSS } from "../../services/wechatExport/highlightCodeForWechat";
import { WECHAT_BASE_CSS } from "../../services/wechatExport/wechatBaseCss";
import WechatToolbarMenu from "./WechatToolbarMenu.vue";

const WECHAT_HTML_ROOT = "#lizhi-wechat-html";

const props = withDefaults(
  defineProps<{
    content: string;
    themeId: WechatThemeId;
    /** 嵌入工作区分栏时去掉重复左边框 */
    embedded?: boolean;
    /** 是否显示预览顶栏工具（主题 / 模块 / 复制）；默认显示 */
    showToolbar?: boolean;
  }>(),
  { showToolbar: true },
);

const emit = defineEmits<{
  "update:themeId": [value: WechatThemeId];
  insert: [snippet: string];
}>();

const previewHtml = ref("");
const loading = ref(false);
const containerRef = ref<HTMLElement | null>(null);

defineExpose({ containerRef });

const themeStyle = computed(() => {
  const themeCss = getThemeCss(props.themeId, WECHAT_HTML_ROOT);
  const hljsCss = WECHAT_CODE_HLJS_CSS.replace(/#nice/g, WECHAT_HTML_ROOT);
  const baseCss = WECHAT_BASE_CSS.replace(/#nice/g, WECHAT_HTML_ROOT);
  return `${baseCss}\n${hljsCss}\n${themeCss}`;
});

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let renderGeneration = 0;

async function renderPreview() {
  const generation = ++renderGeneration;
  loading.value = true;
  try {
    const html = await buildWechatPreviewHtml(props.content, props.themeId);
    if (generation !== renderGeneration) return;
    // 统一根选择器：主题 CSS 只作用于正文，不波及预览顶栏
    previewHtml.value = html.replace(/\bid="nice"/, `id="lizhi-wechat-html"`);
  } finally {
    if (generation === renderGeneration) loading.value = false;
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

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  renderGeneration += 1;
});
</script>

<template>
  <div
    class="wechat-studio wechat-preview-panel w-full min-w-0"
    :class="embedded ? '' : 'border-l border-border'"
    data-testid="wechat-preview-panel"
  >
    <WechatToolbarMenu
      v-if="showToolbar"
      variant="preview"
      :content="content"
      :theme-id="themeId"
      @update:theme-id="emit('update:themeId', $event)"
      @insert="emit('insert', $event)"
    />

    <div
      v-if="loading && !previewHtml"
      class="flex flex-1 items-center justify-center bg-white text-sm text-muted"
      role="status"
    >
      渲染预览…
    </div>
    <div
      v-else
      ref="containerRef"
      class="wechat-studio__stage scrollbar-thin"
      data-testid="wechat-preview-content"
    >
      <!-- 主题样式仅挂在预览正文内，避免污染顶栏 -->
      <component :is="'style'">{{ themeStyle }}</component>
      <div
        v-if="previewHtml"
        class="wechat-preview-body mx-auto max-w-[680px] px-4 py-6 pb-12"
        v-html="previewHtml"
      />
      <p v-else class="py-10 text-center text-sm text-muted">输入 Markdown 以预览公众号排版</p>
    </div>
  </div>
</template>

<style scoped>
.wechat-studio {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  /* 顶栏下拉需露出，裁切交给正文 stage */
  overflow: visible;
  background: var(--color-canvas);
}

.wechat-studio__stage {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  background: #fff;
}

.wechat-preview-body {
  font-family: Optima-Regular, Optima, PingFangSC-light, "PingFang SC", Cambria, Georgia, serif;
}
</style>
