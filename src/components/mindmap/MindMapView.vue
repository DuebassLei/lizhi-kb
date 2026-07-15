<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useDocumentsStore } from "../../stores/documents";
import { useEditorStore } from "../../stores/editor";
import { useUiStore } from "../../stores/ui";
import { useOutlineTree } from "../../composables/useOutlineTree";
import { useSvgPanZoom } from "../../composables/useSvgPanZoom";
import {
  layoutMindmapTree,
  type MindmapLayoutNode,
} from "../../composables/mindmap/useMindmapLayout";
import { updateOutlineLine } from "../../utils/updateOutlineLine";
import { exportMindmapPng } from "../../utils/mindmap/exportMindmapPng";
import {
  fontCssFor,
  loadMindmapStyle,
  MINDMAP_FONT_OPTIONS,
  MINDMAP_LINK_ARROW_OPTIONS,
  MINDMAP_LINK_SHAPE_OPTIONS,
  MINDMAP_NODE_SHAPE_OPTIONS,
  MINDMAP_THEME_OPTIONS,
  saveMindmapStyle,
  type MindmapFontId,
  type MindmapLinkArrow,
  type MindmapLinkShape,
  type MindmapNodeShape,
  type MindmapStylePrefs,
  type MindmapThemeId,
} from "../../utils/mindmap/mindmapStyle";
import type { HeadingTreeNode } from "../../utils/headings";
import MindmapTopicLabel from "./MindmapTopicLabel.vue";
import OutlineNotesView from "./OutlineNotesView.vue";
import "../../styles/mindmap.css";

type PaneMode = "map" | "notes";

const documents = useDocumentsStore();
const editor = useEditorStore();
const ui = useUiStore();

const rootRef = ref<HTMLElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);
const panZoom = useSvgPanZoom(containerRef);
const editInputRef = ref<HTMLInputElement | null>(null);

const stylePrefs = ref<MindmapStylePrefs>(loadMindmapStyle());
const exporting = ref(false);
const paneMode = ref<PaneMode>("map");

const activeTitle = computed(
  () => documents.tree.find((d) => d.id === documents.activeId)?.title ?? "无标题",
);

const { tree, nodeCount, refreshImmediate } = useOutlineTree({
  title: () => activeTitle.value,
  content: () => documents.content,
});

/** docId → collapsed node ids */
const collapsedByDoc = ref<Record<string, string[]>>({});
const selectedId = ref<string | null>(null);
const editingId = ref<string | null>(null);
const editDraft = ref("");

const collapsedSet = computed(() => {
  const id = documents.activeId;
  if (!id) return new Set<string>();
  return new Set(collapsedByDoc.value[id] ?? []);
});

const layout = computed(() =>
  layoutMindmapTree(tree.value, collapsedSet.value, {
    linkShape: stylePrefs.value.linkShape,
  }),
);

const selectedNode = computed(
  () => layout.value.nodes.find((n) => n.id === selectedId.value) ?? null,
);

