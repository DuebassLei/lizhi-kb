<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useDocumentsStore } from "../../stores/documents";
import { useLinksStore } from "../../stores/links";
import { useUiStore } from "../../stores/ui";
import { buildLocalGraph } from "../../composables/useGraphCanvas";
import {
  loadGraphNodePositions,
  saveGraphNodePosition,
  useNodeDrag,
  useSvgPanZoom,
} from "../../composables/useSvgPanZoom";

const documents = useDocumentsStore();
const links = useLinksStore();
const ui = useUiStore();

const containerRef = ref<HTMLElement | null>(null);
const panZoom = useSvgPanZoom(containerRef);
const nodeDrag = useNodeDrag();

const customPositions = ref(loadGraphNodePositions());

const baseGraph = computed(() =>
  buildLocalGraph(
    documents.activeId,
    documents.tree,
    links.outboundMap,
    links.backlinkMap,
  ),
);

const graphNodes = computed(() => {
  return baseGraph.value.nodes.map((n) => {
    const custom = customPositions.value[n.id];
    return {
      ...n,
      x: custom?.x ?? n.x,
      y: custom?.y ?? n.y,
    };
  });
});

watch(
  () => documents.activeId,
  () => {
    customPositions.value = loadGraphNodePositions();
    panZoom.resetView();
  },
);

onMounted(() => {
  void links.ensureIndex(documents.tree);
});

function nodeById(id: string) {
  return graphNodes.value.find((n) => n.id === id);
}

function openNode(id: string) {
  if (nodeDrag.dragging.value) return;
  void documents.openDocument(id);
  ui.setWorkspaceView("edit");
}

function onNodePointerDown(id: string, e: PointerEvent) {
  const node = nodeById(id);
  if (!node) return;
  nodeDrag.startNodeDrag(id, e, node.x, node.y);
}

function onContainerPointerMove(e: PointerEvent) {
  nodeDrag.moveNodeDrag(e, panZoom.scale.value, (id, x, y) => {
    customPositions.value = { ...customPositions.value, [id]: { x, y } };
  });
  panZoom.onPointerMove(e);
}

function onContainerPointerUp(e: PointerEvent) {
  if (nodeDrag.dragging.value) {
    const id = nodeDrag.dragging.value.id;
    const pos = customPositions.value[id];
    if (pos) saveGraphNodePosition(id, pos.x, pos.y);
    nodeDrag.endNodeDrag(e, saveGraphNodePosition, pos?.x ?? 0, pos?.y ?? 0);
  }
  panZoom.onPointerUp(e);
}

const centerTitle = computed(
  () => documents.tree.find((d) => d.id === documents.activeId)?.title ?? "",
);
</script>

<template>
  <div class="relative flex h-full flex-col bg-base" data-testid="local-graph">
    <div v-if="!documents.activeId" class="flex flex-1 items-center justify-center text-sm text-muted">
      请先打开一篇文档以查看局部图谱
    </div>
    <div
      v-else-if="!graphNodes.length"
      class="flex flex-1 items-center justify-center text-sm text-muted"
    >
      暂无链接关系 · 使用 [[文档名]] 创建双链
    </div>
    <div v-else class="flex min-h-0 flex-1 flex-col">
      <div class="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <p class="text-xs text-muted">以「{{ centerTitle }}」为中心 · 2 层深度</p>
        <div class="flex items-center gap-1 text-xs" data-testid="graph-zoom-controls">
          <button
            type="button"
            class="rounded px-2 py-0.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
            title="缩小"
            @click="panZoom.zoomOut()"
          >
            −
          </button>
          <span class="min-w-[3rem] text-center text-muted">{{ Math.round(panZoom.scale.value * 100) }}%</span>
          <button
            type="button"
            class="rounded px-2 py-0.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
            title="放大"
            @click="panZoom.zoomIn()"
          >
            +
          </button>
          <button
            type="button"
            class="rounded px-2 py-0.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
            title="重置视图"
            @click="panZoom.resetView()"
          >
            重置
          </button>
        </div>
      </div>

      <div
        ref="containerRef"
        class="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        @wheel="panZoom.onWheel"
        @pointerdown="panZoom.onPointerDown"
        @pointermove="onContainerPointerMove"
        @pointerup="onContainerPointerUp"
        @pointercancel="onContainerPointerUp"
      >
        <div
          class="absolute left-1/2 top-1/2 origin-center"
          :style="{ transform: `translate(-50%, -50%) ${panZoom.transformStyle.value}` }"
        >
          <svg width="600" height="500" class="overflow-visible">
            <g v-for="edge in baseGraph.edges" :key="`${edge.from}-${edge.to}`">
              <line
                :x1="300 + (nodeById(edge.from)?.x ?? 0)"
                :y1="250 + (nodeById(edge.from)?.y ?? 0)"
                :x2="300 + (nodeById(edge.to)?.x ?? 0)"
                :y2="250 + (nodeById(edge.to)?.y ?? 0)"
                stroke="var(--color-muted)"
                stroke-opacity="0.35"
                stroke-width="1.5"
              />
            </g>
            <g
              v-for="node in graphNodes"
              :key="node.id"
              data-graph-node
              class="cursor-pointer select-none"
              @click="openNode(node.id)"
              @pointerdown="onNodePointerDown(node.id, $event)"
            >
              <circle
                :cx="300 + node.x"
                :cy="250 + node.y"
                :r="node.isCenter ? 16 : 12"
                :fill="node.isCenter ? 'var(--color-paw)' : 'var(--color-panel)'"
                :stroke="node.isCenter ? 'var(--color-paw)' : 'var(--color-link)'"
                stroke-width="2"
              />
              <text
                :x="300 + node.x"
                :y="250 + node.y + 28"
                text-anchor="middle"
                fill="var(--color-text)"
                font-size="11"
              >
                {{ node.title.length > 12 ? node.title.slice(0, 11) + "…" : node.title }}
              </text>
            </g>
          </svg>
        </div>
        <p class="pointer-events-none absolute bottom-3 left-4 text-[10px] text-muted">
          滚轮缩放 · 拖拽空白平移 · 拖拽节点 reposition
        </p>
      </div>
    </div>
  </div>
</template>
