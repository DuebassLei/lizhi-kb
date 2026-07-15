<script setup lang="ts">
import { computed, ref } from "vue";
import type { MubuTreeNode } from "../../types/mubu";
import { mubuToHeadingTree } from "../../utils/mubuTree";
import { layoutMindmapTree } from "../../composables/mindmap/useMindmapLayout";
import { useSvgPanZoom } from "../../composables/useSvgPanZoom";
import MindmapTopicLabel from "../mindmap/MindmapTopicLabel.vue";
import "../../styles/mindmap.css";
import "../../styles/mubu.css";

const props = defineProps<{
  root: MubuTreeNode;
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
  toggleCollapse: [id: string];
}>();

const containerRef = ref<HTMLElement | null>(null);
const panZoom = useSvgPanZoom(containerRef);

const collapsedIds = computed(() => {
  const s = new Set<string>();
  const walk = (n: MubuTreeNode) => {
    if (n.collapsed) s.add(n.id);
    n.children.forEach(walk);
  };
  walk(props.root);
  return s;
});

const layout = computed(() =>
  layoutMindmapTree(mubuToHeadingTree(props.root), collapsedIds.value, {
    linkShape: "curve",
  }),
);

function depthClass(node: (typeof layout.value.nodes)[number]) {
  if (node.chrome === "root") return "mm-node--root";
  if (node.chrome === "box") return "mm-node--box mm-node--d1";
  const d = Math.min(6, Math.max(2, node.depth));
  return `mm-node--line mm-node--d${d}`;
}
</script>

<template>
  <div
    class="mm-view mubu-map relative flex h-full flex-col"
    data-theme="dusk"
    data-node-shape="rounded"
    data-testid="mubu-map"
  >
    <div
      ref="containerRef"
      class="mm-canvas relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
      @wheel="panZoom.onWheel"
      @pointerdown="panZoom.onPointerDown"
      @pointermove="panZoom.onPointerMove"
      @pointerup="panZoom.onPointerUp"
      @pointercancel="panZoom.onPointerUp"
    >
      <div
        class="absolute left-1/2 top-1/2 origin-center"
        :style="{ transform: `translate(-50%, -50%) ${panZoom.transformStyle.value}` }"
      >
        <svg :width="layout.width" :height="layout.height" class="overflow-visible">
          <path
            v-for="link in layout.links"
            :key="link.id"
            class="mm-link"
            :d="link.path"
          />
          <g
            v-for="node in layout.nodes"
            :key="node.id"
            class="mm-node-g"
            :transform="`translate(${node.x}, ${node.y})`"
            @click="emit('select', node.id)"
          >
            <foreignObject :width="node.width" :height="node.height">
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                class="mm-node"
                :class="[
                  depthClass(node),
                  selectedId === node.id ? 'mm-node--selected' : '',
                ]"
              >
                <MindmapTopicLabel :text="node.text" :centered="node.isRoot" />
              </div>
            </foreignObject>
            <g
              v-if="node.childCount && node.collapsed"
              class="mm-badge"
              :transform="`translate(${node.width + 2}, ${node.chrome === 'line' ? node.titleH - 1 : node.height / 2})`"
              @click.stop="emit('toggleCollapse', node.id)"
            >
              <circle class="mm-badge__bg" r="11" />
              <text class="mm-badge__num" text-anchor="middle" y="3.5">{{ node.childCount }}</text>
            </g>
          </g>
        </svg>
      </div>
      <div class="mm-toolbar__actions absolute bottom-3 right-3 z-10 flex gap-1">
        <button type="button" class="mm-btn" @click="panZoom.zoomOut()">−</button>
        <span class="mm-zoom">{{ Math.round(panZoom.scale.value * 100) }}%</span>
        <button type="button" class="mm-btn" @click="panZoom.zoomIn()">+</button>
        <button type="button" class="mm-btn" @click="panZoom.resetView()">适应</button>
      </div>
    </div>
  </div>
</template>
