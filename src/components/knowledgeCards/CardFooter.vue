<script setup lang="ts">
import { computed } from "vue";
import type { CardTheme } from "../../themes/knowledgeCards/types";

const props = defineProps<{
  theme: CardTheme;
  page: number;
  total: number;
  exportWatermark?: string;
}>();

const watermark = computed(() => {
  if (props.exportWatermark) return props.exportWatermark;
  if (props.theme.decorations.watermarkPosition === "none") return "";
  return props.theme.decorations.watermark ?? "";
});

const watermarkAlign = computed(() => {
  const pos = props.theme.decorations.watermarkPosition;
  if (pos === "footer-right") return "flex-end";
  if (pos === "footer-center") return "center";
  return "flex-start";
});

const progress = computed(() =>
  props.total > 0 ? Math.round((props.page / props.total) * 100) : 0,
);

const dateLabel = computed(() => {
  try {
    return new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
});
</script>

<template>
  <div
    v-if="theme.decorations.footerStyle && theme.decorations.footerStyle !== 'none'"
    class="knowledge-card__footer"
    :class="`knowledge-card__footer--${theme.decorations.footerStyle}`"
  >
    <template v-if="theme.decorations.footerStyle === 'progress-bar'">
      <div class="knowledge-card__progress" aria-hidden="true">
        <span :style="{ width: `${progress}%` }" />
      </div>
      <span>{{ page }} / {{ total }}</span>
    </template>

    <template v-else-if="theme.decorations.footerStyle === 'dots'">
      <span
        v-for="n in total"
        :key="n"
        class="inline-block h-2.5 w-2.5 rounded-full"
        :style="{
          background:
            n === page ? 'var(--card-accent)' : 'color-mix(in srgb, var(--card-text) 25%, transparent)',
        }"
        aria-hidden="true"
      />
      <span class="knowledge-card__footer-spacer" />
      <span v-if="watermark" :style="{ order: -1, marginRight: 'auto' }">{{ watermark }}</span>
    </template>

    <template v-else-if="theme.decorations.footerStyle === 'letter-meta'">
      <div class="knowledge-card__letter-meta">
        <div>
          <div class="knowledge-card__meta-label">DATE</div>
          <div>{{ dateLabel }}</div>
        </div>
        <div>
          <div class="knowledge-card__meta-label">FROM</div>
          <div>{{ watermark || "狸知知识库" }}</div>
        </div>
      </div>
      <span class="knowledge-card__page-pill">{{ page }} / {{ total }}</span>
    </template>

    <template v-else-if="theme.decorations.footerStyle === 'brand'">
      <span class="knowledge-card__brand-line">
        {{ watermark || theme.decorations.brandLabel || "狸知知识卡片" }}
      </span>
      <span>{{ new Date().getFullYear() }} · {{ page }}/{{ total }}</span>
    </template>

    <template v-else>
      <span
        v-if="watermark"
        :style="{
          marginRight: 'auto',
          textAlign: watermarkAlign === 'center' ? 'center' : undefined,
          width: watermarkAlign === 'center' ? '100%' : undefined,
        }"
      >
        {{ watermark }}
      </span>
      <span v-else class="knowledge-card__footer-spacer" />
      <span>{{ page }} / {{ total }}</span>
    </template>
  </div>

  <!-- 复古窗口底部输入条 -->
  <div
    v-if="theme.decorations.chrome === 'window'"
    class="knowledge-card__chatbar"
    aria-hidden="true"
  >
    <span class="knowledge-card__chat-avatar" />
    <span class="knowledge-card__chat-input">{{ dateLabel }} · 第 {{ page }} 页</span>
    <span class="knowledge-card__chat-tools">✦ ♥ ★</span>
  </div>
</template>
