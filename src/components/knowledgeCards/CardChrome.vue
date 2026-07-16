<script setup lang="ts">
import { computed } from "vue";
import { BUILTIN_THEME_IDS, type CardTheme } from "../../themes/knowledgeCards";

const props = defineProps<{
  theme: CardTheme;
  page: number;
  total: number;
}>();

/** 内置 id，或自「内置-custom-xxx」副本解析出的画廊基底 */
const ornamentId = computed(() => {
  const id = props.theme.id;
  if (BUILTIN_THEME_IDS.includes(id)) return id;
  const hit = BUILTIN_THEME_IDS.find(
    (bid) => id === bid || id.startsWith(`${bid}-custom-`),
  );
  return hit ?? "";
});
</script>

<template>
  <!-- 画廊结构装饰：无法单靠伪元素表达的 DOM（按 theme 基底 id） -->
  <div
    v-if="ornamentId"
    class="kc-ornament"
    :data-ornament="ornamentId"
    aria-hidden="true"
  >
    <template v-if="ornamentId === 'cartoon-comic'">
      <span class="kc-ornament__halftone" />
      <span class="kc-ornament__burst">哇!</span>
      <span class="kc-ornament__tag">漫画卡</span>
    </template>

    <template v-else-if="ornamentId === 'cartoon-sticker'">
      <span class="kc-ornament__tag">手帐卡</span>
    </template>

    <template v-else-if="ornamentId === 'cartoon-pixel'">
      <div class="kc-ornament__hp">
        <span>HP</span>
        <div class="kc-ornament__bar"><i /></div>
      </div>
      <div class="kc-ornament__quest">
        <span>LIZHI QUEST</span>
        <span>SAVE {{ String(page).padStart(2, "0") }}</span>
      </div>
    </template>

    <template v-else-if="ornamentId === 'pro-editorial'">
      <div class="kc-ornament__mast">
        <span>狸知月刊</span>
        <span>Vol. 07 · Essay</span>
      </div>
    </template>

    <template v-else-if="ornamentId === 'pro-brief'">
      <div class="kc-ornament__tag">BRIEFING</div>
      <div class="kc-ornament__kpis">
        <div class="kc-ornament__kpi"><b>3:4</b><span>社交主比例</span></div>
        <div class="kc-ornament__kpi"><b>×N</b><span>主题皮肤</span></div>
      </div>
    </template>

    <template v-else-if="ornamentId === 'pro-lecture'">
      <div class="kc-ornament__margin-num">LECTURE {{ String(page).padStart(2, "0") }}</div>
      <div class="kc-ornament__fn">注：好的卡片主题，是一套完整的视觉语法。</div>
    </template>

    <template v-else-if="ornamentId === 'fun-chalk'">
      <span class="kc-ornament__doodle" />
    </template>

    <template v-else-if="ornamentId === 'fun-soda'">
      <span class="kc-ornament__pop">POP!</span>
    </template>

    <template v-else-if="ornamentId === 'fun-boardgame'">
      <div class="kc-ornament__box-title">
        <span>知识卡片</span>
        <span class="kc-ornament__dice">6</span>
      </div>
    </template>

    <template v-else-if="ornamentId === 'cute-memo'">
      <span class="kc-ornament__tag">MEMO</span>
    </template>

    <template v-else-if="ornamentId === 'cute-party'">
      <div class="kc-ornament__balloons">
        <i /><i /><i />
      </div>
    </template>

    <template v-else-if="ornamentId === 'tech-cli'">
      <div class="kc-ornament__prompt">~/notes › cat card.md</div>
      <div class="kc-ornament__ready">
        ready<span class="kc-ornament__cursor" />
      </div>
    </template>

    <template v-else-if="ornamentId === 'tech-hud'">
      <i class="kc-ornament__corner kc-ornament__corner--tl" />
      <i class="kc-ornament__corner kc-ornament__corner--tr" />
      <i class="kc-ornament__corner kc-ornament__corner--bl" />
      <i class="kc-ornament__corner kc-ornament__corner--br" />
      <div class="kc-ornament__status">
        <span>SYS.OK</span>
        <span>RATIO 3:4</span>
        <span>MODE CARD</span>
      </div>
    </template>
  </div>
</template>
