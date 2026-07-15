<script setup lang="ts">
import type { CardTheme } from "../../themes/knowledgeCards/types";

defineProps<{
  theme: CardTheme;
  page: number;
  total: number;
}>();
</script>

<template>
  <!-- 海报社交：页码胶囊 + 品牌角标 -->
  <div
    v-if="theme.decorations.chrome === 'poster'"
    class="kc-chrome kc-chrome--poster"
    aria-hidden="true"
  >
    <span class="kc-chrome__page-chip">{{ page }}/{{ total }}</span>
    <span class="kc-chrome__poster-tag">{{ theme.decorations.brandLabel || theme.name }}</span>
  </div>

  <!-- 信笺：邀请抬头 -->
  <div
    v-else-if="theme.decorations.chrome === 'letter'"
    class="kc-chrome kc-chrome--letter"
    aria-hidden="true"
  >
    <p class="kc-chrome__invite">{{ theme.decorations.windowTitle || "邀您启封" }}</p>
  </div>

  <!-- 复古窗口标题栏 + 菜单 -->
  <div
    v-else-if="theme.decorations.chrome === 'window'"
    class="kc-chrome kc-chrome--window"
    aria-hidden="true"
  >
    <div class="kc-chrome__titlebar">
      <span class="kc-chrome__folder" />
      <span class="kc-chrome__title">{{ theme.decorations.windowTitle || "聊天室" }}</span>
      <span class="kc-chrome__win-btns">
        <i /><i /><i />
      </span>
    </div>
    <div class="kc-chrome__menubar">
      <span>File</span><span>Edit</span><span>View</span><span>Help</span>
    </div>
  </div>

  <!-- Nebula：红绿灯 + 品牌 -->
  <div
    v-else-if="theme.decorations.chrome === 'nebula'"
    class="kc-chrome kc-chrome--nebula"
    aria-hidden="true"
  >
    <span class="kc-chrome__traffic">
      <i class="r" /><i class="y" /><i class="g" />
    </span>
    <span class="kc-chrome__brand">{{ theme.decorations.brandLabel || "LIZHI NEBULA" }}</span>
  </div>

  <!-- Tech：顶部色条已由 CSS 处理，这里放工具图标行 -->
  <div
    v-else-if="theme.decorations.chrome === 'tech'"
    class="kc-chrome kc-chrome--tech"
    aria-hidden="true"
  >
    <span class="kc-chrome__tech-icon" title="code">⌘</span>
    <span class="kc-chrome__brand-muted">{{ theme.decorations.brandLabel || "TECH NOTES" }}</span>
  </div>
</template>

<style scoped>
.kc-chrome--poster {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
}
.kc-chrome__page-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.4em;
  padding: 0.28em 0.7em;
  border-radius: 999px;
  background: color-mix(in srgb, var(--card-accent) 16%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--card-accent) 42%, transparent);
  color: var(--card-accent);
  font-size: 0.58em;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.kc-chrome__poster-tag {
  font-size: 0.5em;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--card-text) 42%, transparent);
}

.kc-chrome--letter {
  text-align: center;
  margin-bottom: 8px;
}
.kc-chrome__invite {
  margin: 0;
  font-family: var(--card-heading-font);
  font-size: 1.35em;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--card-heading);
}

.kc-chrome--window {
  margin: calc(-1 * var(--card-padding-top)) calc(-1 * var(--card-padding-right))
    20px calc(-1 * var(--card-padding-left));
}
.kc-chrome__titlebar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: var(--card-accent);
  color: #fff;
  font-size: 0.72em;
  font-weight: 700;
}
.kc-chrome__folder {
  width: 22px;
  height: 16px;
  border: 2px solid #fff;
  border-radius: 2px 2px 0 0;
  position: relative;
  opacity: 0.95;
}
.kc-chrome__folder::before {
  content: "";
  position: absolute;
  top: -6px;
  left: 0;
  width: 10px;
  height: 6px;
  border: 2px solid #fff;
  border-bottom: none;
  border-radius: 2px 2px 0 0;
}
.kc-chrome__title {
  flex: 1;
}
.kc-chrome__win-btns {
  display: flex;
  gap: 8px;
}
.kc-chrome__win-btns i {
  display: block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.85);
  border-radius: 2px;
}
.kc-chrome__menubar {
  display: flex;
  gap: 20px;
  padding: 8px 18px;
  background: color-mix(in srgb, var(--card-accent) 18%, #fff);
  color: color-mix(in srgb, var(--card-accent) 70%, #333);
  font-size: 0.55em;
  font-weight: 600;
}

.kc-chrome--nebula {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}
.kc-chrome__traffic {
  display: flex;
  gap: 10px;
}
.kc-chrome__traffic i {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: block;
}
.kc-chrome__traffic .r {
  background: #ff5f57;
}
.kc-chrome__traffic .y {
  background: #febc2e;
}
.kc-chrome__traffic .g {
  background: #28c840;
}
.kc-chrome__brand {
  font-size: 0.48em;
  letter-spacing: 0.14em;
  color: color-mix(in srgb, var(--card-text) 45%, transparent);
  font-weight: 600;
}

.kc-chrome--tech {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.kc-chrome__tech-icon {
  font-size: 0.7em;
  opacity: 0.55;
}
.kc-chrome__brand-muted {
  font-size: 0.48em;
  letter-spacing: 0.12em;
  opacity: 0.45;
  font-weight: 700;
}
</style>
