<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDocumentsStore } from "../../stores/documents";
import { useUiStore } from "../../stores/ui";
import { buildHeadingTree } from "../../utils/headings";
import {
  layoutMindMap,
  mindMapTreeEdgePath,
  truncateLabel,
  type MindMapLayoutEdge,
  type MindMapLayoutNode,
} from "../../composables/useMindMapLayout";
import { useSvgPanZoom } from "../../composables/useSvgPanZoom";
import { exportMindMapPng, exportMindMapSvg } from "../../utils/exportMindMap";
import {
  edgeStrokeWidth,
  getBranchTheme,
  getMindMapStyle,
  levelBadge,
  MIND_MAP_STYLE_OPTIONS,
  nodeSizeForLevel,
  type MindMapStyleId,
} from "../../utils/mindMapTheme";
import { loadStoredMindMapStyle, saveMindMapStyle } from "../../utils/mindMapStyleSetting";

const documents = useDocumentsStore();
const ui = useUiStore();

const containerRef = ref<HTMLElement | null>(null);
const hoveredId = ref<string | null>(null);
const styleId = ref<MindMapStyleId>(loadStoredMindMapStyle());
const exporting = ref<"svg" | "png" | null>(null);
const panZoom = useSvgPanZoom(containerRef);

const currentStyle = computed(() => getMindMapStyle(styleId.value));

const canvasBgStyle = computed(() => ({
  backgroundColor: currentStyle.value.bgColor,
  backgroundImage: `radial-gradient(${currentStyle.value.dotColor} 0.6px, transparent 0.6px)`,
  backgroundSize: "20px 20px",
}));

const docTitle = computed(
  () => documents.tree.find((d) => d.id === documents.activeId)?.title ?? "无标题",
);

const headingTree = computed(() => buildHeadingTree(docTitle.value, documents.content));

const layout = computed(() => layoutMindMap(headingTree.value));

const branchCount = computed(() => {
  const root = layout.value.nodes.find((n) => n.isRoot);
  if (!root) return 0;
  return layout.value.edges.filter((e) => e.from === root.id).length;
});

function nodeById(id: string): MindMapLayoutNode | undefined {
  return layout.value.nodes.find((n) => n.id === id);
}

function themeFor(node: MindMapLayoutNode) {
  return getBranchTheme(styleId.value, node.branchIndex, node.isRoot);
}

function sizeFor(node: MindMapLayoutNode) {
  return nodeSizeForLevel(node.level, node.isRoot);
}

function edgePath(edge: MindMapLayoutEdge): string {
  const from = nodeById(edge.from);
  const to = nodeById(edge.to);
  if (!from || !to) return "";
  return mindMapTreeEdgePath(from, to, sizeFor(from).w / 2, sizeFor(to).w / 2);
}

function edgeTheme(edge: MindMapLayoutEdge) {
  const to = nodeById(edge.to);
  if (!to) return getBranchTheme(styleId.value, 0, false);
  return getBranchTheme(styleId.value, to.branchIndex, false);
}

function setStyle(id: MindMapStyleId) {
  styleId.value = id;
  saveMindMapStyle(id);
}

watch(
  () => [documents.activeId, documents.content] as const,
  () => panZoom.resetView(),
);

function jumpToHeading(headingText?: string) {
  ui.setWorkspaceView("edit");
  documents.persistSession();
  if (headingText) {
    ui.requestHeadingScroll(headingText);
  }
}

function onNodeClick(nodeId: string) {
  const node = nodeById(nodeId);
  if (!node) return;
  if (node.isRoot) {
    jumpToHeading();
    return;
  }
  jumpToHeading(node.text);
}

async function onExport(format: "svg" | "png") {
  if (exporting.value || layout.value.nodes.length === 0) return;
  exporting.value = format;
  try {
    const ok =
      format === "svg"
        ? await exportMindMapSvg(layout.value, styleId.value, docTitle.value)
        : await exportMindMapPng(layout.value, styleId.value, docTitle.value);
    if (!ok) return;
  } catch (e) {
    window.alert(e instanceof Error ? e.message : "导出失败，请重试");
  } finally {
    exporting.value = null;
  }
}
</script>

