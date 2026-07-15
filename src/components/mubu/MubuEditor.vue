<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { CheckSquare, ChevronDown, ChevronRight } from "@lucide/vue";
import type { MubuDecor, MubuTreeNode } from "../../types/mubu";
import {
  MUBU_HIGHLIGHTS,
  MUBU_ICONS,
  MUBU_TEXT_COLORS,
  emptyDecor,
} from "../../types/mubu";
import {
  collectVisibleIds,
  findMubuNode,
  findMubuParent,
} from "../../utils/mubuTree";
import { parseTopicLabel } from "../../utils/mindmap/parseTopicLabel";

const props = defineProps<{
  root: MubuTreeNode;
  selectedId: string | null;
}>();

const emit = defineEmits<{
  change: [root: MubuTreeNode];
  select: [id: string];
}>();

interface Row {
  node: MubuTreeNode;
  depth: number;
}

const collapsed = ref(new Set<string>());
const focusId = ref<string | null>(null);
const inputRefs = ref<Record<string, HTMLInputElement | null>>({});
const menu = ref<{ id: string; x: number; y: number } | null>(null);
const colorOpen = ref(false);
const highlightOpen = ref(false);
const iconOpen = ref(false);

const rows = computed(() => {
  const out: Row[] = [];
  const walk = (node: MubuTreeNode, depth: number) => {
    out.push({ node, depth });
    if (!collapsed.value.has(node.id)) {
      for (const c of node.children) walk(c, depth + 1);
    }
  };
  walk(props.root, 0);
  return out;
});

const menuNode = computed(() =>
  menu.value ? findMubuNode(props.root, menu.value.id) : null,
);

watch(
  () => props.selectedId,
  (id) => {
    if (id) focusId.value = id;
  },
);

onMounted(() => {
  focusId.value = props.selectedId ?? props.root.id;
  document.addEventListener("pointerdown", onDocPointer, true);
});
onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocPointer, true);
});

function onDocPointer(e: PointerEvent) {
  const t = e.target as HTMLElement | null;
  if (t?.closest?.(".mubu-menu")) return;
  closeMenu();
}

function cloneRoot(): MubuTreeNode {
  return JSON.parse(JSON.stringify(props.root)) as MubuTreeNode;
}

function reindex(nodes: MubuTreeNode[]) {
  nodes.forEach((c, i) => {
    c.sortOrder = i;
  });
}

function commit(next: MubuTreeNode) {
  emit("change", next);
}

function patchNode(id: string, fn: (n: MubuTreeNode) => void) {
  const next = cloneRoot();
  const node = findMubuNode(next, id);
  if (!node) return;
  fn(node);
  commit(next);
}

function setInputRef(id: string, el: unknown) {
  inputRefs.value[id] = (el as HTMLInputElement | null) ?? null;
}

async function focusNode(id: string) {
  focusId.value = id;
  emit("select", id);
  await nextTick();
  inputRefs.value[id]?.focus();
}

