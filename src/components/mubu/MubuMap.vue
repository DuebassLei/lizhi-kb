<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import type { MubuTreeNode } from "../../types/mubu";
import { findMubuNode, mubuToHeadingTree } from "../../utils/mubuTree";
import { layoutMindmapTree } from "../../composables/mindmap/useMindmapLayout";
import { useSvgPanZoom } from "../../composables/useSvgPanZoom";
import { exportMindmapPng } from "../../utils/mindmap/exportMindmapPng";
import { exportMubuMarkdown } from "../../utils/mubu/exportMubuMarkdown";
import { useUiStore } from "../../stores/ui";
import MindmapTopicLabel from "../mindmap/MindmapTopicLabel.vue";
import "../../styles/mindmap.css";
import "../../styles/mubu.css";

const props = defineProps<{
  root: MubuTreeNode;
  selectedId: string | null;
  title: string;
}>();

const emit = defineEmits<{
  select: [id: string];
  toggleCollapse: [id: string];
  updateText: [id: string, text: string];
}>();

const ui = useUiStore();
const rootRef = ref<HTMLElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);
const editInputRef = ref<HTMLInputElement | null>(null);
const panZoom = useSvgPanZoom(containerRef);

const editingId = ref<string | null>(null);
const editDraft = ref("");
const exportingPng = ref(false);
const exportingMd = ref(false);

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

function onNodeDblClick(id: string) {
  emit("select", id);
  const node = findMubuNode(props.root, id);
  if (!node) return;
  editingId.value = id;
  editDraft.value = node.text;
  void nextTick(() => editInputRef.value?.focus());
}

function commitEdit(id: string) {
  if (editingId.value !== id) return;
  const next = editDraft.value.replace(/\s+/g, " ").trim();
  editingId.value = null;
  const node = findMubuNode(props.root, id);
  if (!node || !next || next === node.text) return;
  emit("updateText", id, next);
}

function cancelEdit() {
  editingId.value = null;
}

async function exportPng() {
  if (!stageRef.value || exportingPng.value || !layout.value.nodes.length) return;
  exportingPng.value = true;
  try {
    const ok = await exportMindmapPng({
      sourceEl: stageRef.value,
      styleHost: rootRef.value,
      width: layout.value.width,
      height: layout.value.height,
      title: `${props.title}-思维导图`,
    });
    if (ok) ui.showToast("success", "导图已导出为 PNG");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "导出失败";
    ui.showToast("error", msg);
  } finally {
    exportingPng.value = false;
  }
}

async function exportMd() {
  if (exportingMd.value) return;
  exportingMd.value = true;
  try {
    const ok = await exportMubuMarkdown(props.root, props.title);
    if (ok) ui.showToast("success", "大纲已导出为 Markdown");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "导出失败";
    ui.showToast("error", msg);
  } finally {
    exportingMd.value = false;
  }
}
</script>

<template>
  <div
    ref="rootRef"
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
        ref="stageRef"
        class="absolute left-1/2 top-1/2 origin-center"
        data-testid="mubu-map-stage"
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
            @dblclick.prevent="onNodeDblClick(node.id)"
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
                <input
                  v-if="editingId === node.id"
                  ref="editInputRef"
                  v-model="editDraft"
                  class="mm-node__input"
                  data-testid="mubu-map-node-edit"
                  @pointerdown.stop
                  @click.stop
                  @keydown.enter.prevent="commitEdit(node.id)"
                  @keydown.escape.prevent="cancelEdit()"
                  @blur="commitEdit(node.id)"
                />
                <MindmapTopicLabel
                  v-else
                  :text="node.text"
                  :centered="node.isRoot"
                />
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
      <div class="mm-toolbar__actions absolute bottom-3 right-3 z-10 flex flex-wrap justify-end gap-1">
        <button
          type="button"
          class="mm-btn"
          title="导出 PNG 图片"
          data-testid="mubu-map-export-png"
          :disabled="exportingPng || !layout.nodes.length"
          @click="exportPng()"
        >
          {{ exportingPng ? "导出中…" : "导出图片" }}
        </button>
        <button
          type="button"
          class="mm-btn"
          title="导出 Markdown 大纲（整树）"
          data-testid="mubu-map-export-md"
          :disabled="exportingMd"
          @click="exportMd()"
        >
          {{ exportingMd ? "导出中…" : "导出大纲" }}
        </button>
        <button type="button" class="mm-btn" @click="panZoom.zoomOut()">−</button>
        <span class="mm-zoom">{{ Math.round(panZoom.scale.value * 100) }}%</span>
        <button type="button" class="mm-btn" @click="panZoom.zoomIn()">+</button>
        <button type="button" class="mm-btn" @click="panZoom.resetView()">适应</button>
      </div>
    </div>
  </div>
</template>