<template>
  <div class="relative flex h-full flex-col bg-base" data-testid="mind-map">
    <div v-if="!documents.activeId" class="flex flex-1 items-center justify-center text-sm text-muted">
      请先打开一篇文档以查看思维导图
    </div>
    <div v-else class="flex min-h-0 flex-1 flex-col">
      <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div class="flex flex-wrap items-center gap-3">
          <p class="text-xs text-muted">
            「{{ docTitle }}」· {{ layout.nodes.length }} 个节点
            <span v-if="branchCount > 0" class="text-text-secondary">· 左右 {{ branchCount }} 条主分支</span>
          </p>
          <div
            v-if="branchCount > 0"
            class="hidden items-center gap-1.5 sm:flex"
            aria-hidden="true"
          >
            <span
              v-for="i in Math.min(branchCount, 6)"
              :key="i"
              class="h-2 w-2 rounded-full"
              :style="{ backgroundColor: getBranchTheme(styleId, i - 1, false).stroke }"
            />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div
            class="flex items-center gap-0.5 rounded-md border border-border bg-surface-1 p-0.5"
            role="group"
            aria-label="思维导图风格"
            data-testid="mindmap-style-switcher"
          >
            <button
              v-for="opt in MIND_MAP_STYLE_OPTIONS"
              :key="opt.id"
              type="button"
              class="focus-ring rounded px-2 py-0.5 text-[11px] transition-colors"
              :class="
                styleId === opt.id
                  ? 'bg-surface-2 font-medium text-[var(--color-text)]'
                  : 'text-muted hover:bg-surface-2/60 hover:text-[var(--color-text)]'
              "
              :title="`切换为${opt.label}风格`"
              @click="setStyle(opt.id)"
            >
              {{ opt.label }}
            </button>
          </div>
          <div class="flex items-center gap-1 text-xs" data-testid="mindmap-export-controls">
            <button
              type="button"
              class="focus-ring rounded border border-border px-2 py-0.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)] disabled:opacity-50"
              title="导出 SVG"
              :disabled="!!exporting || layout.nodes.length === 0"
              @click="onExport('svg')"
            >
              {{ exporting === 'svg' ? '导出中…' : 'SVG' }}
            </button>
            <button
              type="button"
              class="focus-ring rounded border border-border px-2 py-0.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)] disabled:opacity-50"
              title="导出 PNG"
              :disabled="!!exporting || layout.nodes.length === 0"
              @click="onExport('png')"
            >
              {{ exporting === 'png' ? '导出中…' : 'PNG' }}
            </button>
          </div>
          <div class="flex items-center gap-1 text-xs" data-testid="mindmap-zoom-controls">
            <button
              type="button"
              class="focus-ring rounded px-2 py-0.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
              title="缩小"
              @click="panZoom.zoomOut()"
            >
              −
            </button>
            <span class="min-w-[3rem] text-center text-muted">{{ Math.round(panZoom.scale.value * 100) }}%</span>
            <button
              type="button"
              class="focus-ring rounded px-2 py-0.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
              title="放大"
              @click="panZoom.zoomIn()"
            >
              +
            </button>
            <button
              type="button"
              class="focus-ring rounded px-2 py-0.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
              title="重置视图"
              @click="panZoom.resetView()"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      <div
        ref="containerRef"
        class="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        :style="canvasBgStyle"
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
            <defs>
              <filter id="mindmap-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g v-for="edge in layout.edges" :key="`${edge.from}-${edge.to}`">
              <path
                :d="edgePath(edge)"
                fill="none"
                :stroke="edgeTheme(edge).edge"
                :stroke-width="edgeStrokeWidth(nodeById(edge.from)?.depth ?? 0)"
                stroke-opacity="0.55"
                stroke-linecap="round"
              />
            </g>

            <g
              v-for="node in layout.nodes"
              :key="node.id"
              data-mindmap-node
              class="cursor-pointer select-none transition-opacity duration-150"
              :class="hoveredId && hoveredId !== node.id ? 'opacity-80' : ''"
              role="button"
              tabindex="0"
              :aria-label="node.isRoot ? `文档根节点：${node.text}` : `跳转到标题：${node.text}`"
              @click="onNodeClick(node.id)"
              @keydown.enter="onNodeClick(node.id)"
              @pointerenter="hoveredId = node.id"
              @pointerleave="hoveredId = null"
            >
              <rect
                :x="node.x - sizeFor(node).w / 2"
                :y="node.y - sizeFor(node).h / 2"
                :width="sizeFor(node).w"
                :height="sizeFor(node).h"
                :rx="sizeFor(node).rx"
                :fill="node.isRoot ? themeFor(node).fillSolid : themeFor(node).fill"
                :stroke="themeFor(node).stroke"
                :stroke-width="sizeFor(node).strokeWidth"
                :filter="hoveredId === node.id ? 'url(#mindmap-glow)' : undefined"
              />
              <text
                v-if="levelBadge(node.level, node.isRoot)"
                :x="node.x - sizeFor(node).w / 2 + 8"
                :y="node.y - sizeFor(node).h / 2 + 11"
                :fill="node.isRoot ? themeFor(node).text : themeFor(node).stroke"
                font-size="8"
                font-weight="600"
                opacity="0.9"
              >
                {{ levelBadge(node.level, node.isRoot) }}
              </text>
              <text
                :x="node.x"
                :y="node.y + (node.isRoot ? 5 : 4)"
                text-anchor="middle"
                :fill="themeFor(node).text"
                :font-size="sizeFor(node).fontSize"
                font-weight="500"
              >
                {{ truncateLabel(node.text, node.isRoot ? 16 : node.level === 1 ? 14 : 12) }}
              </text>
            </g>
          </svg>
        </div>

        <p class="pointer-events-none absolute bottom-3 left-4 text-[10px] text-muted">
          滚轮缩放 · 拖拽平移 · 点击节点跳转编辑器 · 左右分支树形展开
        </p>
      </div>
    </div>
  </div>
</template>