function toggle(id: string) {
  const s = new Set(collapsed.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  collapsed.value = s;
}

function onText(id: string, text: string) {
  patchNode(id, (n) => {
    n.text = text;
  });
}

function onEnter(id: string) {
  const next = cloneRoot();
  const parent = findMubuParent(next, id);
  const current = findMubuNode(next, id);
  if (!current) return;

  const newNode: MubuTreeNode = {
    id: crypto.randomUUID(),
    docId: current.docId,
    parentId: parent ? parent.id : current.id,
    sortOrder: 0,
    text: "",
    note: "",
    collapsed: false,
    isTodo: false,
    isDone: false,
    headingLevel: 0,
    decor: emptyDecor(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children: [],
  };

  if (!parent) {
    current.children.push(newNode);
    newNode.parentId = current.id;
    newNode.sortOrder = current.children.length - 1;
  } else {
    const idx = parent.children.findIndex((c) => c.id === id);
    newNode.parentId = parent.id;
    parent.children.splice(idx + 1, 0, newNode);
    reindex(parent.children);
  }
  commit(next);
  void focusNode(newNode.id);
}

function onTab(id: string, e: KeyboardEvent) {
  e.preventDefault();
  if (id === props.root.id) return;
  const next = cloneRoot();
  const parent = findMubuParent(next, id);
  if (!parent) return;
  const idx = parent.children.findIndex((c) => c.id === id);
  if (idx <= 0) return;
  const prev = parent.children[idx - 1];
  const [moved] = parent.children.splice(idx, 1);
  moved.parentId = prev.id;
  prev.children.push(moved);
  reindex(parent.children);
  reindex(prev.children);
  collapsed.value = new Set([...collapsed.value].filter((x) => x !== prev.id));
  commit(next);
  void focusNode(id);
}

function onShiftTab(id: string, e: KeyboardEvent) {
  e.preventDefault();
  if (id === props.root.id) return;
  const next = cloneRoot();
  const parent = findMubuParent(next, id);
  if (!parent) return;
  const grand = findMubuParent(next, parent.id);
  if (!grand) return;
  const idx = parent.children.findIndex((c) => c.id === id);
  const [moved] = parent.children.splice(idx, 1);
  reindex(parent.children);
  const pIdx = grand.children.findIndex((c) => c.id === parent.id);
  moved.parentId = grand.id;
  grand.children.splice(pIdx + 1, 0, moved);
  reindex(grand.children);
  commit(next);
  void focusNode(id);
}

function onBackspace(id: string, text: string) {
  if (text.length > 0 || id === props.root.id) return;
  const next = cloneRoot();
  const parent = findMubuParent(next, id);
  if (!parent) return;
  const idx = parent.children.findIndex((c) => c.id === id);
  const [removed] = parent.children.splice(idx, 1);
  const prev = idx > 0 ? parent.children[idx - 1] : parent;
  for (const c of removed.children) {
    c.parentId = prev.id === parent.id && idx === 0 ? parent.id : prev.id;
    prev.children.push(c);
  }
  reindex(parent.children);
  const focusTarget = idx > 0 ? parent.children[idx - 1]?.id ?? parent.id : parent.id;
  commit(next);
  void focusNode(focusTarget);
}

function onArrow(id: string, dir: -1 | 1) {
  const ids = collectVisibleIds(props.root, collapsed.value);
  const i = ids.indexOf(id);
  const nextId = ids[i + dir];
  if (nextId) void focusNode(nextId);
}

function openMenu(id: string, e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  emit("select", id);
  const pad = 8;
  let x = e.clientX;
  let y = e.clientY;
  if (x + 280 > window.innerWidth) x = window.innerWidth - 288;
  if (y + 420 > window.innerHeight) y = Math.max(pad, window.innerHeight - 428);
  menu.value = { id, x: Math.max(pad, x), y: Math.max(pad, y) };
  colorOpen.value = false;
  highlightOpen.value = false;
  iconOpen.value = false;
}

function closeMenu() {
  menu.value = null;
  colorOpen.value = false;
  highlightOpen.value = false;
  iconOpen.value = false;
}

function setHeading(level: number) {
  if (!menu.value) return;
  patchNode(menu.value.id, (n) => {
    n.headingLevel = level;
  });
}

function toggleDecor(key: keyof Pick<MubuDecor, "bold" | "italic" | "underline" | "strike">) {
  if (!menu.value) return;
  patchNode(menu.value.id, (n) => {
    n.decor = { ...emptyDecor(), ...n.decor, [key]: !n.decor?.[key] };
  });
}

function setColor(css: string) {
  if (!menu.value) return;
  patchNode(menu.value.id, (n) => {
    n.decor = { ...emptyDecor(), ...n.decor, color: css || null };
  });
  colorOpen.value = false;
}

function setHighlight(css: string | null) {
  if (!menu.value) return;
  patchNode(menu.value.id, (n) => {
    n.decor = { ...emptyDecor(), ...n.decor, highlight: css };
  });
  highlightOpen.value = false;
}

function setIcon(icon: string | null) {
  if (!menu.value) return;
  patchNode(menu.value.id, (n) => {
    n.decor = { ...emptyDecor(), ...n.decor, icon };
  });
  iconOpen.value = false;
}

function toggleTodo() {
  if (!menu.value) return;
  patchNode(menu.value.id, (n) => {
    if (n.isTodo) {
      n.isTodo = false;
      n.isDone = false;
    } else {
      n.isTodo = true;
      n.isDone = false;
    }
  });
}

function toggleDone(id: string) {
  patchNode(id, (n) => {
    if (!n.isTodo) return;
    n.isDone = !n.isDone;
  });
}

function deleteNode() {
  if (!menu.value || menu.value.id === props.root.id) {
    closeMenu();
    return;
  }
  const id = menu.value.id;
  closeMenu();
  const next = cloneRoot();
  const parent = findMubuParent(next, id);
  if (!parent) return;
  const idx = parent.children.findIndex((c) => c.id === id);
  if (idx < 0) return;
  parent.children.splice(idx, 1);
  reindex(parent.children);
  commit(next);
  void focusNode(parent.id);
}

function inputStyle(node: MubuTreeNode) {
  const d = node.decor ?? emptyDecor();
  return {
    color: d.color || undefined,
    background: d.highlight || undefined,
    fontWeight: d.bold || node.headingLevel > 0 ? (d.bold ? "700" : undefined) : undefined,
    fontStyle: d.italic ? "italic" : undefined,
    textDecoration: [
      d.underline ? "underline" : "",
      d.strike || node.isDone ? "line-through" : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined,
  };
}

function headingClass(level: number) {
  if (level === 1) return "mubu-input--h1";
  if (level === 2) return "mubu-input--h2";
  if (level === 3) return "mubu-input--h3";
  return "";
}
</script>

<template>
  <div class="mubu-editor" data-testid="mubu-editor" @keydown.stop>
    <ul class="mubu-editor__list" role="tree">
      <li
        v-for="{ node, depth } in rows"
        :key="node.id"
        class="mubu-row"
        :class="{
          'mubu-row--root': depth === 0,
          'mubu-row--selected': selectedId === node.id || focusId === node.id,
          'mubu-row--done': node.isDone,
        }"
        :style="{ '--mubu-depth': String(depth) }"
        role="treeitem"
        :aria-expanded="node.children.length ? !collapsed.has(node.id) : undefined"
        @contextmenu="openMenu(node.id, $event)"
      >
        <div class="mubu-row__main">
          <button
            v-if="node.children.length"
            type="button"
            class="mubu-collapse focus-ring"
            :aria-label="collapsed.has(node.id) ? '展开' : '折叠'"
            @click="toggle(node.id)"
          >
            <ChevronRight v-if="collapsed.has(node.id)" class="size-3.5" aria-hidden="true" />
            <ChevronDown v-else class="size-3.5" aria-hidden="true" />
          </button>
          <span v-else class="mubu-collapse mubu-collapse--spacer" aria-hidden="true" />

          <span class="mubu-bullet-wrap" aria-hidden="true">
            <span v-if="node.decor?.icon" class="mubu-bullet-icon">{{ node.decor.icon }}</span>
            <span v-else class="mubu-bullet" />
          </span>

          <button
            v-if="node.isTodo"
            type="button"
            class="mubu-todo focus-ring"
            :aria-checked="node.isDone"
            role="checkbox"
            @click="toggleDone(node.id)"
          >
            <CheckSquare v-if="node.isDone" class="size-3.5" />
            <span v-else class="mubu-todo__box" />
          </button>

          <div class="mubu-row__body">
            <div class="mubu-row__title-line">
              <input
                :ref="(el) => setInputRef(node.id, el)"
                class="mubu-input focus-ring"
                :class="[
                  { 'mubu-input--root': depth === 0 },
                  headingClass(node.headingLevel),
                ]"
                :style="inputStyle(node)"
                :value="node.text"
                :placeholder="depth === 0 ? '根主题' : '主题'"
                @focus="emit('select', node.id)"
                @input="onText(node.id, ($event.target as HTMLInputElement).value)"
                @keydown.enter.prevent="onEnter(node.id)"
                @keydown.tab.exact="onTab(node.id, $event)"
                @keydown.tab.shift.exact="onShiftTab(node.id, $event)"
                @keydown.backspace="onBackspace(node.id, node.text)"
                @keydown.up.prevent="onArrow(node.id, -1)"
                @keydown.down.prevent="onArrow(node.id, 1)"
              />
              <span
                v-for="tag in parseTopicLabel(node.text).tags"
                :key="`${node.id}-${tag}`"
                class="mubu-tag"
              >#{{ tag }}</span>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <div
      v-if="menu && menuNode"
      class="mubu-menu"
      data-testid="mubu-node-menu"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      @pointerdown.stop
    >
      <div class="mubu-menu__fmt">
        <button
          v-for="lv in [1, 2, 3]"
          :key="lv"
          type="button"
          class="mubu-menu__chip"
          :class="{ 'mubu-menu__chip--on': menuNode.headingLevel === lv }"
          @click="setHeading(lv)"
        >
          H{{ lv }}
        </button>
        <button
          type="button"
          class="mubu-menu__chip"
          :class="{ 'mubu-menu__chip--on': menuNode.headingLevel === 0 }"
          @click="setHeading(0)"
        >
          T
        </button>
        <span class="mubu-menu__sep" />
        <button
          type="button"
          class="mubu-menu__chip"
          :class="{ 'mubu-menu__chip--on': menuNode.decor?.bold }"
          @click="toggleDecor('bold')"
        >
          B
        </button>
        <button
          type="button"
          class="mubu-menu__chip mubu-menu__chip--i"
          :class="{ 'mubu-menu__chip--on': menuNode.decor?.italic }"
          @click="toggleDecor('italic')"
        >
          I
        </button>
        <button
          type="button"
          class="mubu-menu__chip mubu-menu__chip--u"
          :class="{ 'mubu-menu__chip--on': menuNode.decor?.underline }"
          @click="toggleDecor('underline')"
        >
          U
        </button>
        <button
          type="button"
          class="mubu-menu__chip mubu-menu__chip--s"
          :class="{ 'mubu-menu__chip--on': menuNode.decor?.strike }"
          @click="toggleDecor('strike')"
        >
          S
        </button>
      </div>

      <div class="mubu-menu__section">
        <button type="button" class="mubu-menu__item" @click="colorOpen = !colorOpen; highlightOpen = false; iconOpen = false">
          字体颜色
        </button>
        <div v-if="colorOpen" class="mubu-menu__swatches">
          <button
            v-for="c in MUBU_TEXT_COLORS"
            :key="c.id"
            type="button"
            class="mubu-swatch"
            :style="{ background: c.css || 'var(--color-text)' }"
            :title="c.id"
            @click="setColor(c.css)"
          />
        </div>
        <button type="button" class="mubu-menu__item" @click="highlightOpen = !highlightOpen; colorOpen = false; iconOpen = false">
          荧光笔
        </button>
        <div v-if="highlightOpen" class="mubu-menu__swatches">
          <button type="button" class="mubu-swatch mubu-swatch--clear" title="清除" @click="setHighlight(null)">Ø</button>
          <button
            v-for="h in MUBU_HIGHLIGHTS"
            :key="h.id"
            type="button"
            class="mubu-swatch"
            :style="{ background: h.css }"
            @click="setHighlight(h.css)"
          />
        </div>
      </div>

      <div class="mubu-menu__section">
        <button type="button" class="mubu-menu__item" @click="toggleTodo">
          {{ menuNode.isTodo ? "取消待办" : "添加待办" }}
        </button>
        <button type="button" class="mubu-menu__item" @click="iconOpen = !iconOpen; colorOpen = false; highlightOpen = false">
          添加图标
        </button>
        <div v-if="iconOpen" class="mubu-menu__icons">
          <button type="button" class="mubu-icon-btn" title="清除" @click="setIcon(null)">Ø</button>
          <button
            v-for="ic in MUBU_ICONS"
            :key="ic"
            type="button"
            class="mubu-icon-btn"
            @click="setIcon(ic)"
          >
            {{ ic }}
          </button>
        </div>
      </div>

      <div class="mubu-menu__section">
        <button
          type="button"
          class="mubu-menu__item mubu-menu__item--danger"
          :disabled="menuNode.id === root.id"
          @click="deleteNode"
        >
          删除
        </button>
      </div>

      <p class="mubu-menu__meta">
        选中字数：{{ [...(menuNode.text || "")].length }}
      </p>
    </div>
  </div>
</template>
