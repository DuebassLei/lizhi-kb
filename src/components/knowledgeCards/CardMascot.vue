<script setup lang="ts">
defineProps<{
  kind: "none" | "stamp" | "pixel";
  label?: string;
}>();
</script>

<template>
  <div v-if="kind === 'stamp'" class="kc-mascot kc-mascot--stamp" aria-hidden="true">
    <div class="kc-mascot__stamp-ring">
      <span class="kc-mascot__stamp-stars">★★★</span>
      <span class="kc-mascot__stamp-word">{{ label || "POST" }}</span>
      <span class="kc-mascot__stamp-stars">★★★</span>
    </div>
  </div>

  <div v-else-if="kind === 'pixel'" class="kc-mascot kc-mascot--pixel" aria-hidden="true">
    <!-- 像素小怪：纯 CSS 方块，无外部图 -->
    <svg width="72" height="64" viewBox="0 0 18 16" shape-rendering="crispEdges">
      <rect x="5" y="1" width="8" height="2" fill="var(--card-accent)" />
      <rect x="3" y="3" width="12" height="2" fill="var(--card-accent)" />
      <rect x="1" y="5" width="16" height="6" fill="var(--card-accent)" />
      <rect x="3" y="6" width="2" height="2" fill="#fff" />
      <rect x="13" y="6" width="2" height="2" fill="#fff" />
      <rect x="3" y="7" width="1" height="1" fill="#1a1a1a" />
      <rect x="13" y="7" width="1" height="1" fill="#1a1a1a" />
      <rect x="5" y="11" width="2" height="2" fill="var(--card-accent)" />
      <rect x="11" y="11" width="2" height="2" fill="var(--card-accent)" />
      <rect x="1" y="13" width="2" height="2" fill="var(--card-accent)" />
      <rect x="15" y="13" width="2" height="2" fill="var(--card-accent)" />
    </svg>
  </div>
</template>

<style scoped>
.kc-mascot {
  position: absolute;
  pointer-events: none;
  z-index: 2;
}
.kc-mascot--stamp {
  right: 48px;
  bottom: 72px;
  transform: rotate(-18deg);
  opacity: 0.72;
}
.kc-mascot__stamp-ring {
  width: 120px;
  height: 120px;
  border: 4px double var(--card-accent);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--card-accent);
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 700;
  letter-spacing: 0.08em;
  background: color-mix(in srgb, var(--card-bg) 70%, transparent);
}
.kc-mascot__stamp-word {
  font-size: 22px;
  line-height: 1.2;
}
.kc-mascot__stamp-stars {
  font-size: 11px;
  opacity: 0.85;
}

.kc-mascot--pixel {
  right: 40px;
  bottom: 48px;
  opacity: 0.9;
}
</style>
