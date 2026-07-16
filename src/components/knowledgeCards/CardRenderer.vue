<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { Card } from "../../types/knowledgeCards";
import type { CardTheme } from "../../themes/knowledgeCards/types";
import { themeToCssVars } from "../../themes/knowledgeCards/types";
import { sanitizeThemeCss } from "../../utils/knowledgeCards/sanitizeThemeCss";
import CornerDecoration from "./CornerDecoration.vue";
import CardChrome from "./CardChrome.vue";
import CardHeader from "./CardHeader.vue";
import CardFooter from "./CardFooter.vue";
import CardMascot from "./CardMascot.vue";

const props = defineProps<{
  card: Card;
  theme: CardTheme;
  width: number;
  height: number;
  exportWatermark?: string;
}>();

const cardEl = ref<HTMLElement | null>(null);
const themeStyleEl = ref<HTMLStyleElement | { $el?: HTMLStyleElement } | null>(null);
defineExpose({ cardEl });

const corners = computed(() => props.theme.decorations.corners ?? "none");
const mascot = computed(() => props.theme.decorations.mascot ?? "none");
const skin = computed(() => props.theme.decorations.skin ?? "plain");

const heroEnabled = computed(() => {
  const mode = props.theme.decorations.heroMode;
  if (mode === "off") return false;
  if (mode === "first-h1") return true;
  return false;
});

const hasHero = computed(() => {
  if (!heroEnabled.value || props.card.pageNumber !== 1) return false;
  const first = props.card.blocks.find((b) => b.type !== "page-break");
  return Boolean(first && first.type === "heading" && (first.level ?? 1) === 1);
});

const hasHeadingGradient = computed(() => {
  const g = props.theme.colors.headingGradient?.trim();
  return Boolean(g && g !== "none");
});

const overlayWatermark = computed(() => {
  const w = props.theme.decorations.watermark?.trim();
  if (!w) return "";
  if (props.theme.decorations.watermarkPosition?.startsWith("footer")) {
    return props.theme.decorations.brandLabel || w;
  }
  return w;
});

const styleVars = computed(() => {
  const vars = themeToCssVars(props.theme);
  return {
    ...vars,
    "--card-native-width": `${props.width}px`,
    "--card-native-height": `${props.height}px`,
    width: `${props.width}px`,
    height: `${props.height}px`,
    backgroundImage: props.theme.decorations.backgroundImage
      ? `url(${props.theme.decorations.backgroundImage})`
      : undefined,
    backgroundSize: props.theme.decorations.backgroundMode ?? "cover",
  };
});

const hasOverflow = computed(() =>
  props.card.blocks.some((b) => b.scale !== undefined && b.scale < 1),
);

function isHeroBlock(blockId: string): boolean {
  if (!hasHero.value) return false;
  const first = props.card.blocks.find((b) => b.type !== "page-break");
  return Boolean(first && first.id === blockId);
}

/** 首个段落块（用于对白泡 / deck 等；不能用 :first-of-type，块全是 div） */
function isLeadParagraph(blockId: string): boolean {
  const first = props.card.blocks.find((b) => b.type === "paragraph");
  return Boolean(first && first.id === blockId);
}

const scopedCustomCss = computed(() => {
  const raw = props.theme.customCSS?.trim();
  if (!raw) return "";
  const safe = sanitizeThemeCss(raw);
  const themeRoot = `.knowledge-card.theme-${props.theme.id}`;
  return safe.replace(/(^|})\s*([^{}@]+)\s*{/g, (_, brace: string, sel: string) => {
    const parts = sel
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return `${brace} {`;
    const scoped = parts
      .map((t) => {
        if (t.startsWith(".knowledge-card")) {
          return `${themeRoot}${t.slice(".knowledge-card".length)}`;
        }
        if (t.startsWith(".kc-") || t.startsWith(".card-block")) {
          return `${themeRoot} ${t}`;
        }
        return `${themeRoot} ${t}`;
      })
      .join(", ");
    return `${brace} ${scoped} {`;
  });
});

function resolveStyleNode(): HTMLStyleElement | null {
  const el = themeStyleEl.value;
  if (!el) return null;
  if (el instanceof HTMLStyleElement) return el;
  const maybe = (el as { $el?: unknown }).$el;
  return maybe instanceof HTMLStyleElement ? maybe : null;
}

function applyThemeStyle(css: string) {
  const node = resolveStyleNode();
  if (!node) return;
  if (node.textContent !== css) node.textContent = css;
}

watch(scopedCustomCss, (css) => applyThemeStyle(css), { flush: "post" });
watch(
  () => props.theme.id,
  () => applyThemeStyle(scopedCustomCss.value),
  { flush: "post" },
);
onMounted(() => applyThemeStyle(scopedCustomCss.value));
</script>

<template>
  <div
    ref="cardEl"
    class="knowledge-card"
    :class="[
      `theme-${theme.id}`,
      `skin-${skin}`,
      `footer-${theme.decorations.footerStyle ?? 'none'}`,
      `corner-${corners}`,
      theme.border.doubleInset ? 'has-double-inset' : '',
      theme.decorations.topAccentBar ? 'has-top-bar' : '',
      hasHero ? 'has-hero' : '',
      hasHeadingGradient ? 'has-heading-gradient' : '',
    ]"
    :style="styleVars"
    data-testid="knowledge-card"
  >
    <component :is="'style'" ref="themeStyleEl" />

    <CardChrome :theme="theme" :page="card.pageNumber" :total="card.totalPages" />

    <div class="knowledge-card__shell">
      <CornerDecoration :type="corners" />
      <CardMascot :kind="mascot" :label="theme.decorations.brandLabel" />
      <span v-if="hasOverflow" class="knowledge-card__scale-warn">内容已缩放适配</span>
      <span v-if="overlayWatermark" class="knowledge-card__watermark" aria-hidden="true">
        {{ overlayWatermark }}
      </span>

      <CardHeader :theme="theme" />

      <div class="knowledge-card-content" :class="{ 'is-centered': theme.typography.textAlign === 'center' }">
        <div
          v-for="block in card.blocks"
          :key="block.id"
          class="card-block"
          :class="[
            `block-${block.type}`,
            isHeroBlock(block.id) ? 'is-hero' : '',
            isLeadParagraph(block.id) ? 'is-lead' : '',
          ]"
          :style="
            block.scale !== undefined && block.scale < 1
              ? { transform: `scale(${block.scale})`, transformOrigin: 'top left' }
              : undefined
          "
          v-html="block.html"
        />
      </div>

      <CardFooter
        :theme="theme"
        :page="card.pageNumber"
        :total="card.totalPages"
        :export-watermark="exportWatermark"
      />
    </div>
  </div>
</template>
