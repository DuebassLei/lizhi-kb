<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useUiStore } from "../../stores/ui";
import { useWatermark } from "../../composables/useWatermark";

const ui = useUiStore();
const route = useRoute();
const canvasRef = ref<HTMLCanvasElement | null>(null);

useWatermark(canvasRef);

/** 密码输入页不覆盖水印，避免干扰输入与侧录风险 */
const visible = computed(
  () =>
    ui.watermarkOn &&
    route.name !== "unlock" &&
    route.name !== "welcome",
);
</script>

<template>
  <canvas
    v-if="visible"
    ref="canvasRef"
    class="pointer-events-none fixed inset-0 z-40"
    aria-hidden="true"
  />
</template>