function findOutlineNode(id: string | null): HeadingTreeNode | null {
  if (!id) return null;
  const walk = (n: HeadingTreeNode): HeadingTreeNode | null => {
    if (n.id === id) return n;
    for (const c of n.children) {
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  };
  return walk(tree.value);
}

const viewStyle = computed(() => ({
  "--mm-font": fontCssFor(stylePrefs.value.fontId),
}));

watch(
  stylePrefs,
  (prefs) => saveMindmapStyle(prefs),
  { deep: true },
);

watch(
  () => documents.activeId,
  () => {
    selectedId.value = null;
    editingId.value = null;
    panZoom.resetView();
    refreshImmediate();
  },
);

watch(paneMode, (mode) => {
  if (mode === "map") void nextTick(() => fitView());
});

function patchStyle<K extends keyof MindmapStylePrefs>(key: K, value: MindmapStylePrefs[K]) {
  stylePrefs.value = { ...stylePrefs.value, [key]: value };
}

function onLinkShape(e: Event) {
  patchStyle("linkShape", (e.target as HTMLSelectElement).value as MindmapLinkShape);
}
function onLinkArrow(e: Event) {
  patchStyle("linkArrow", (e.target as HTMLSelectElement).value as MindmapLinkArrow);
}
function onNodeShape(e: Event) {
  patchStyle("nodeShape", (e.target as HTMLSelectElement).value as MindmapNodeShape);
}
function onTheme(e: Event) {
  patchStyle("themeId", (e.target as HTMLSelectElement).value as MindmapThemeId);
}
function onFont(e: Event) {
  patchStyle("fontId", (e.target as HTMLSelectElement).value as MindmapFontId);
}

const linkMarkerEnd = computed(() =>
  stylePrefs.value.linkArrow === "none" ? undefined : "url(#mm-arrow-end)",
);
const linkMarkerStart = computed(() =>
  stylePrefs.value.linkArrow === "both" ? "url(#mm-arrow-start)" : undefined,
);

function setCollapsed(id: string, hasChildren: boolean) {
  const docId = documents.activeId;
  if (!docId || !hasChildren) return;
  const curr = new Set(collapsedByDoc.value[docId] ?? []);
  if (curr.has(id)) curr.delete(id);
  else curr.add(id);
  collapsedByDoc.value = { ...collapsedByDoc.value, [docId]: [...curr] };
}

function toggleCollapse(node: MindmapLayoutNode, e: Event) {
  e.stopPropagation();
  setCollapsed(node.id, Boolean(node.childCount));
}

function onOutlineToggle(id: string) {
  const node = findOutlineNode(id);
  setCollapsed(id, Boolean(node?.children.length));
}

function selectNode(node: MindmapLayoutNode) {
  selectedId.value = node.id;
}

function onOutlineSelect(node: HeadingTreeNode) {
  selectedId.value = node.id;
}

function goToEditorLine(
  node: Pick<MindmapLayoutNode, "isRoot" | "lineIndex" | "kind" | "text"> | null,
) {
  ui.setWorkspaceView("edit");
  if (node && !node.isRoot && node.lineIndex !== undefined) {
    if (node.kind === "heading") {
      ui.requestHeadingScroll(node.text);
    } else {
      ui.requestLineScroll(node.lineIndex);
    }
  }
  documents.persistSession();
}

function onOutlineOpen(node: HeadingTreeNode) {
  goToEditorLine({
    isRoot: Boolean(node.isRoot),
    lineIndex: node.lineIndex,
    kind: node.kind,
    text: node.text,
  });
}

function backToEdit() {
  if (selectedNode.value) {
    goToEditorLine(selectedNode.value);
    return;
  }
  const outline = findOutlineNode(selectedId.value);
  if (outline) {
    onOutlineOpen(outline);
    return;
  }
  goToEditorLine(null);
}

function onNodeDblClick(node: MindmapLayoutNode) {
  selectedId.value = node.id;
  if (node.isRoot || node.lineIndex === undefined) {
    goToEditorLine(node);
    return;
  }
  editingId.value = node.id;
  editDraft.value = node.text;
  void nextTick(() => editInputRef.value?.focus());
}

function commitEdit(node: MindmapLayoutNode) {
  if (editingId.value !== node.id || node.lineIndex === undefined) {
    editingId.value = null;
    return;
  }
  const next = editDraft.value.replace(/\s+/g, " ").trim();
  editingId.value = null;
  if (!next || next === node.text) return;
  const updated = updateOutlineLine(documents.content, node.lineIndex, next);
  if (updated === documents.content) return;
  documents.updateContent(updated);
  void editor.saveNow();
  refreshImmediate();
}

function cancelEdit() {
  editingId.value = null;
}

function fitView() {
  panZoom.resetView();
  const root = layout.value.nodes[0];
  if (root) panZoom.centerAt(root.x + root.width / 2, root.y + root.height / 2);
}

function depthClass(node: MindmapLayoutNode) {
  if (node.chrome === "root") return "mm-node--root";
  if (node.chrome === "box") return "mm-node--box mm-node--d1";
  const d = Math.min(6, Math.max(2, node.depth));
  return `mm-node--line mm-node--d${d}`;
}

function nodeClass(node: MindmapLayoutNode) {
  return [
    "mm-node",
    depthClass(node),
    selectedId.value === node.id ? "mm-node--selected" : "",
  ];
}

async function exportPng() {
  if (!stageRef.value || exporting.value || nodeCount.value === 0) return;
  exporting.value = true;
  try {
    const ok = await exportMindmapPng({
      sourceEl: stageRef.value,
      styleHost: rootRef.value,
      width: layout.value.width,
      height: layout.value.height,
      title: `${activeTitle.value}-思维导图`,
    });
    if (ok) ui.showToast("success", "导图已导出为 PNG");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "导出失败";
    ui.showToast("error", msg);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div
    ref="rootRef"
    class="mm-view relative flex h-full flex-col"
    data-testid="mindmap-view"
    :data-node-shape="stylePrefs.nodeShape"
    :data-theme="stylePrefs.themeId"
    :style="viewStyle"
  >
    <div v-if="!documents.activeId" class="flex flex-1 items-center justify-center text-sm text-muted">
      请先打开一篇文档以查看思维导图
    </div>
    <div v-else class="flex min-h-0 flex-1 flex-col">
      <div class="mm-toolbar flex shrink-0 items-center justify-between gap-3 px-3 py-2">
        <div class="mm-toolbar__meta min-w-0">
          <div
            class="mm-pane-switch"
            role="tablist"
            aria-label="导图视图"
            data-testid="mindmap-pane-switch"
          >
            <button
              type="button"
              role="tab"
              class="mm-pane-switch__btn"
              :class="{ 'mm-pane-switch__btn--active': paneMode === 'map' }"
              :aria-selected="paneMode === 'map'"
              data-testid="mindmap-pane-map"
              @click="paneMode = 'map'"
            >
              思维导图
            </button>
            <button
              type="button"
              role="tab"
              class="mm-pane-switch__btn"
              :class="{ 'mm-pane-switch__btn--active': paneMode === 'notes' }"
              :aria-selected="paneMode === 'notes'"
              data-testid="mindmap-pane-notes"
              @click="paneMode = 'notes'"
            >
              大纲笔记
            </button>
          </div>
          <span class="mm-toolbar__title" :title="activeTitle">{{ activeTitle }}</span>
          <span class="mm-toolbar__count">{{ nodeCount }} 个主题</span>
        </div>
        <div class="mm-toolbar__actions" data-testid="mindmap-zoom-controls">
          <template v-if="paneMode === 'map'">
            <select
              class="mm-select"
              :value="stylePrefs.linkShape"
              title="线条形状"
              data-testid="mindmap-link-shape"
              @change="onLinkShape"
            >
              <option v-for="o in MINDMAP_LINK_SHAPE_OPTIONS" :key="o.id" :value="o.id">
                {{ o.label }}
              </option>
            </select>
            <select
              class="mm-select"
              :value="stylePrefs.linkArrow"
              title="箭头"
              data-testid="mindmap-link-arrow"
              @change="onLinkArrow"
            >
              <option v-for="o in MINDMAP_LINK_ARROW_OPTIONS" :key="o.id" :value="o.id">
                {{ o.label }}
              </option>
            </select>
            <select
              class="mm-select"
              :value="stylePrefs.nodeShape"
              title="节点形状"
              data-testid="mindmap-node-shape"
              @change="onNodeShape"
            >
              <option v-for="o in MINDMAP_NODE_SHAPE_OPTIONS" :key="o.id" :value="o.id">
                {{ o.label }}
              </option>
            </select>
            <select
              class="mm-select mm-select--theme"
              :value="stylePrefs.themeId"
              title="主题色"
              data-testid="mindmap-theme"
              @change="onTheme"
            >
              <option v-for="o in MINDMAP_THEME_OPTIONS" :key="o.id" :value="o.id">
                {{ o.label }}
              </option>
            </select>
            <select
              class="mm-select"
              :value="stylePrefs.fontId"
              title="字体"
              data-testid="mindmap-font"
              @change="onFont"
            >
              <option v-for="o in MINDMAP_FONT_OPTIONS" :key="o.id" :value="o.id">
                {{ o.label }}
              </option>
            </select>
            <span class="mm-sep" aria-hidden="true" />
            <button
              type="button"
              class="mm-btn"
              title="导出 PNG 图片"
              data-testid="mindmap-export-png"
              :disabled="exporting || nodeCount === 0"
              @click="exportPng()"
            >
              {{ exporting ? "导出中…" : "导出图片" }}
            </button>
          </template>
          <select
            v-else
            class="mm-select mm-select--theme"
            :value="stylePrefs.themeId"
            title="主题色"
            data-testid="mindmap-theme-notes"
            @change="onTheme"
          >
            <option v-for="o in MINDMAP_THEME_OPTIONS" :key="o.id" :value="o.id">
              {{ o.label }}
            </option>
          </select>
          <button
            type="button"
            class="mm-btn mm-btn--primary"
            title="回编辑并定位选中主题"
            data-testid="mindmap-back-edit"
            @click="backToEdit()"
          >
            回编辑
          </button>
          <template v-if="paneMode === 'map'">
            <span class="mm-sep" aria-hidden="true" />
            <button type="button" class="mm-btn" title="缩小" @click="panZoom.zoomOut()">−</button>
            <span class="mm-zoom">{{ Math.round(panZoom.scale.value * 100) }}%</span>
            <button type="button" class="mm-btn" title="放大" @click="panZoom.zoomIn()">+</button>
            <button type="button" class="mm-btn" title="适应画布" @click="fitView()">适应</button>
          </template>
        </div>
      </div>

      <div
        v-if="paneMode === 'notes'"
        class="mm-outline-pane relative min-h-0 flex-1 overflow-auto"
      >
        <OutlineNotesView
          :tree="tree"
          :selected-id="selectedId"
          :collapsed-ids="collapsedSet"
          @select="onOutlineSelect"
          @toggle="onOutlineToggle"
          @open="onOutlineOpen"
        />
      </div>

      <div
        v-else
        ref="containerRef"
        class="mm-canvas relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        @wheel="panZoom.onWheel"
        @pointerdown="panZoom.onPointerDown"
        @pointermove="panZoom.onPointerMove"
        @pointerup="panZoom.onPointerUp"
        @pointercancel="panZoom.onPointerUp"
      >
        <div
          v-if="nodeCount === 0"
          class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
        >
          <div class="mm-empty">
            <p class="text-sm text-[var(--color-text-secondary)]">暂无大纲主题</p>
            <p class="mt-2 max-w-xs text-xs leading-relaxed text-muted">
              用
              <code># 主题</code>
              或
              <code>- 列表</code>
              建层级；主题下段落在「大纲笔记」中查看
            </p>
          </div>
        </div>

        <div
          ref="stageRef"
          class="absolute left-1/2 top-1/2 origin-center"
          data-testid="mindmap-stage"
          :style="{ transform: `translate(-50%, -50%) ${panZoom.transformStyle.value}` }"
        >
          <svg
            :width="layout.width"
            :height="layout.height"
            class="overflow-visible"
            data-testid="mindmap-svg"
          >
            <defs>
              <marker
                id="mm-arrow-end"
                class="mm-arrow-marker"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
              <marker
                id="mm-arrow-start"
                class="mm-arrow-marker"
                viewBox="0 0 10 10"
                refX="1"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            <path
              v-for="link in layout.links"
              :key="link.id"
              class="mm-link"
              :d="link.path"
              :marker-end="linkMarkerEnd"
              :marker-start="linkMarkerStart"
            />
            <g
              v-for="node in layout.nodes"
              :key="node.id"
              data-mindmap-node
              class="mm-node-g"
              :transform="`translate(${node.x}, ${node.y})`"
              @click="selectNode(node)"
              @dblclick.prevent="onNodeDblClick(node)"
            >
              <foreignObject :width="node.width" :height="node.height">
                <div xmlns="http://www.w3.org/1999/xhtml" :class="nodeClass(node)">
                  <input
                    v-if="editingId === node.id"
                    ref="editInputRef"
                    v-model="editDraft"
                    class="mm-node__input"
                    data-testid="mindmap-node-edit"
                    @pointerdown.stop
                    @click.stop
                    @keydown.enter.prevent="commitEdit(node)"
                    @keydown.escape.prevent="cancelEdit()"
                    @blur="commitEdit(node)"
                  />
                  <template v-else>
                    <MindmapTopicLabel :text="node.text" :centered="node.isRoot" />
                  </template>
                </div>
              </foreignObject>

              <g
                v-if="node.childCount && node.collapsed"
                class="mm-badge"
                :transform="`translate(${node.width + 2}, ${node.chrome === 'line' ? node.titleH - 1 : node.height / 2})`"
                @click="toggleCollapse(node, $event)"
              >
                <circle class="mm-badge__bg" r="11" />
                <text class="mm-badge__num" text-anchor="middle" y="3.5">
                  {{ node.childCount }}
                </text>
              </g>
              <g
                v-else-if="node.childCount"
                class="mm-badge"
                :transform="`translate(${node.width - 2}, ${node.chrome === 'line' ? node.titleH - 1 : node.height / 2})`"
                @click="toggleCollapse(node, $event)"
              >
                <circle
                  class="mm-badge__bg"
                  r="8"
                  style="fill: var(--color-canvas)"
                />
                <text
                  text-anchor="middle"
                  y="3"
                  fill="var(--color-muted)"
                  font-size="11"
                  font-family="var(--mm-font)"
                >
                  −
                </text>
              </g>
            </g>
          </svg>
        </div>
        <p class="mm-hint">思维导图 ↔ 大纲笔记 · 导出 PNG</p>
      </div>
    </div>
  </div>
</template>
