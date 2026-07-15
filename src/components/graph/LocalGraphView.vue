<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDocumentsStore } from "../../stores/documents";
import { useUiStore } from "../../stores/ui";
import { fetchLocalGraph, type GraphPayload } from "../../services/knowledgeIndexService";
import { isTauriRuntime } from "../../services/vaultService";
import { buildLocalGraph } from "../../composables/useGraphCanvas";
import { useLinksStore } from "../../stores/links";
import {
  loadGraphNodePositions,
  saveGraphNodePosition,
  useNodeDrag,
  useSvgPanZoom,
} from "../../composables/useSvgPanZoom";
import "../../styles/graph.css";

const CX = 300;
const CY = 250;

const documents = useDocumentsStore();
const links = useLinksStore();
const ui = useUiStore();

const containerRef = ref<HTMLElement | null>(null);
const panZoom = useSvgPanZoom(containerRef);
const nodeDrag = useNodeDrag();

const customPositions = ref(loadGraphNodePositions());
const remoteGraph = ref<GraphPayload | null>(null);
const graphLoading = ref(false);
const hoveredId = ref<string | null>(null);
let graphSeq = 0;

async function loadGraph(centerId: string | null) {
  if (!centerId) {
    remoteGraph.value = null;
    return;
  }

  const seq = ++graphSeq;
  graphLoading.value = true;
  try {
    if (isTauriRuntime()) {
      remoteGraph.value = await fetchLocalGraph(centerId, 2);
      if (seq !== graphSeq) return;
      return;
    }

    await links.ensureIndex(documents.tree);
    if (seq !== graphSeq) return;
    remoteGraph.value = null;
  } finally {
    if (seq === graphSeq) graphLoading.value = false;
  }
}

const baseGraph = computed(() => {
  if (remoteGraph.value) {
    return {
      nodes: remoteGraph.value.nodes,
      edges: remoteGraph.value.edges,
    };
  }

  return buildLocalGraph(
    documents.activeId,
    documents.tree,
    links.outboundMap,
    links.backlinkMap,
  );
});

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

const neighborIds = computed(() => {
  const id = hoveredId.value;
  if (!id) return null;
  const set = new Set<string>([id]);
  for (const e of baseGraph.value.edges) {
    if (e.from === id) set.add(e.to);
    if (e.to === id) set.add(e.from);
  }
  return set;
});

watch(
  () => documents.activeId,
  (id) => {
    customPositions.value = loadGraphNodePositions();
    hoveredId.value = null;
    panZoom.resetView();
    void loadGraph(id);
  },
  { immediate: true },
);

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

function truncTitle(title: string) {
  return title.length > 12 ? `${title.slice(0, 11)}…` : title;
}

function edgeClass(from: string, to: string) {
  const hub = nodeById(from)?.isCenter || nodeById(to)?.isCenter;
  const neighbors = neighborIds.value;
  if (!neighbors) return hub ? "lg-edge lg-edge--hub" : "lg-edge";
  const lit = neighbors.has(from) && neighbors.has(to);
  if (lit) return "lg-edge lg-edge--lit";
  return "lg-edge lg-edge--dim";
}

function nodeRadius(node: { isCenter: boolean; depth: number }) {
  if (node.isCenter) return 16;
  if (node.depth === 1) return 13;
  return 11;
}

const centerTitle = computed(
  () => documents.tree.find((d) => d.id === documents.activeId)?.title ?? "",
);
</script>

<template>
  <div class="lg-view relative flex h-full flex-col" data-testid="local-graph">
    <div v-if="!documents.activeId" class="flex flex-1 items-center justify-center">
      <p class="lg-empty-msg">请先打开一篇文档以查看局部图谱</p>
    </div>
    <div v-else-if="graphLoading" class="flex flex-1 items-center justify-center">
      <p class="lg-empty-msg">正在加载图谱…</p>
    </div>
    <div v-else-if="!graphNodes.length" class="flex flex-1 items-center justify-center">
      <p class="lg-empty-msg">暂无链接关系 · 使用 [[文档名]] 创建双链</p>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col">
      <div class="lg-toolbar flex shrink-0 items-center justify-between gap-3 px-4 py-2">
        <div class="lg-toolbar__meta min-w-0">
          <p class="lg-toolbar__title" data-testid="graph-edit-hint">
            以「{{ centerTitle }}」为中心 · 2 层深度 · 点击节点打开文档
          </p>
        </div>
        <div class="lg-toolbar__actions" data-testid="graph-zoom-controls">
          <button type="button" class="lg-btn" title="缩小" @click="panZoom.zoomOut()">−</button>
          <span class="lg-zoom">{{ Math.round(panZoom.scale.value * 100) }}%</span>
          <button type="button" class="lg-btn" title="放大" @click="panZoom.zoomIn()">+</button>
          <button type="button" class="lg-btn" title="重置视图" @click="panZoom.resetView()">
            重置
          </button>
        </div>
      </div>

      <div
        ref="containerRef"
        class="lg-canvas relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
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
          <svg
            width="600"
            height="500"
            class="overflow-visible"
            role="img"
            :aria-label="`「${centerTitle}」的局部知识图谱`"
          >
            <g class="lg-edges">
              <line
                v-for="edge in baseGraph.edges"
                :key="`${edge.from}-${edge.to}`"
                :x1="CX + (nodeById(edge.from)?.x ?? 0)"
                :y1="CY + (nodeById(edge.from)?.y ?? 0)"
                :x2="CX + (nodeById(edge.to)?.x ?? 0)"
                :y2="CY + (nodeById(edge.to)?.y ?? 0)"
                :class="edgeClass(edge.from, edge.to)"
              />
            </g>

            <g
              v-for="node in graphNodes"
              :key="node.id"
              data-graph-node
              class="lg-node-g"
              :class="{ 'lg-node-g--hot': hoveredId === node.id }"
              tabindex="0"
              role="button"
              :aria-label="node.title"
              @click="openNode(node.id)"
              @keydown.enter.prevent="openNode(node.id)"
              @keydown.space.prevent="openNode(node.id)"
              @pointerdown="onNodePointerDown(node.id, $event)"
              @pointerenter="hoveredId = node.id"
              @pointerleave="hoveredId = null"
              @focus="hoveredId = node.id"
              @blur="hoveredId = null"
            >
              <circle
                :cx="CX + node.x"
                :cy="CY + node.y"
                :r="nodeRadius(node)"
                class="lg-node"
                :class="{ 'lg-node--center': node.isCenter }"
              />
              <text
                :x="CX + node.x"
                :y="CY + node.y + nodeRadius(node) + 14"
                text-anchor="middle"
                class="lg-label"
                :class="{ 'lg-label--center': node.isCenter }"
              >
                {{ truncTitle(node.title) }}
              </text>
            </g>
          </svg>
        </div>
        <p class="lg-hint">滚轮缩放 · 拖空白平移 · 拖节点 reposition</p>
      </div>
    </div>
  </div>
</template>
