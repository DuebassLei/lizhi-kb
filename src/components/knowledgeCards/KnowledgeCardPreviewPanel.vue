<script setup lang="ts">
import { computed, onUnmounted, ref, toRef } from "vue";
import { LayoutTemplate, Layers } from "@lucide/vue";
import CardRenderer from "./CardRenderer.vue";
import KnowledgeCardToolbarMenu from "./KnowledgeCardToolbarMenu.vue";
import { useKnowledgeCardPipeline } from "../../composables/knowledgeCards/useKnowledgeCardPipeline";
import { useKnowledgeCardsStore } from "../../stores/knowledgeCards";
import { useKnowledgeCardThemeStore } from "../../stores/knowledgeCardTheme";
import {
  buildExportWatermarkLabel,
  loadExportWatermarkOn,
  loadStoredWatermarkNickname,
} from "../../utils/watermarkSetting";

// 画廊主题专用字体（懒加载本面板时才拉）
import "../../styles/knowledge-card-fonts";

const props = defineProps<{
  content: string;
  embedded?: boolean;
}>();

const emit = defineEmits<{
  insert: [snippet: string];
}>();

const cardsStore = useKnowledgeCardsStore();
const themeStore = useKnowledgeCardThemeStore();

const { dispose } = useKnowledgeCardPipeline(toRef(props, "content"));

const containerRef = ref<HTMLElement | null>(null);
const cardRefs = ref<InstanceType<typeof CardRenderer>[]>([]);

defineExpose({ containerRef });

onUnmounted(() => dispose());

/** 预览宽度拉高，避免卡片模式被缩成「小文档预览」 */
const previewWidth = 460;
const scale = computed(() => previewWidth / themeStore.currentFormat.width);
const scaledHeight = computed(() => themeStore.currentFormat.height * scale.value);

const exportWatermark = computed(() => {
  if (!loadExportWatermarkOn()) return undefined;
  return buildExportWatermarkLabel(loadStoredWatermarkNickname());
});

const hasContent = computed(() => Boolean(props.content.trim()));

function setCardRef(el: unknown, index: number) {
  if (el) {
    cardRefs.value[index] = el as InstanceType<typeof CardRenderer>;
  }
}

function getCardEls(): HTMLElement[] {
  return cardRefs.value
    .map((c) => c?.cardEl)
    .filter((el): el is HTMLElement => Boolean(el));
}
</script>

<template>
  <div
    class="kc-studio knowledge-card-preview-panel w-full min-w-0"
    :class="embedded ? '' : 'border-l border-border'"
    data-testid="knowledge-card-preview-panel"
  >
    <KnowledgeCardToolbarMenu
      variant="preview"
      :get-card-els="getCardEls"
      @insert="emit('insert', $event)"
    />

    <div
      v-if="cardsStore.overflowWarning"
      class="kc-studio__banner"
      role="status"
    >
      <Layers class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      部分内容超出卡片高度，已自动缩放适配
    </div>

    <div
      ref="containerRef"
      class="kc-studio__stage scrollbar-thin"
      data-testid="knowledge-card-preview-content"
    >
      <div class="kc-studio__stage-inner">
        <div v-if="!hasContent" class="kc-studio__empty">
          <div class="kc-studio__empty-icon" aria-hidden="true">
            <LayoutTemplate class="h-5 w-5" />
          </div>
          <h3 class="kc-studio__empty-title">开始制作知识卡片</h3>
          <p class="kc-studio__empty-desc">
            在左侧编辑 Markdown，右侧将实时分页预览。用分隔线可强制分页。
          </p>
          <code class="kc-studio__empty-kbd">---</code>
        </div>

        <template v-else>
          <div
            v-for="(card, index) in cardsStore.cards"
            :key="card.id"
            class="kc-card-frame"
            :style="{
              width: `${previewWidth}px`,
              height: `${scaledHeight}px`,
            }"
          >
            <span class="kc-card-frame__badge">
              {{ card.pageNumber }} / {{ card.totalPages }}
            </span>
            <div
              :style="{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }"
            >
              <CardRenderer
                :ref="(el) => setCardRef(el, index)"
                :card="card"
                :theme="themeStore.currentTheme"
                :width="themeStore.currentFormat.width"
                :height="themeStore.currentFormat.height"
                :export-watermark="exportWatermark"
              />
            </div>
          </div>
        </template>
      </div>
    </div>

    <footer class="kc-studio__footer" data-testid="kc-status">
      <span
        class="kc-pill"
        :class="cardsStore.isPaginating ? 'kc-pill--busy' : 'kc-pill--live'"
      >
        {{ cardsStore.isPaginating ? "分页中" : `${cardsStore.cards.length} 张` }}
      </span>
      <span class="kc-pill">{{ themeStore.currentFormat.name }}</span>
      <span class="kc-pill">
        {{ themeStore.currentFormat.width }}×{{ themeStore.currentFormat.height }}
      </span>
      <span class="kc-pill">{{ themeStore.currentTheme.name }}</span>
      <span class="kc-studio__hint">滚动浏览全部卡片 · 导出不影响原文</span>
    </footer>
  </div>
</template>
